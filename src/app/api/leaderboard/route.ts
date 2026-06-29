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

  // Fetch all finished matches + user predictions to build a full heatmap
  type FormResult = 'exact' | 'correct' | 'incorrect' | null
  const recentFormMap: Record<string, (FormResult)[]> = {}

  if (data.length > 0) {
    const supabase = createAdminClient()
    const allUserIds = data.map((e: any) => e.user_id)

    const { data: allFinishedMatches } = await supabase
      .from('matches')
      .select('id, home_score, away_score, kickoff_time')
      .eq('status', 'finished')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('kickoff_time', { ascending: false })
      .limit(50)

    if (!allFinishedMatches || allFinishedMatches.length === 0) { /* skip */ }
    else {
      const matchIds = (allFinishedMatches as any[]).map((m: any) => m.id)

      const { data: allPredictions } = await supabase
        .from('predictions')
        .select('user_id, match_id, predicted_winner, predicted_home_score, predicted_away_score')
        .in('match_id', matchIds)

      // Build lookup: user_id → { match_id → prediction }
      const predByUser = new Map<string, Map<number, any>>()
      for (const p of (allPredictions ?? []) as any[]) {
        if (!predByUser.has(p.user_id)) predByUser.set(p.user_id, new Map())
        predByUser.get(p.user_id)!.set(p.match_id, p)
      }

      const matchMap = new Map((allFinishedMatches as any[]).map((m: any) => [m.id, m]))

      for (const uid of allUserIds) {
        const userPreds = predByUser.get(uid) ?? new Map()
        const form: FormResult[] = []
        for (const m of allFinishedMatches as any[]) {
          const p = userPreds.get(m.id)
          if (!p) {
            form.push(null)
            continue
          }
          const correctWinner =
            (m.home_score > m.away_score && p.predicted_winner === 'home') ||
            (m.home_score < m.away_score && p.predicted_winner === 'away') ||
            (m.home_score === m.away_score && p.predicted_winner === 'draw')
          if (!correctWinner) { form.push('incorrect'); continue }
          if (p.predicted_home_score === m.home_score && p.predicted_away_score === m.away_score) {
            form.push('exact')
          } else {
            form.push('correct')
          }
        }
        recentFormMap[uid] = form
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
