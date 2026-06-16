import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: { [key: string]: unknown } }[]) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { match_id, predicted_home_score, predicted_away_score } = await request.json()

  if (match_id === undefined || predicted_home_score === undefined || predicted_away_score === undefined) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const scoreA = parseInt(predicted_home_score, 10)
  const scoreB = parseInt(predicted_away_score, 10)
  if (isNaN(scoreA) || isNaN(scoreB) || scoreA < 0 || scoreB < 0) {
    return NextResponse.json({ error: 'Invalid scores' }, { status: 400 })
  }

  const predicted_winner = scoreA > scoreB ? 'home' : scoreA < scoreB ? 'away' : 'draw'

  // Verify match exists and hasn't started
  const { data: match } = await supabase
    .from('matches')
    .select('kickoff_time, status')
    .eq('id', match_id)
    .single()

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  if (match.status !== 'scheduled') {
    return NextResponse.json({ error: 'Match has already started' }, { status: 400 })
  }

  if (new Date(match.kickoff_time) <= new Date()) {
    return NextResponse.json({ error: 'Match has already started' }, { status: 400 })
  }

  const { data, error } = await supabase.from('predictions').upsert(
    {
      user_id: user.id,
      match_id,
      predicted_home_score: scoreA,
      predicted_away_score: scoreB,
      predicted_winner,
    },
    { onConflict: 'user_id, match_id', ignoreDuplicates: false }
  ).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ prediction: data })
}
