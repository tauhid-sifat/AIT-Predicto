import { createAdminClient } from '@/lib/supabase-admin'
import { logEvent, logError } from '@/lib/sync-logger'
import { setState, logToDb } from '@/lib/system-state'

export function calculatePoints(
  predictedScoreA: number,
  predictedScoreB: number,
  actualScoreA: number,
  actualScoreB: number
): number {
  const exactScore = predictedScoreA === actualScoreA && predictedScoreB === actualScoreB
  if (exactScore) return 5

  const predictedOutcome =
    predictedScoreA > predictedScoreB ? 'a' : predictedScoreA < predictedScoreB ? 'b' : 'draw'
  const actualOutcome =
    actualScoreA > actualScoreB ? 'a' : actualScoreA < actualScoreB ? 'b' : 'draw'

  return predictedOutcome === actualOutcome ? 2 : 0
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

  // 1. Verify match exists and is final
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

  // 2. Fetch all predictions for this match
  const { data: predictions } = await supabase
    .from('predictions')
    .select('id, user_id, predicted_home_score, predicted_away_score, points')
    .eq('match_id', matchId)

  if (!predictions || predictions.length === 0) {
    logEvent('scoring_completed', { matchId, totalPredictions: 0, updated: 0, skipped: 0 })
    return result
  }

  result.totalPredictions = predictions.length

  // 3. Check if already fully scored (all predictions have non-null points)
  const allScored = predictions.every((p) => p.points !== null)
  if (allScored) {
    logEvent('scoring_skipped', { matchId, reason: 'already_scored', totalPredictions: predictions.length })
    result.skipped = predictions.length
    return result
  }

  // 4. Score each prediction idempotently
  for (const p of predictions) {
    const newPoints = calculatePoints(
      p.predicted_home_score,
      p.predicted_away_score,
      match.home_score,
      match.away_score
    )

    if (p.points === newPoints) {
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

  // Track state
  await setState('last_scoring_run_time', new Date().toISOString())
  if (result.errors > 0) {
    await logToDb('scoring_completed_with_errors', {
      matchId,
      errors: result.errors,
      total: result.totalPredictions,
    })
  }

  return result
}
