-- =============================================================================
-- World Cup Predictor — Supabase Schema
-- Run this in Supabase SQL Editor (project > SQL Editor > New query)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

-- 1. MATCHES
CREATE TABLE matches (
  id            BIGINT PRIMARY KEY,
  home_team     TEXT NOT NULL,
  away_team     TEXT NOT NULL,
  kickoff_time  TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('scheduled', 'live', 'finished')),
  home_score    INT CHECK (home_score >= 0),
  away_score    INT CHECK (away_score >= 0),
  source        TEXT NOT NULL DEFAULT 'api-football'
                CHECK (source IN ('espn', 'api-football', 'manual')),
  round         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matches_kickoff_status
  ON matches(kickoff_time, status);


-- 2. PREDICTIONS
CREATE TABLE predictions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id              BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  predicted_home_score  INT CHECK (predicted_home_score >= 0),
  predicted_away_score  INT CHECK (predicted_away_score >= 0),
  predicted_winner      TEXT NOT NULL CHECK (predicted_winner IN ('home', 'away', 'draw')),
  points                INT DEFAULT NULL CHECK (points IS NULL OR points >= 0),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (user_id, match_id),

  -- Winner required; scores optional but must be consistent if provided
  CONSTRAINT predicted_winner_consistent CHECK (
    (predicted_home_score IS NULL AND predicted_away_score IS NULL) OR
    (predicted_home_score > predicted_away_score AND predicted_winner = 'home') OR
    (predicted_home_score < predicted_away_score AND predicted_winner = 'away') OR
    (predicted_home_score = predicted_away_score AND predicted_winner = 'draw')
  )
);

CREATE INDEX idx_predictions_user_points
  ON predictions(user_id, points);


-- 3. PROFILES
CREATE TABLE profiles (
  id                        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username                  TEXT UNIQUE,
  email                     TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  email_notifications_enabled BOOLEAN DEFAULT TRUE,
  last_reminder_sent_at     TIMESTAMPTZ
);


-- ---------------------------------------------------------------------------
-- FUNCTIONS
-- ---------------------------------------------------------------------------

-- Returns true if the match is still open for predictions.
-- Used in RLS policies to prevent updates after kickoff.
CREATE OR REPLACE FUNCTION prediction_is_editable(check_match_id BIGINT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT
    status = 'scheduled' AND kickoff_time > NOW()
  FROM matches
  WHERE id = check_match_id;
$$;


-- Returns ranked leaderboard ordered by total points descending.
CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE (
  user_id       UUID,
  username      TEXT,
  total_points  BIGINT,
  rank          BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    pr.user_id,
    p.username,
    COALESCE(SUM(pr.points), 0)::BIGINT AS total_points,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(pr.points), 0) DESC)
  FROM predictions pr
  JOIN profiles p ON p.id = pr.user_id
  GROUP BY pr.user_id, p.username
  ORDER BY total_points DESC;
$$;


-- ---------------------------------------------------------------------------
-- TRIGGER
-- ---------------------------------------------------------------------------

-- Auto-create profile row on user signup.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO profiles (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      NEW.raw_user_meta_data->>'preferred_username',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NEW.email
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();


-- Auto-update predictions.updated_at on row update.
CREATE OR REPLACE FUNCTION update_predictions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_predictions_updated_at ON predictions;
CREATE TRIGGER set_predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_predictions_updated_at();


-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE matches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;

-- MATCHES — public read, only service role writes
CREATE POLICY "matches_select"
  ON matches FOR SELECT
  USING (true);

-- PREDICTIONS — users manage their own; updates locked before kickoff
CREATE POLICY "predictions_select"
  ON predictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "predictions_insert"
  ON predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "predictions_update"
  ON predictions FOR UPDATE
  USING (auth.uid() = user_id AND prediction_is_editable(match_id));

-- PROFILES — public read, owner-only update
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);


-- ---------------------------------------------------------------------------
-- POINTS PROTECTION
-- Prevents authenticated users from directly updating the points column.
-- Only service_role (server-side scoring job) can modify points.
-- Trigger fires BEFORE UPDATE so it catches all update attempts, including
-- those that would pass RLS (e.g. user updating their own prediction).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION protect_points()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.points IS DISTINCT FROM NEW.points AND auth.role() = 'authenticated' THEN
    RAISE EXCEPTION 'Direct modification of points is not allowed. Points are awarded automatically by the scoring system.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_points_trigger ON predictions;
CREATE TRIGGER protect_points_trigger
  BEFORE UPDATE ON predictions
  FOR EACH ROW
  EXECUTE FUNCTION protect_points();


-- ---------------------------------------------------------------------------
-- ENGAGEMENT FUNCTIONS (derived, no schema changes)
-- ---------------------------------------------------------------------------

-- Returns accuracy, streaks, and counts for a single user.
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
  -- Count ALL predictions for this user (including upcoming matches)
  SELECT COUNT(*) INTO total_all
  FROM predictions
  WHERE user_id = get_user_stats.p_user_id;

  -- Forward pass: finished match stats + longest streak
  FOR rec IN
    SELECT p.points, p.predicted_home_score, p.predicted_away_score,
           m.home_score, m.away_score
    FROM predictions p
    JOIN matches m ON m.id = p.match_id
    WHERE p.user_id = get_user_stats.p_user_id
      AND m.status = 'finished'
      AND p.points IS NOT NULL
    ORDER BY m.kickoff_time ASC, m.id ASC
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

  -- Backward pass: current streak (most recent correct predictions)
  FOR rec IN
    SELECT p.points
    FROM predictions p
    JOIN matches m ON m.id = p.match_id
    WHERE p.user_id = get_user_stats.p_user_id
      AND m.status = 'finished'
      AND p.points IS NOT NULL
    ORDER BY m.kickoff_time DESC, m.id DESC
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


