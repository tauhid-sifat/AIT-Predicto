'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import { useEffect, useState } from 'react'

export default function Header() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  useEffect(() => {
    if (user) {
      fetch('/api/admin/check').then(r => r.json()).then(d => setIsAdmin(d.isAdmin))
    }
  }, [user])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/')
    router.refresh()
  }

  return (
    <header className="bg-blue-900 text-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">
          World Cup Predictor
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="hover:text-blue-200 transition-colors">
            Matches
          </Link>
          <Link href="/leaderboard" className="hover:text-blue-200 transition-colors">
            Leaderboard
          </Link>

          {isAdmin && (
            <Link href="/admin" className="hover:text-yellow-200 text-yellow-300 transition-colors">
              Admin
            </Link>
          )}

          {user ? (
            <button
              onClick={handleSignOut}
              className="bg-blue-700 hover:bg-blue-600 px-3 py-1.5 rounded text-sm transition-colors"
            >
              Sign Out
            </button>
          ) : (
            <Link
              href="/login"
              className="bg-blue-700 hover:bg-blue-600 px-3 py-1.5 rounded text-sm transition-colors"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
