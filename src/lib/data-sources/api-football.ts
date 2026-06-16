import type { TournamentDataSource, NormalizedMatch, SyncOptions, MatchStatus, DataSource } from './types'

const BASE_URL = 'https://v3.football.api-sports.io'

const inflightCache = new Map<string, { data: NormalizedMatch[]; timestamp: number }>()
const CACHE_TTL_MS = 30_000

type ApiFixture = {
  fixture: { id: number; date: string; status: { short: string } }
  teams: { home: { name: string }; away: { name: string } }
  goals: { home: number | null; away: number | null }
}

function mapStatus(short: string): MatchStatus {
  const m: Record<string, MatchStatus> = {
    TBD: 'scheduled', NS: 'scheduled',
    '1H': 'live', HT: 'live', '2H': 'live', ET: 'live', P: 'live',
    FT: 'finished', AET: 'finished', PEN: 'finished',
    POSTP: 'scheduled', CANC: 'finished', ABAN: 'finished',
    SUSP: 'live', INT: 'scheduled',
  }
  return m[short] || 'scheduled'
}

function parseFixture(f: ApiFixture): NormalizedMatch {
  return {
    external_id: f.fixture.id,
    team_a: f.teams.home.name,
    team_b: f.teams.away.name,
    kickoff_time: f.fixture.date,
    status: mapStatus(f.fixture.status.short),
    score_a: f.goals.home,
    score_b: f.goals.away,
    source: 'api-football',
  }
}

export class ApiFootballDataSource implements TournamentDataSource {
  readonly name: DataSource = 'api-football'

  private leagueId: number
  private season: number

  constructor(leagueId?: number, season?: number) {
    this.leagueId = leagueId ?? Number(process.env.NEXT_PUBLIC_LEAGUE_ID) ?? 1
    this.season = season ?? Number(process.env.API_FOOTBALL_SEASON) ?? Number(process.env.NEXT_PUBLIC_SEASON) ?? 2026
  }

  async getFixtures(_options?: SyncOptions): Promise<NormalizedMatch[]> {
    const cacheKey = `${this.leagueId}-${this.season}`
    const cached = inflightCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data
    }

    const all: NormalizedMatch[] = []
    let lastId: number | undefined
    let hasMore = true

    while (hasMore) {
      const params = new URLSearchParams({
        league: String(this.leagueId),
        season: String(this.season),
      })
      if (lastId) params.set('last', String(lastId))

      const res = await fetch(`${BASE_URL}/fixtures?${params}&_cb=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'x-rapidapi-key': process.env.API_FOOTBALL_KEY!,
          'x-rapidapi-host': 'v3.football.api-sports.io',
        },
      })

      if (!res.ok) {
        throw new Error(`API-Football error: ${res.status} ${res.statusText}`)
      }

      const json = await res.json()
      const fixtures: ApiFixture[] = json.response || []

      for (const f of fixtures) {
        all.push(parseFixture(f))
      }

      hasMore = fixtures.length === 1000
      if (hasMore && fixtures.length > 0) {
        lastId = fixtures[fixtures.length - 1].fixture.id
      }
    }

    inflightCache.set(cacheKey, { data: all, timestamp: Date.now() })
    return all
  }

  async getLiveUpdates(): Promise<NormalizedMatch[]> {
    const all = await this.getFixtures()
    return all.filter((m) => m.status === 'live')
  }

  async getMatchDetail(externalId: number): Promise<NormalizedMatch | null> {
    const params = new URLSearchParams({ id: String(externalId) })
    const res = await fetch(`${BASE_URL}/fixtures?${params}&_cb=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'x-rapidapi-key': process.env.API_FOOTBALL_KEY!,
        'x-rapidapi-host': 'v3.football.api-sports.io',
      },
    })

    if (!res.ok) return null

    const json = await res.json()
    const fixtures: ApiFixture[] = json.response || []
    return fixtures.length > 0 ? parseFixture(fixtures[0]) : null
  }

  clearCache() {
    inflightCache.clear()
  }
}
