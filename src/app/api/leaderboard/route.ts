import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { getState } from '@/lib/system-state'
import { checkRateLimit } from '@/lib/rate-limit'

const getCachedLeaderboard = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('get_leaderboard_extended')
    if (error) throw new Error(error.message)
    return data ?? []
  },
  ['leaderboard-extended'],
  { tags: ['leaderboard'], revalidate: false }
)

function applyRank(data: any[]) {
  data.sort((a: any, b: any) => b.total_points - a.total_points)
  let rank = 0
  let prevPoints: number | null = null
  for (const [i, entry] of data.entries()) {
    if (entry.total_points !== prevPoints) rank = i + 1
    entry.rank = rank
    prevPoints = entry.total_points
  }
  return data
}

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request)
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })
  }
  const { searchParams } = new URL(request.url)
  const weekly = searchParams.get('weekly') === 'true'
  const userId = searchParams.get('user_id')

  if (weekly) {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('get_leaderboard_weekly')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ leaderboard: applyRank(data ?? []) })
  }

  let data
  try {
    data = await getCachedLeaderboard()
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  data = applyRank(data)

  const snapshotJson = await getState('leaderboard_snapshot')
  let rankChanges: Record<string, number> = {}
  if (snapshotJson) {
    const snapshot = JSON.parse(snapshotJson) as { user_id: string; rank: number }[]
    const prevRanks = new Map(snapshot.map((e) => [e.user_id, e.rank]))
    for (const entry of data) {
      const prev = prevRanks.get(entry.user_id)
      const current = entry.rank
      rankChanges[entry.user_id] = prev !== undefined ? prev - current : 0
    }
  }

  // Fetch stats for the requesting user (for the personal stats panel)
  let stats = null
  if (userId) {
    const supabase = createAdminClient()
    const { data: userStats } = await supabase.rpc('get_user_stats', { p_user_id: userId })
    stats = userStats?.[0] ?? null
  }

  // Fetch recent form for ALL leaderboard users in two bulk queries
  type FormResult = 'exact' | 'correct' | 'incorrect'
  const recentFormMap: Record<string, FormResult[]> = {}

  if (data.length > 0) {
    const supabase = createAdminClient()
    const allUserIds = data.map((e: any) => e.user_id)

    // 1. Get all scored predictions for leaderboard users (limit per user handled in JS below)
    const { data: allPredictions } = await supabase
      .from('predictions')
      .select('user_id, predicted_winner, predicted_home_score, predicted_away_score, match_id')
      .in('user_id', allUserIds)
      .not('points', 'is', null)

    if (allPredictions && allPredictions.length > 0) {
      const matchIds = [...new Set((allPredictions as any[]).map((p: any) => p.match_id))]

      // 2. Get the relevant finished matches in one query
      const { data: matches } = await supabase
        .from('matches')
        .select('id, home_score, away_score, status, kickoff_time')
        .in('id', matchIds)
        .eq('status', 'finished')

      const matchMap = new Map((matches ?? []).map((m: any) => [m.id, m]))

      // Group predictions by user, resolve form, keep the 5 most recent finished matches
      const byUser = new Map<string, any[]>()
      for (const p of allPredictions as any[]) {
        const m = matchMap.get(p.match_id)
        if (!m) continue
        if (!byUser.has(p.user_id)) byUser.set(p.user_id, [])
        byUser.get(p.user_id)!.push({ ...p, match: m })
      }

      for (const [uid, preds] of byUser) {
        const sorted = preds
          .sort((a, b) => new Date(b.match.kickoff_time).getTime() - new Date(a.match.kickoff_time).getTime())
          .slice(0, 5)
        recentFormMap[uid] = sorted.map((p) => {
          const { match } = p
          const correctWinner =
            (match.home_score > match.away_score && p.predicted_winner === 'home') ||
            (match.home_score < match.away_score && p.predicted_winner === 'away') ||
            (match.home_score === match.away_score && p.predicted_winner === 'draw')
          if (!correctWinner) return 'incorrect'
          const exactScore =
            p.predicted_home_score === match.home_score &&
            p.predicted_away_score === match.away_score
          return exactScore ? 'exact' : 'correct'
        })
      }
    }
  }

  const mvp = await (async () => {
    const supabase = createAdminClient()
    const lastScoring = await getState('last_scoring_run_time')
    if (!lastScoring) return null

    const cutoff = new Date(new Date(lastScoring).getTime() - 60000).toISOString()
    const { data: recentUpdated } = await supabase
      .from('predictions')
      .select('user_id, points')
      .gte('updated_at', cutoff)
      .not('points', 'is', null)

    if (!recentUpdated || recentUpdated.length === 0) return null

    const pointsByUser = new Map<string, number>()
    const countByUser = new Map<string, number>()
    for (const p of recentUpdated as any[]) {
      pointsByUser.set(p.user_id, (pointsByUser.get(p.user_id) ?? 0) + p.points)
      countByUser.set(p.user_id, (countByUser.get(p.user_id) ?? 0) + 1)
    }

    let bestUser: string | null = null
    let bestPoints = 0
    for (const [uid, pts] of pointsByUser) {
      if (pts > bestPoints) { bestPoints = pts; bestUser = uid }
    }

    if (!bestUser) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', bestUser)
      .single()

    return {
      user_id: bestUser,
      username: profile?.username ?? 'Unknown',
      points_gained: bestPoints,
      correct_count: countByUser.get(bestUser) ?? 0,
    }
  })()

  return NextResponse.json({ leaderboard: data, rankChanges, stats, recentFormMap, mvp })
}
