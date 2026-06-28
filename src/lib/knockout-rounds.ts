const ROUND_MAP: Record<string, string> = {
  group: 'Group Stage',
  'round-of-32': 'Round of 32',
  'round-of-16': 'Round of 16',
  quarterfinals: 'Quarter-finals',
  semifinals: 'Semi-finals',
  'third-place': 'Third Place',
  final: 'Final',
}

const ROUND_ORDER_LIST = ['round-of-32', 'round-of-16', 'quarterfinals', 'semifinals', 'third-place', 'final']

const ROUND_ICONS_MAP: Record<string, string> = {
  'round-of-32': '\u{1F3B2}',
  'round-of-16': '\u{1F3E0}',
  quarterfinals: '\u{1F3AF}',
  semifinals: '\u{1F3C6}',
  'third-place': '\u{1F949}',
  final: '\u{1F3C6}',
}

// Fallback date ranges for matches without a stored round (legacy data)
const ROUND_DATES: { key: string; start: number[]; end: number[] }[] = [
  { key: 'round-of-32',  start: [2026, 6, 28], end: [2026, 7, 4, 6, 59] },
  { key: 'round-of-16',  start: [2026, 7, 4, 7], end: [2026, 7, 9] },
  { key: 'quarterfinals',start: [2026, 7, 9], end: [2026, 7, 14] },
  { key: 'semifinals',   start: [2026, 7, 14], end: [2026, 7, 19] },
  { key: 'third-place',  start: [2026, 7, 18], end: [2026, 7, 19] },
  { key: 'final',        start: [2026, 7, 19], end: [2026, 8, 1] },
]

function toDate(parts: number[]): Date {
  return new Date(parts[0], parts[1] - 1, parts[2], parts[3] ?? 0, parts[4] ?? 0)
}

function roundFromDate(kickoffTime: string): { key: string; name: string } | null {
  const d = new Date(kickoffTime)
  for (const r of ROUND_DATES) {
    if (d >= toDate(r.start) && d <= toDate(r.end)) {
      return { key: r.key, name: ROUND_MAP[r.key] }
    }
  }
  return null
}

export function resolveRound(round: string | null | undefined, kickoffTime: string): { key: string; name: string } | null {
  if (round && ROUND_MAP[round]) {
    return { key: round, name: ROUND_MAP[round] }
  }
  return roundFromDate(kickoffTime)
}

export function roundDisplayName(round: string | null | undefined, kickoffTime: string): string | null {
  return resolveRound(round, kickoffTime)?.name ?? null
}

export function roundKey(round: string | null | undefined, kickoffTime: string): string | null {
  return resolveRound(round, kickoffTime)?.key ?? null
}

export function roundIcon(round: string | null | undefined, kickoffTime: string): string | null {
  const key = roundKey(round, kickoffTime)
  return key ? (ROUND_ICONS_MAP[key] ?? null) : null
}

export function isKnockoutByRound(round: string | null | undefined, kickoffTime: string): boolean {
  const key = roundKey(round, kickoffTime)
  return key !== null && ROUND_ORDER_LIST.includes(key)
}

export function cleanTeamName(name: string): string {
  return name.startsWith('Round of 32') ? 'TBD' : name
}

export const ROUND_ORDER = ROUND_ORDER_LIST
export const ROUND_ICONS = ROUND_ICONS_MAP
