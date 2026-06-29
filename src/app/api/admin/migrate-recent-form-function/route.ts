import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION get_recent_form_all()
      RETURNS TABLE (user_id UUID, recent_form TEXT[])
      LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
        WITH ranked AS (
          SELECT p.user_id,
            CASE
              WHEN m.home_score > m.away_score AND p.predicted_winner = 'home' THEN 'correct'
              WHEN m.home_score < m.away_score AND p.predicted_winner = 'away' THEN 'correct'
              WHEN m.home_score = m.away_score AND p.predicted_winner = 'draw' THEN 'correct'
              ELSE 'incorrect'
            END AS result,
            ROW_NUMBER() OVER (PARTITION BY p.user_id ORDER BY m.kickoff_time DESC) AS rn
          FROM predictions p
          JOIN matches m ON m.id = p.match_id
          WHERE p.points IS NOT NULL AND m.status = 'finished'
            AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
        )
        SELECT r.user_id, ARRAY_AGG(r.result ORDER BY r.rn)
        FROM ranked r WHERE r.rn <= 5 GROUP BY r.user_id
      $$;
    `.trim(),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, message: 'get_recent_form_all function created' })
}
