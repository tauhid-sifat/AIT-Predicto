import { createAdminClient } from '@/lib/supabase-admin'
import { logEvent, logError } from '@/lib/sync-logger'
import { setState, logToDb } from '@/lib/system-state'

export function calculatePoints(
  predictedScoreA: number | null,
  predictedScoreB: number | null,
  actualScoreA: number,
  actualScoreB: number,
  predictedWinner?: string | null
): number {
  const actualWinner =
    actualScoreA > actualScoreB ? 'home' : actualScoreA < actualScoreB ? 'away' : 'draw'

  const winner = predictedWinner ?? (
    predictedScoreA != null && predictedScoreB != null
      ? predictedScoreA > predictedScoreB ? 'home'
        : predictedScoreA < predictedScoreB ? 'away'
        : 'draw'
      : null
  )

  let points = 0
  if (winner === actualWinner) points = 3

  const exact =
    predictedScoreA !== null &&
    predictedScoreB !== null &&
    predictedScoreA === actualScoreA &&
    predictedScoreB === actualScoreB

  if (exact) points += 2

  return points
}

type ScoreResult = {
  matchId: number
  totalPredictions: number
  updated: number
  skipped: number
  errors: number
}

export async function scoreMatchPredictions(matchId: number): Promise<ScoreResult> {
  const supabase = createAdminClient()
  const result: ScoreResult = { matchId, totalPredictions: 0, updated: 0, skipped: 0, errors: 0 }

  logEvent('scoring_started', { matchId })

  const { data: match } = await supabase
    .from('matches')
    .select('id, status, home_score, away_score')
    .eq('id', matchId)
    .single()

  if (!match) {
    logEvent('scoring_skipped', { matchId, reason: 'match_not_found' })
    result.skipped = 1
    return result
  }

  if (match.status !== 'finished' || match.home_score === null || match.away_score === null) {
    logEvent('scoring_skipped', {
      matchId,
      reason: 'match_not_final',
      status: match.status,
      scores: `${match.home_score}/${match.away_score}`,
    })
    result.skipped = 1
    return result
  }

  const { data: predictions } = await supabase
    .from('predictions')
    .select('id, user_id, predicted_home_score, predicted_away_score, predicted_winner, points')
    .eq('match_id', matchId)

  if (!predictions || predictions.length === 0) {
    logEvent('scoring_completed', { matchId, totalPredictions: 0, updated: 0, skipped: 0 })
    return result
  }

  result.totalPredictions = predictions.length

  for (const p of predictions) {
    const newPoints = calculatePoints(
      p.predicted_home_score,
      p.predicted_away_score,
      match.home_score,
      match.away_score,
      p.predicted_winner
    )

    if (p.points != null && p.points === newPoints) {
      result.skipped++
      continue
    }

    const { error } = await supabase
      .from('predictions')
      .update({ points: newPoints })
      .eq('id', p.id)

    if (error) {
      logError('scoring', error, { matchId, predictionId: p.id, userId: p.user_id })
      result.errors++
    } else {
      result.updated++
    }
  }

  logEvent('scoring_completed', {
    matchId,
    totalPredictions: result.totalPredictions,
    updated: result.updated,
    skipped: result.skipped,
    errors: result.errors,
  })

  await setState('last_scoring_run_time', new Date().toISOString())
  if (result.errors > 0) {
    await logToDb('scoring_completed_with_errors', {
      matchId,
      errors: result.errors,
      total: result.totalPredictions,
    })
  }

  // Save leaderboard snapshot for rank change tracking
  await updateLeaderboardSnapshot()

  return result
}

async function updateLeaderboardSnapshot() {
  const supabase = createAdminClient()
  const { data } = await supabase.rpc('get_leaderboard')
  if (data) {
    await setState('leaderboard_snapshot', JSON.stringify(data))
  }
}
