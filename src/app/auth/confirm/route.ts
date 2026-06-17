import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
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
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  if (token_hash && type) {
    const { captured, setAll } = captureCookies(request)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => request.cookies.getAll(), setAll } }
    )

    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      const response = NextResponse.redirect(new URL(next, request.url))
      applyCookies(response, captured)
      return response
    }
  }

  return NextResponse.redirect(new URL('/login?error=auth-failed', request.url))
}

export async function POST(request: NextRequest) {
  const { captured, setAll } = captureCookies(request)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll } }
  )

  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return NextResponse.redirect(new URL('/login?error=missing-fields', request.url))
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${error.message}`, request.url))
  }

  const response = NextResponse.redirect(new URL('/', request.url))
  applyCookies(response, captured)
  return response
}
