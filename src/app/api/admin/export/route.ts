import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-sync-secret')
  if (secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createAdminClient()

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'leaderboard'

  if (type === 'predictions') {
    const { data: predictions } = await supabase
      .from('predictions')
      .select('id, user_id, match_id, predicted_home_score, predicted_away_score, predicted_winner, points, created_at')

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')

    const { data: matches } = await supabase
      .from('matches')
      .select('id, home_team, away_team, home_score, away_score, status, match_date')

    const userMap = new Map((profiles ?? []).map((p: any) => [p.id, p.username]))
    const matchMap = new Map((matches ?? []).map((m: any) => [m.id, m]))

    const header = 'id,username,home_team,away_team,predicted_home,predicted_away,predicted_winner,points,actual_home,actual_away,status,match_date,created_at'
    const rows = (predictions ?? []).map((p: any) => {
      const m = matchMap.get(p.match_id)
      return [
        p.id,
        userMap.get(p.user_id) ?? 'unknown',
        m?.home_team ?? '?',
        m?.away_team ?? '?',
        p.predicted_home_score ?? '',
        p.predicted_away_score ?? '',
        p.predicted_winner ?? '',
        p.points ?? '',
        m?.home_score ?? '',
        m?.away_score ?? '',
        m?.status ?? '',
        m?.match_date ?? '',
        p.created_at,
      ].join(',')
    })

    return new NextResponse([header, ...rows].join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="predictions.csv"',
      },
    })
  }

  // Leaderboard export
  const { data } = await supabase.rpc('get_leaderboard_extended')

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'No data' }, { status: 404 })
  }

  // Apply shared (RANK-style) positions
  data.sort((a: any, b: any) => b.total_points - a.total_points)
  let rank = 0
  let prevPoints: number | null = null
  for (const [i, entry] of data.entries()) {
    if (entry.total_points !== prevPoints) rank = i + 1
    entry.rank = rank
    prevPoints = entry.total_points
  }

  const header = 'rank,username,total_points,total_predictions,correct_predictions,accuracy_percent,current_streak,longest_streak,exact_score_count'
  const rows = data.map((e: any) =>
    [e.rank, e.username, e.total_points, e.total_predictions, e.correct_predictions, e.accuracy_percent, e.current_streak, e.longest_streak, e.exact_score_count].join(',')
  )

  return new NextResponse([header, ...rows].join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="leaderboard.csv"',
    },
  })
}
