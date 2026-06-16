'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSending(true)

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })

    setSending(false)

    if (signInError) {
      setError(signInError.message)
      return
    }

    setSent(true)
  }

  const handleGitHub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${location.origin}/auth/confirm` },
    })
  }

  if (sent) {
    return (
      <div className="max-w-sm mx-auto mt-12 text-center">
        <h1 className="text-2xl font-bold mb-3">Check your email</h1>
        <p className="text-gray-500">
          We sent a magic link to <strong>{email}</strong>. Click it to sign in.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h1 className="text-2xl font-bold mb-6 text-center">Sign In</h1>

      <form onSubmit={handleMagicLink} className="flex flex-col gap-3 mb-4">
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border border-gray-300 rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={sending}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded py-2 text-sm font-medium transition-colors"
        >
          {sending ? 'Sending...' : 'Send Magic Link'}
        </button>
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </form>

      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-xs text-gray-400">
          <span className="bg-gray-50 px-2">or</span>
        </div>
      </div>

      <button
        onClick={handleGitHub}
        className="w-full border border-gray-300 hover:bg-gray-100 rounded py-2 text-sm font-medium transition-colors"
      >
        Continue with GitHub
      </button>
    </div>
  )
}
