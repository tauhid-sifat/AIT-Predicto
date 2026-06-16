type LogEvent =
  | 'match_sync_started'
  | 'match_sync_completed'
  | 'match_updated'
  | 'scoring_started'
  | 'scoring_completed'
  | 'scoring_skipped'
  | 'leaderboard_updated'
  | 'consistency_check'

export function logEvent(event: LogEvent, details?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...(details ? { details } : {}),
  }
  console.log(JSON.stringify(entry))
}

export function logError(event: string, error: unknown, context?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    event: `${event}_error`,
    details: {
      error: error instanceof Error ? error.message : String(error),
      ...context,
    },
  }
  console.error(JSON.stringify(entry))
}
