import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { scoreMatchPredictions } from '@/lib/scoring'
import { logEvent, logError } from '@/lib/sync-logger'
import { getState, setState, incrementCounter, logToDb } from '@/lib/system-state'
import { syncFromSource, createSource, toDbRecord } from '@/lib/data-sources/registry'
import type { DataSource } from '@/lib/data-sources/types'

const MIN_SYNC_INTERVAL_MS = 30_000

function isAuthorized(request: NextRequest): boolean {
  if (request.headers.get('x-sync-secret') === process.env.SYNC_SECRET) return true
  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${process.env.SYNC_SECRET}`) return true
  return false
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const lastRun = await getState('last_successful_sync_time')
  if (lastRun) {
    const elapsed = Date.now() - new Date(lastRun).getTime()
    if (elapsed < MIN_SYNC_INTERVAL_MS) {
      const wait = Math.ceil((MIN_SYNC_INTERVAL_MS - elapsed) / 1000)
      return NextResponse.json(
        { error: `Sync rate limited. Try again in ${wait}s.`, lastRun },
        { status: 429 }
      )
    }
  }

  const body = await request.json().catch(() => ({}))
  const dataSource: DataSource = body.dataSource ?? 'espn'
  const dateFrom = body.dateFrom ?? undefined
  const dateTo = body.dateTo ?? undefined

  logEvent('match_sync_started', { dataSource, dateFrom, dateTo })

  // Clear inflight cache for API-Football adapter
  const afSource = createSource('api-football')
  if ('clearCache' in afSource && typeof (afSource as any).clearCache === 'function') {
    ;(afSource as any).clearCache()
  }

  try {
    const supabase = createAdminClient()
    const syncResult = { synced: 0, finished: 0 }
    const scoringResults: string[] = []
    let leaderboardDirty = false

    // Fetch from primary source with fallback
    const { records, source } = await syncFromSource(dataSource, { source: dataSource, dateFrom, dateTo })
    syncResult.synced = records.length

    if (records.length === 0) {
      logEvent('match_sync_completed', { synced: 0, source, reason: 'no_fixtures' })
      return NextResponse.json({ ok: true, synced: 0, finished: 0, source, details: [] })
    }

    // Remap records to preserve existing match IDs (ESPN external_id changes between syncs)
    const allHomeTeams = [...new Set(records.map((r: any) => r.home_team))]
    const allAwayTeams = [...new Set(records.map((r: any) => r.away_team))]
    const allTeams = [...new Set([...allHomeTeams, ...allAwayTeams])]

    const { data: existingMatches } = await supabase
      .from('matches')
      .select('id, home_team, away_team, kickoff_time')
      .in('home_team', allTeams)

    const teamDateMap = new Map<string, number>()
    for (const m of existingMatches ?? []) {
      const key = `${m.home_team}|${m.away_team}|${new Date(m.kickoff_time).toISOString().slice(0, 10)}`
      teamDateMap.set(key, m.id)
      // Also store reversed teams (home/away may swap between syncs)
      const revKey = `${m.away_team}|${m.home_team}|${new Date(m.kickoff_time).toISOString().slice(0, 10)}`
      if (!teamDateMap.has(revKey)) teamDateMap.set(revKey, m.id)
    }

    const remapped = records.map((r: any) => {
      const dateKey = new Date(r.kickoff_time).toISOString().slice(0, 10)
      const existingId = teamDateMap.get(`${r.home_team}|${r.away_team}|${dateKey}`)
      if (existingId && existingId !== r.id) {
        console.log(`[sync] Remapping ${r.home_team} vs ${r.away_team}: ESPN id ${r.id} → ${existingId}`)
        return { ...r, id: existingId }
      }
      return r
    })

    // Upsert in batches to avoid request size limits
    const BATCH = 50
    for (let i = 0; i < remapped.length; i += BATCH) {
      const batch = remapped.slice(i, i + BATCH)
      const batchIds = batch.map((r: any) => r.id)

      // Check existing statuses to avoid reverting finished matches
      const { data: existing } = await supabase
        .from('matches')
        .select('id, status')
        .in('id', batchIds)

      const finishedIds = new Set((existing ?? []).filter((m: any) => m.status === 'finished').map((m: any) => m.id))

      // Don't try to change status of finished matches — only update scores
      const safeBatch = batch.map((r: any) => {
        if (finishedIds.has(r.id)) {
          return { ...r, status: 'finished' }
        }
        return r
      })

      const { error } = await supabase.from('matches').upsert(safeBatch, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      if (error) {
        console.warn(`[sync] Batch upsert error: ${error.message}, falling back to individual upserts`)
        for (const rec of safeBatch) {
          const { error: rowErr } = await supabase.from('matches').upsert(rec, {
            onConflict: 'id',
            ignoreDuplicates: false,
          })
          if (rowErr) {
            console.warn(`[sync] Skipping match ${rec.id}: ${rowErr.message}`)
          }
        }
      }
    }

    // Refresh stale live matches that may have finished since last sync
    const staleCutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    const { data: staleMatches } = await supabase
      .from('matches')
      .select('id')
      .eq('status', 'live')
      .lt('kickoff_time', staleCutoff)
      .limit(20)

    if (staleMatches?.length) {
      const espnSource = createSource('espn')
      for (const sm of staleMatches) {
        const detail = await espnSource.getMatchDetail(sm.id)
        if (detail && detail.status === 'finished' && detail.score_a !== null && detail.score_b !== null) {
          const dbRec = toDbRecord(detail)
          const { error } = await supabase.from('matches').upsert(dbRec, { onConflict: 'id' })
          if (error) {
            logError('stale_refresh_failed', error, { matchId: sm.id })
            continue
          }
          records.push(dbRec)
        }
      }
    }

    // Fix any match still marked as live but with scores (finished but sync missed it)
    const { data: stuckLive } = await supabase
      .from('matches')
      .select('id, home_score, away_score')
      .eq('status', 'live')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .limit(50)

    if (stuckLive?.length) {
      const stuckIds = stuckLive.map((m: any) => m.id)
      const { error: fixErr } = await supabase
        .from('matches')
        .update({ status: 'finished' })
        .in('id', stuckIds)
      if (!fixErr) {
        for (const m of stuckLive) {
          records.push({ id: m.id, home_score: m.home_score, away_score: m.away_score, status: 'finished' } as any)
        }
        logEvent('stuck_live_fixed', { count: stuckLive.length })
      }
    }

    // Re-sync all finished matches from DB via event detail API to catch score corrections
    const { data: finishedFromDb } = await supabase
      .from('matches')
      .select('id')
      .eq('status', 'finished')
    const reSyncedIds = new Set<number>()
    if (finishedFromDb?.length) {
      const espnSource = createSource('espn')
      for (const fm of finishedFromDb) {
        const detail = await espnSource.getMatchDetail(fm.id)
        if (detail && detail.status === 'finished' && detail.score_a != null && detail.score_b != null) {
          const dbRec = toDbRecord(detail)
          const { error } = await supabase.from('matches').upsert(dbRec, { onConflict: 'id' })
          if (!error) {
            const existing = records.find((r) => r.id === fm.id)
            if (existing) {
              existing.home_score = dbRec.home_score
              existing.away_score = dbRec.away_score
            } else {
              records.push(dbRec)
            }
            reSyncedIds.add(fm.id)
          }
        }
      }
    }
    if (reSyncedIds.size > 0) {
      console.log(`[sync] re-synced ${reSyncedIds.size} finished matches`)
    }

    // Score finished matches
    for (const r of records) {
      if (r.status === 'finished' && r.home_score !== null && r.away_score !== null) {
        logEvent('scoring_started', { matchId: r.id })
        const sr = await scoreMatchPredictions(r.id)
        syncResult.finished++
        scoringResults.push(
          `match ${r.id}: ${sr.totalPredictions} predictions, ${sr.updated} updated, ` +
          `${sr.skipped} skipped, ${sr.errors} errors`
        )
        if (sr.updated > 0) leaderboardDirty = true
      }
    }

    // Re-score finished matches that weren't already scored in this run
    const scoredInBatch = new Set(records.filter((r) => r.status === 'finished').map((r) => r.id))
    const { data: allFinished } = await supabase
      .from('matches')
      .select('id, home_score, away_score')
      .eq('status', 'finished')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)

    for (const m of allFinished ?? []) {
      if (!scoredInBatch.has(m.id)) {
        const sr = await scoreMatchPredictions(m.id)
        if (sr.updated > 0 || sr.skipped < sr.totalPredictions) {
          syncResult.finished++
          scoringResults.push(`match ${m.id}: ${sr.totalPredictions} predictions, ${sr.updated} updated`)
          leaderboardDirty = true
        }
      }
    }

    // Catch any finished matches with null points (unscored predictions)
    const { data: unscoredMatches } = await supabase
      .from('predictions')
      .select('match_id')
      .is('points', null)
    if (unscoredMatches && unscoredMatches.length > 0) {
      const unscoredIds = [...new Set(unscoredMatches.map((p: any) => p.match_id))]
      const { data: unscoredMatchData } = await supabase
        .from('matches')
        .select('id')
        .eq('status', 'finished')
        .in('id', unscoredIds)
        .not('home_score', 'is', null)
        .not('away_score', 'is', null)
        .limit(50)

      for (const um of unscoredMatchData ?? []) {
        const sr = await scoreMatchPredictions(um.id)
        if (sr.updated > 0) {
          syncResult.finished++
          scoringResults.push(`unscored match ${um.id}: ${sr.totalPredictions} predictions, ${sr.updated} updated`)
          leaderboardDirty = true
        }
      }
    }

    logEvent('match_sync_completed', { synced: syncResult.synced, finished: syncResult.finished, source })
    scoringResults.forEach((line) => console.log(`[sync] ${line}`))

    if (leaderboardDirty) {
      logEvent('leaderboard_updated', { finished: syncResult.finished })
      revalidateTag('leaderboard')
    }

    await setState('last_successful_sync_time', new Date().toISOString())
    await setState('last_scoring_run_time', new Date().toISOString())
    await incrementCounter('total_sync_count')
    await logToDb('sync_completed', { synced: syncResult.synced, finished: syncResult.finished, source })

    return NextResponse.json({ ok: true, ...syncResult, source, details: scoringResults })
  } catch (err: any) {
    logError('sync_fatal', err, { dataSource })
    await incrementCounter('failed_sync_count')
    await logToDb('sync_failed', { error: err.message, dataSource })
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
