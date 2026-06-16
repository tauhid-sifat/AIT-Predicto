'use client'

import { useState } from 'react'
import MatchCard from './match-card'

type Match = {
  id: number
  kickoff_time: string
  home_team: string
  away_team: string
  home_score: number | null
  away_score: number | null
  status: string
}

export default function FinishedMatches({
  matches,
  predictionsMap,
  userId,
}: {
  matches: Match[]
  predictionsMap: Map<number, any>
  userId?: string
}) {
  const [open, setOpen] = useState(false)
  if (matches.length === 0) return null

  return (
    <section>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left mb-4"
      >
        <h2 className="text-xl font-bold">Recent Results</h2>
        <span className="text-sm text-gray-500 transition-transform duration-200">
          {open ? '\u25B2' : '\u25BC'}
        </span>
      </button>
      {open && (
        <div className="grid gap-3">
          {matches.slice(-10).reverse().map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              prediction={predictionsMap.get(m.id) ?? null}
              userId={userId}
            />
          ))}
        </div>
      )}
      {!open && (
        <p className="text-sm text-gray-400">{matches.length} finished match(es)</p>
      )}
    </section>
  )
}
