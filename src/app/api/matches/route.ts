import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request)
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })
  }
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    }
  )

  let query = supabase.from('matches').select('*')

  if (status === 'upcoming') {
    query = query
      .in('status', ['scheduled'])
      .gt('kickoff_time', new Date().toISOString())
  } else if (status === 'finished') {
    query = query.eq('status', 'finished')
  } else if (status === 'live') {
    query = query.eq('status', 'live')
  }

  query = query.order('kickoff_time', { ascending: true }).limit(200)

  const { data: matches, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ matches })
}
