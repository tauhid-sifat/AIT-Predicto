import type { TournamentDataSource, NormalizedMatch, SyncOptions, MatchStatus } from './types'

const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'
const EVENT = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/events'

type EspnEvent = {
  id: string
  date: string
  status: {
    type: {
      state: 'pre' | 'in' | 'post'
      completed?: boolean
    }
  }
  competitions: Array<{
    competitors: Array<{
      team: { name: string }
      score?: string
    }>
  }>
}

function mapStatus(state: string): MatchStatus {
  if (state === 'in') return 'live'
  if (state === 'post') return 'finished'
  return 'scheduled'
}

function parseEvent(ev: EspnEvent, source: 'espn'): NormalizedMatch | null {
  const comp = ev.competitions?.[0]
  if (!comp) return null

  const [teamA, teamB] = comp.competitors
  if (!teamA || !teamB) return null

  return {
    external_id: parseInt(ev.id, 10),
    team_a: teamA.team.name,
    team_b: teamB.team.name,
    kickoff_time: ev.date,
    status: mapStatus(ev.status.type.state),
    score_a: teamA.score ? parseInt(teamA.score, 10) : null,
    score_b: teamB.score ? parseInt(teamB.score, 10) : null,
    source,
  }
}

export class EspnDataSource implements TournamentDataSource {
  readonly name = 'espn' as const

  // PRIMARY: daily scoreboard → full fixture list
  async getFixtures(options?: SyncOptions): Promise<NormalizedMatch[]> {
    const matches: NormalizedMatch[] = []
    const seen = new Set<number>()
    const dates = this.resolveDateRange(options)

    for (const date of dates) {
      const url = `${SCOREBOARD}?dates=${date}&_cb=${Date.now()}`
      const res = await fetch(url, { cache: 'no-store' })

      if (!res.ok) {
        console.warn(`[espn] HTTP ${res.status} for ${date}, skipping`)
        continue
      }

      const json = await res.json()
      const events: EspnEvent[] = json.events ?? []

      for (const ev of events) {
        const parsed = parseEvent(ev, 'espn')
        if (!parsed || seen.has(parsed.external_id)) continue
        seen.add(parsed.external_id)
        matches.push(parsed)
      }
    }

    return matches
  }

  // CONTINUOUS: today's scoreboard → live updates
  async getLiveUpdates(): Promise<NormalizedMatch[]> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const url = `${SCOREBOARD}?dates=${today}&_cb=${Date.now()}`
    const res = await fetch(url, { cache: 'no-store' })

    if (!res.ok) {
      console.warn(`[espn] Live scoreboard HTTP ${res.status}`)
      return []
    }

    const json = await res.json()
    const events: EspnEvent[] = json.events ?? []
    const matches: NormalizedMatch[] = []

    for (const ev of events) {
      const parsed = parseEvent(ev, 'espn')
      if (parsed) matches.push(parsed)
    }

    return matches
  }

  // SECONDARY: event detail → validation / fallback
  async getMatchDetail(externalId: number): Promise<NormalizedMatch | null> {
    const url = `${EVENT}/${externalId}?_cb=${Date.now()}`
    const res = await fetch(url, { cache: 'no-store' })

    if (!res.ok) {
      console.warn(`[espn] Event detail HTTP ${res.status} for ${externalId}`)
      return null
    }

    const json = await res.json()
    return parseEvent(json, 'espn')
  }

  private resolveDateRange(options?: SyncOptions): string[] {
    const fmt = (d: Date) =>
      d.toISOString().slice(0, 10).replace(/-/g, '')

    const from = options?.dateFrom ? new Date(options.dateFrom) : new Date()
    const to = options?.dateTo ? new Date(options.dateTo) : new Date(from)
    to.setDate(to.getDate() + 7)

    const dates: string[] = []
    const cur = new Date(from)
    while (cur <= to) {
      dates.push(fmt(cur))
      cur.setDate(cur.getDate() + 1)
    }
    return dates
  }
}
