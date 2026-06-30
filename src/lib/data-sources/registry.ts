import type { TournamentDataSource, NormalizedMatch, DataSource, SyncOptions } from './types'
import { EspnDataSource } from './espn'
import { ApiFootballDataSource } from './api-football'

const PRIORITY: DataSource[] = ['espn', 'api-football', 'manual']

export function createSource(source?: DataSource): TournamentDataSource {
  switch (source) {
    case 'espn':
      return new EspnDataSource()
    case 'api-football':
      return new ApiFootballDataSource()
    default:
      return new EspnDataSource()
  }
}

export function toDbRecord(m: NormalizedMatch) {
  return {
    id: m.external_id,
    home_team: m.team_a,
    away_team: m.team_b,
    kickoff_time: m.kickoff_time,
    status: m.status,
    home_score: m.score_a,
    away_score: m.score_b,
    source: m.source,
    round: m.round ?? null,
    penalty_winner: m.penalty_winner ?? null,
  }
}

export async function syncFromSource(
  preferredSource: DataSource,
  options?: SyncOptions
): Promise<{ records: ReturnType<typeof toDbRecord>[]; source: DataSource }> {
  // Try sources in priority order starting from preferred
  const startIdx = PRIORITY.indexOf(preferredSource)
  const ordered = [...PRIORITY.slice(startIdx), ...PRIORITY.slice(0, startIdx)].filter(
    (s) => s !== 'manual'
  )

  for (const sourceName of ordered) {
    try {
      const source = createSource(sourceName)
      const matches = await source.getFixtures(options)
      if (matches.length > 0) {
        return { records: matches.map(toDbRecord), source: sourceName }
      }
      console.warn(`[sync] ${sourceName} returned 0 matches, trying next source`)
    } catch (err) {
      console.warn(`[sync] ${sourceName} failed: ${err instanceof Error ? err.message : err}`)
    }
  }

  return { records: [], source: preferredSource }
}

export { PRIORITY }
