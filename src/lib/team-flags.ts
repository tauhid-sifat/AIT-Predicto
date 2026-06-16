const teamFlags: Record<string, string> = {
  Algeria: 'dz', Angola: 'ao', Argentina: 'ar', Australia: 'au', Austria: 'at',
  Belgium: 'be', 'Bosnia-Herzegovina': 'ba', Brazil: 'br', Cameroon: 'cm',
  Canada: 'ca', 'Cape Verde': 'cv', Colombia: 'co', 'Congo DR': 'cd',
  'Ivory Coast': 'ci', Croatia: 'hr', Curaçao: 'cw', Czechia: 'cz',
  Denmark: 'dk', Ecuador: 'ec', Egypt: 'eg', England: 'gb-eng',
  France: 'fr', Germany: 'de', Ghana: 'gh', Haiti: 'ht', Iran: 'ir',
  Iraq: 'iq', Italy: 'it', Japan: 'jp', Jordan: 'jo', Mexico: 'mx',
  Morocco: 'ma', Netherlands: 'nl', 'New Zealand': 'nz', Nigeria: 'ng',
  Norway: 'no', Panama: 'pa', Paraguay: 'py', Poland: 'pl', Portugal: 'pt',
  Qatar: 'qa', Romania: 'ro', 'Saudi Arabia': 'sa', Scotland: 'gb-sct',
  Senegal: 'sn', Serbia: 'rs', 'South Africa': 'za', 'South Korea': 'kr',
  Spain: 'es', Sweden: 'se', Switzerland: 'ch', Tunisia: 'tn',
  Türkiye: 'tr', 'United States': 'us', Uruguay: 'uy', Uzbekistan: 'uz',
  Wales: 'gb-wls',
}

const flagCache = new Map<string, string>()

const FALLBACK_FLAG = '' // empty string = no image rendered

export function getFlagUrl(teamName: string): string {
  const cached = flagCache.get(teamName)
  if (cached !== undefined) return cached

  const code = teamFlags[teamName]
  if (!code) {
    flagCache.set(teamName, FALLBACK_FLAG)
    return FALLBACK_FLAG
  }

  const url = `https://flagcdn.com/16x12/${code}.png`
  flagCache.set(teamName, url)
  return url
}

export function getFlagSrcset(teamName: string): string {
  const code = teamFlags[teamName]
  if (!code) return ''

  return `https://flagcdn.com/16x12/${code}.png 1x, https://flagcdn.com/32x24/${code}.png 2x`
}
