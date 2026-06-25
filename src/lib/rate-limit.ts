const WINDOW_MS = 60_000
const MAX_REQUESTS = 60

const ipHits = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(request: Request): { ok: boolean; retryAfter?: number } {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown'
  const now = Date.now()

  let entry = ipHits.get(ip)
  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS }
    ipHits.set(ip, entry)
    return { ok: true }
  }

  entry.count++
  if (entry.count > MAX_REQUESTS) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
  }

  return { ok: true }
}
