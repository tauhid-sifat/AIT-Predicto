export type MatchStatus = 'scheduled' | 'live' | 'finished'

export type DataSource = 'espn' | 'api-football' | 'manual'

export type NormalizedMatch = {
  external_id: number
  team_a: string
  team_b: string
  kickoff_time: string
  status: MatchStatus
  score_a: number | null
  score_b: number | null
  source: DataSource
  round?: string | null
}

export type SyncOptions = {
  source?: DataSource
  dateFrom?: string
  dateTo?: string
}

export interface TournamentDataSource {
  readonly name: DataSource
  getFixtures(options?: SyncOptions): Promise<NormalizedMatch[]>
  getLiveUpdates(): Promise<NormalizedMatch[]>
  getMatchDetail(externalId: number): Promise<NormalizedMatch | null>
}
