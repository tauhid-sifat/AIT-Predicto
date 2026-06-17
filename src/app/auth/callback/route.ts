import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function captureCookies(request: NextRequest) {
  const captured: { name: string; value: string; options?: { [key: string]: unknown } }[] = []
  const setAll = (cookiesToSet: typeof captured) => {
    cookiesToSet.forEach(({ name, value, options }) => {
      request.cookies.set(name, value)
      captured.push({ name, value, options })
    })
  }
  return { captured, setAll }
}

function applyCookies(response: NextResponse, captured: { name: string; value: string; options?: { [key: string]: unknown } }[]) {
  captured.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as any)
  })
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const { captured, setAll } = captureCookies(request)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => request.cookies.getAll(), setAll } }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`)
      applyCookies(response, captured)
      return response
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-failed`)
}
