import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { scoreMatchPredictions } from '@/lib/scoring'
import { logEvent, logError } from '@/lib/sync-logger'
import { getState, setState, incrementCounter, logToDb } from '@/lib/system-state'
import { syncFromSource, createSource } from '@/lib/data-sources/registry'
import type { DataSource } from '@/lib/data-sources/types'

const MIN_SYNC_INTERVAL_MS = 30_000

export async function POST(request: NextRequest) {
  if (request.headers.get('x-sync-secret') !== process.env.SYNC_SECRET) {
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

    // Upsert in batches to avoid request size limits
    const BATCH = 50
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH)
      const { error } = await supabase.from('matches').upsert(batch, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      if (error) throw error
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
