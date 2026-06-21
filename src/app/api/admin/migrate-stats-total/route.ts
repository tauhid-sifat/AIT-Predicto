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
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_predictions   BIGINT,
  correct_predictions BIGINT,
  accuracy_percent    NUMERIC,
  current_streak      BIGINT,
  longest_streak      BIGINT,
  exact_score_count   BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  rec RECORD;
  total_all BIGINT := 0;
  total_finished BIGINT := 0;
  correct BIGINT := 0;
  exact BIGINT := 0;
  streak BIGINT := 0;
  max_streak BIGINT := 0;
  curr_streak BIGINT := 0;
BEGIN
  SELECT COUNT(*) INTO total_all
  FROM predictions
  WHERE user_id = get_user_stats.p_user_id;

  FOR rec IN
    SELECT p.points, p.predicted_home_score, p.predicted_away_score,
           m.home_score, m.away_score
    FROM predictions p
    JOIN matches m ON m.id = p.match_id
    WHERE p.user_id = get_user_stats.p_user_id
      AND m.status = 'finished'
      AND p.points IS NOT NULL
    ORDER BY m.kickoff_time ASC
  LOOP
    total_finished := total_finished + 1;
    IF rec.points > 0 THEN
      correct := correct + 1;
      streak := streak + 1;
      IF streak > max_streak THEN max_streak := streak; END IF;
      IF rec.predicted_home_score = rec.home_score
         AND rec.predicted_away_score = rec.away_score
      THEN
        exact := exact + 1;
      END IF;
    ELSE
      streak := 0;
    END IF;
  END LOOP;

  FOR rec IN
    SELECT p.points
    FROM predictions p
    JOIN matches m ON m.id = p.match_id
    WHERE p.user_id = get_user_stats.p_user_id
      AND m.status = 'finished'
      AND p.points IS NOT NULL
    ORDER BY m.kickoff_time DESC
  LOOP
    IF rec.points > 0 THEN
      curr_streak := curr_streak + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN QUERY SELECT
    total_all,
    correct,
    CASE WHEN total_finished > 0 THEN ROUND(correct * 100.0 / total_finished, 1) ELSE 0 END,
    curr_streak,
    max_streak,
    exact;
END;
$$;
    `.trim(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, message: 'get_user_stats updated to count all predictions' })
}
