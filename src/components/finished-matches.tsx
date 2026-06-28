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
  round?: string | null
}

export default function FinishedMatches({
  matches,
  predictionsMap,
  userId,
}: {
  matches: Match[]
  predictionsMap: Record<number, any>
  userId?: string
}) {
  const [showAll, setShowAll] = useState(false)
  if (matches.length === 0) return null

  const latest = matches.slice(-5).reverse()
  const displayed = showAll ? matches.slice(-10).reverse() : latest

  return (
    <section>
      <button
        onClick={() => setShowAll(!showAll)}
        className="flex items-center justify-between w-full text-left mb-4"
      >
        <h2 className="text-xl font-bold">Recent Results</h2>
        <span className="text-sm text-gray-500 transition-transform duration-200">
          {showAll ? '\u25B2' : '\u25BC'}
        </span>
      </button>
      <div className="grid gap-3">
        {displayed.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            prediction={predictionsMap[m.id] ?? null}
            userId={userId}
          />
        ))}
      </div>
      {!showAll && matches.length > 5 && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium py-2 rounded-lg bg-blue-50/50 hover:bg-blue-100/50 transition-colors"
        >
          Show all {matches.length} results
        </button>
      )}
    </section>
  )
}
