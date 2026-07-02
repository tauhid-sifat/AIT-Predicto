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

  // Fetch heatmap only for the requesting user
  type FormResult = 'exact' | 'correct' | 'incorrect' | null
  const recentFormMap: Record<string, (FormResult)[]> = {}

  if (userId) {
    const supabase = createAdminClient()

    const { data: allFinishedMatches } = await supabase
      .from('matches')
      .select('id, home_score, away_score, kickoff_time')
      .eq('status', 'finished')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('kickoff_time', { ascending: false })
      .limit(110)

    if (allFinishedMatches?.length) {
      const matchIds = allFinishedMatches.map((m: any) => m.id)

      const { data: userPredictions } = await supabase
        .from('predictions')
        .select('match_id, predicted_winner, predicted_home_score, predicted_away_score')
        .eq('user_id', userId)
        .in('match_id', matchIds)

      const predMap = new Map<number, any>()
      for (const p of (userPredictions ?? []) as any[]) {
        predMap.set(p.match_id, p)
      }

      const form: FormResult[] = []
      for (const m of allFinishedMatches as any[]) {
        const p = predMap.get(m.id)
        if (!p) { form.push(null); continue }
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
      recentFormMap[userId] = form
    }
  }

  const mvp = await (async () => {
    const supabase = createAdminClient()

    // Find the most recent matchday with finished matches
    const { data: matchdays } = await supabase
      .from('matches')
      .select('kickoff_time')
      .eq('status', 'finished')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('kickoff_time', { ascending: false })
      .limit(100)

    if (!matchdays || matchdays.length === 0) return null

    // Group by UTC date to find the latest matchday
    const dayGroups = new Map<string, boolean>()
    for (const m of matchdays as any[]) {
      const day = m.kickoff_time.slice(0, 10)
      dayGroups.set(day, true)
    }
    const sortedDays = [...dayGroups.keys()].sort().reverse()
    const latestMatchday = sortedDays[0]
    if (!latestMatchday) return null

    // Get all matches on that matchday
    const dayStart = `${latestMatchday}T00:00:00Z`
    const dayEnd = `${latestMatchday}T23:59:59Z`

    const { data: dayMatches } = await supabase
      .from('matches')
      .select('id, home_score, away_score')
      .eq('status', 'finished')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .gte('kickoff_time', dayStart)
      .lte('kickoff_time', dayEnd)

    if (!dayMatches || dayMatches.length === 0) return null

    const matchIds = (dayMatches as any[]).map((m) => m.id)

    // Get all predictions for those matches
    const { data: dayPredictions } = await supabase
      .from('predictions')
      .select('user_id, points, predicted_winner, predicted_home_score, predicted_away_score, match_id')
      .in('match_id', matchIds)
      .not('points', 'is', null)

    if (!dayPredictions || dayPredictions.length === 0) return null

    // Build match lookup
    const matchMap = new Map<number, any>()
    for (const m of dayMatches as any[]) matchMap.set(m.id, m)

    // Aggregate per user
    const pointsByUser = new Map<string, number>()
    const correctByUser = new Map<string, number>()
    const exactByUser = new Map<string, number>()

    for (const p of dayPredictions as any[]) {
      pointsByUser.set(p.user_id, (pointsByUser.get(p.user_id) ?? 0) + (p.points ?? 0))

      const match = matchMap.get(p.match_id)
      if (!match) continue

      const actualWinner =
        match.home_score > match.away_score ? 'home'
          : match.home_score < match.away_score ? 'away' : 'draw'

      const predictedWinner = p.predicted_winner ?? (
        p.predicted_home_score != null && p.predicted_away_score != null
          ? p.predicted_home_score > p.predicted_away_score ? 'home'
            : p.predicted_home_score < p.predicted_away_score ? 'away' : 'draw'
          : null
      )

      if (predictedWinner === actualWinner) {
        correctByUser.set(p.user_id, (correctByUser.get(p.user_id) ?? 0) + 1)
      }

      if (
        p.predicted_home_score !== null && p.predicted_away_score !== null &&
        p.predicted_home_score === match.home_score &&
        p.predicted_away_score === match.away_score
      ) {
        exactByUser.set(p.user_id, (exactByUser.get(p.user_id) ?? 0) + 1)
      }
    }

    let bestPoints = 0
    for (const pts of pointsByUser.values()) {
      if (pts > bestPoints) bestPoints = pts
    }

    const tiedUserIds = [...pointsByUser.entries()]
      .filter(([, pts]) => pts === bestPoints)
      .map(([uid]) => uid)

    if (tiedUserIds.length === 0) return null

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', tiedUserIds)

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.username ?? 'Unknown']))

    const mvps = tiedUserIds.map((uid) => ({
      user_id: uid,
      username: profileMap.get(uid) ?? 'Unknown',
      points_gained: bestPoints,
      correct_count: correctByUser.get(uid) ?? 0,
      exact_count: exactByUser.get(uid) ?? 0,
    }))

    return {
      mvps,
      matchday: latestMatchday,
    }
  })()

  return NextResponse.json({ leaderboard: data, rankChanges, stats, recentFormMap, mvp })
}