-- Leaderboard with embedded accuracy, streaks, and badge data.
CREATE OR REPLACE FUNCTION get_leaderboard_extended()
RETURNS TABLE (
  user_id             UUID,
  username            TEXT,
  total_points        BIGINT,
  rank                BIGINT,
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
  lb    RECORD;
  stats RECORD;
BEGIN
  FOR lb IN SELECT * FROM get_leaderboard() LOOP
    SELECT * INTO stats FROM get_user_stats(lb.user_id);
    user_id             := lb.user_id;
    username            := lb.username;
    total_points        := lb.total_points;
    rank                := lb.rank;
    total_predictions   := stats.total_predictions;
    correct_predictions := stats.correct_predictions;
    accuracy_percent    := stats.accuracy_percent;
    current_streak      := stats.current_streak;
    longest_streak      := stats.longest_streak;
    exact_score_count   := stats.exact_score_count;
    RETURN NEXT;
  END LOOP;
END;
$$;


-- Weekly leaderboard (matches kickoff in last 7 days).
CREATE OR REPLACE FUNCTION get_leaderboard_weekly()
RETURNS TABLE (
  user_id      UUID,
  username     TEXT,
  total_points BIGINT,
  rank         BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    pr.user_id,
    p.username,
    COALESCE(SUM(pr.points), 0)::BIGINT AS total_points,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(pr.points), 0) DESC)
  FROM predictions pr
  JOIN profiles p ON p.id = pr.user_id
  JOIN matches m ON m.id = pr.match_id
  WHERE m.kickoff_time >= NOW() - INTERVAL '7 days'
  GROUP BY pr.user_id, p.username
  ORDER BY total_points DESC;
$$;


-- Returns prediction count per match (used by home page for hot-match logic).
CREATE OR REPLACE FUNCTION get_match_prediction_counts()
RETURNS TABLE (match_id BIGINT, count BIGINT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT match_id, COUNT(*)::BIGINT
  FROM predictions
  GROUP BY match_id;
$$;


-- Returns recent form (last 5 finished scored predictions) for every user.
CREATE OR REPLACE FUNCTION get_recent_form_all()
RETURNS TABLE (
  user_id      UUID,
  recent_form  TEXT[]
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      p.user_id,
      CASE
        WHEN m.home_score > m.away_score AND p.predicted_winner = 'home' THEN 'correct'
        WHEN m.home_score < m.away_score AND p.predicted_winner = 'away' THEN 'correct'
        WHEN m.home_score = m.away_score AND p.predicted_winner = 'draw' THEN 'correct'
        ELSE 'incorrect'
      END AS result,
      ROW_NUMBER() OVER (PARTITION BY p.user_id ORDER BY m.kickoff_time DESC) AS rn
    FROM predictions p
    JOIN matches m ON m.id = p.match_id
    WHERE p.points IS NOT NULL
      AND m.status = 'finished'
      AND m.home_score IS NOT NULL
      AND m.away_score IS NOT NULL
  )
  SELECT r.user_id, ARRAY_AGG(r.result ORDER BY r.rn) AS recent_form
  FROM ranked r
  WHERE r.rn <= 5
  GROUP BY r.user_id
$$;


-- ---------------------------------------------------------------------------
-- PRODUCTION HARDENING
-- ---------------------------------------------------------------------------

-- System state key-value store (timestamps, counters, cursors).
CREATE TABLE IF NOT EXISTS system_state (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Structured sync/scoring event log.
CREATE TABLE IF NOT EXISTS sync_log (
  id         BIGSERIAL PRIMARY KEY,
  event      TEXT NOT NULL,
  details    JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_created ON sync_log(created_at DESC);

-- Forward-only status transitions: scheduled → live → finished.
CREATE OR REPLACE FUNCTION check_match_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'finished' AND NEW.status IS DISTINCT FROM 'finished' THEN
    RAISE EXCEPTION 'Cannot revert match from finished status';
  END IF;
  IF OLD.status = 'live' AND NEW.status = 'scheduled' THEN
    RAISE EXCEPTION 'Cannot revert match from live to scheduled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_status_transition ON matches;
CREATE TRIGGER match_status_transition
  BEFORE UPDATE ON matches
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION check_match_status_transition();

-- Internal validation: find inconsistencies (admin-only).
CREATE OR REPLACE FUNCTION check_data_consistency()
RETURNS TABLE (
  category    TEXT,
  match_id    BIGINT,
  description TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Matches finished but no predictions have been scored yet
  SELECT 'unscored_match'::TEXT, m.id,
    'Match finished (' || m.home_score || '-' || m.away_score ||
    ') but predictions have no points'::TEXT
  FROM matches m
  WHERE m.status = 'finished'
    AND EXISTS (
      SELECT 1 FROM predictions p
      WHERE p.match_id = m.id AND p.points IS NULL
    )

  UNION ALL

  -- Predictions with points but match not finished (data corruption)
  SELECT 'orphaned_points'::TEXT, p.match_id,
    'Predictions have points but match status is ' || m.status
  FROM predictions p
  JOIN matches m ON m.id = p.match_id
  WHERE p.points > 0 AND m.status != 'finished'

  UNION ALL

  -- Finished matches with no predictions at all (informational)
  SELECT 'no_predictions'::TEXT, m.id,
    'Match finished with no predictions recorded'
  FROM matches m
  WHERE m.status = 'finished'
    AND NOT EXISTS (SELECT 1 FROM predictions p WHERE p.match_id = m.id)

  ORDER BY category, match_id;
$$;
