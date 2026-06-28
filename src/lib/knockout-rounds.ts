const ROUNDS: { key: string; name: string; start: [number, number]; end: [number, number] }[] = [
  { key: 'round-of-32',  name: 'Round of 32',     start: [6, 28], end: [7, 3] },
  { key: 'round-of-16',  name: 'Round of 16',     start: [7, 4],  end: [7, 7] },
  { key: 'quarterfinals',name: 'Quarter-finals',   start: [7, 9],  end: [7, 10] },
  { key: 'semifinals',   name: 'Semi-finals',      start: [7, 14], end: [7, 15] },
  { key: 'third-place',  name: 'Third Place',      start: [7, 18], end: [7, 18] },
  { key: 'final',        name: 'Final',            start: [7, 19], end: [7, 19] },
]

function toDate(m: number, d: number): Date {
  return new Date(2026, m - 1, d)
}

function matchRound(kickoffTime: string) {
  const d = new Date(kickoffTime)
  for (const r of ROUNDS) {
    if (d >= toDate(r.start[0], r.start[1]) && d <= toDate(r.end[0], r.end[1])) {
      return r
    }
  }
  return null
}

export function getKnockoutRound(kickoffTime: string): string | null {
  return matchRound(kickoffTime)?.name ?? null
}

export function getKnockoutRoundKey(kickoffTime: string): string | null {
  return matchRound(kickoffTime)?.key ?? null
}

export function isKnockout(kickoffTime: string): boolean {
  return matchRound(kickoffTime) !== null
}

export const ROUND_ORDER = ['round-of-32', 'round-of-16', 'quarterfinals', 'semifinals', 'third-place', 'final']

export function cleanTeamName(name: string): string {
  return name.startsWith('Round of 32') ? 'TBD' : name
}
