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

export function resolveRound(round: string | null | undefined): { key: string; name: string } | null {
  if (round && ROUND_MAP[round]) {
    return { key: round, name: ROUND_MAP[round] }
  }
  return null
}

export function roundDisplayName(round: string | null | undefined): string | null {
  return resolveRound(round)?.name ?? null
}

export function roundKey(round: string | null | undefined): string | null {
  return resolveRound(round)?.key ?? null
}

export function roundIcon(round: string | null | undefined): string | null {
  const key = roundKey(round)
  return key ? (ROUND_ICONS_MAP[key] ?? null) : null
}

export function isKnockoutByRound(round: string | null | undefined): boolean {
  const key = roundKey(round)
  return key !== null && ROUND_ORDER_LIST.includes(key)
}

export function cleanTeamName(name: string): string {
  return name.startsWith('Round of 32') ? 'TBD' : name
}

export const ROUND_ORDER = ROUND_ORDER_LIST
export const ROUND_ICONS = ROUND_ICONS_MAP
