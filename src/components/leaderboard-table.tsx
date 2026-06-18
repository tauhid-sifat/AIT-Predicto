'use client'

import { useEffect, useState } from 'react'
import { LeaderboardSkeleton } from './skeleton'

type Entry = {
  user_id: string
  username: string
  total_points: number
  rank: number
  total_predictions: number
  correct_predictions: number
  accuracy_percent: number
  current_streak: number
  longest_streak: number
  exact_score_count: number
}

function getBadges(e: Entry): string[] {
  const b: string[] = []
  if (e.exact_score_count >= 10) b.push('Perfect Predictor')
  if (e.longest_streak >= 5) b.push('Streak Master')
  return b
}

const TIER_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32']

function getMedal(index: number, uniquePoints: number[], entryPoints: number): { icon: string; title: string; color: string } | null {
  const tier = uniquePoints.indexOf(entryPoints)
  if (tier < 0 || tier > 2) return null
  const icons = ['&#127942;', '&#129352;', '&#129353;']
  const titles = ['1st place', '2nd place', '3rd place']
  return { icon: icons[tier], title: titles[tier], color: TIER_COLORS[tier] }
}

type RankChange = Record<string, number>

function RankMovement({ change }: { change: number | undefined }) {
  if (change === undefined || change === 0) return <span className="text-gray-300">&mdash;</span>
  if (change > 0) return <span className="text-green-600 font-semibold" title={`Up ${change}`}>&#9650; {change}</span>
  return <span className="text-red-500 font-semibold" title={`Down ${Math.abs(change)}`}>&#9660; {Math.abs(change)}</span>
}

const slideIn = (i: number) => ({
  animation: `slideIn 0.35s ease-out ${i * 0.04}s both`,
})

export default function LeaderboardTable({ userId }: { userId?: string }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [rankChanges, setRankChanges] = useState<RankChange>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.leaderboard ?? [])
        setRankChanges(data.rankChanges ?? {})
      })
      .finally(() => setLoading(false))
  }, [])

  // Compute proper tied ranks (DB uses ROW_NUMBER, we fix ties client-side)
  const withRank = (() => {
    let rank = 0
    let prev: number | null = null
    return entries.map((e, i) => {
      if (e.total_points !== prev) rank = i + 1
      prev = e.total_points
      return { ...e, displayRank: rank }
    })
  })()
  const uniquePoints = Array.from(new Set(entries.map((e) => e.total_points))).sort((a, b) => b - a)

  if (loading) {
    return <LeaderboardSkeleton />
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">&#x1F3C6;</div>
        <p className="text-gray-500 font-medium">No predictions yet</p>
        <p className="text-gray-400 text-sm mt-1">Be the first to predict a match!</p>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400 uppercase text-[11px] tracking-wider font-semibold bg-gray-50/80">
              <th className="py-3 px-3 text-left w-14">#</th>
              <th className="py-3 px-3 text-left">User</th>
              <th className="py-3 px-3 text-center w-14 hidden sm:table-cell"></th>
              <th className="py-3 px-3 text-right w-16">Pts</th>
              <th className="py-3 px-3 text-right w-16 hidden sm:table-cell">Acc</th>
              <th className="py-3 px-3 text-right w-16 hidden sm:table-cell">Streak</th>
            </tr>
          </thead>
          <tbody>
            {withRank.map((entry, idx) => {
              const isMe = entry.user_id === userId
              const badges = getBadges(entry)
              const medal = getMedal(idx, uniquePoints, entry.total_points)

              return (
                <tr
                  key={entry.user_id}
                  style={slideIn(idx)}
                  className={`border-b border-gray-100 transition-all duration-200 ${
                    isMe
                      ? 'bg-gradient-to-r from-blue-50/80 to-white'
                      : medal
                      ? 'bg-gradient-to-r from-yellow-50/40 to-white'
                      : 'hover:bg-gray-50/60'
                  }`}
                >
                  <td className="py-3 px-3">
                    {medal ? (
                      <div className="flex items-center justify-center w-8 h-8 rounded-full" style={{ backgroundColor: medal.color + '25' }}>
                        <span className="text-lg leading-none" dangerouslySetInnerHTML={{ __html: medal.icon }} title={medal.title} />
                      </div>
                    ) : (
                      <span className="text-gray-400 font-medium tabular-nums ml-1.5">{entry.displayRank}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center hidden sm:table-cell">
                    <RankMovement change={rankChanges[entry.user_id]} />
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-900">{entry.username}</span>
                      {isMe && (
                        <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-medium">
                          You
                        </span>
                      )}
                    </div>
                    {badges.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {badges.map((b) => (
                          <span
                            key={b}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 font-medium leading-none border border-purple-200/50"
                          >
                            {b === 'Perfect Predictor' ? '\u{1F3C6}' : '\u{1F525}'} {b}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={`font-extrabold tabular-nums text-lg ${medal ? 'text-gray-900' : 'text-gray-700'}`}
                      style={medal ? { color: medal.color, textShadow: medal ? `0 0 12px ${medal.color}40` : undefined } : {}}>
                      {entry.total_points}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums hidden sm:table-cell">
                    {entry.total_predictions > 0 ? (
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              entry.accuracy_percent >= 70
                                ? 'bg-green-500'
                                : entry.accuracy_percent >= 40
                                ? 'bg-yellow-500'
                                : 'bg-gray-300'
                            }`}
                            style={{ width: `${Math.min(entry.accuracy_percent, 100)}%` }}
                          />
                        </div>
                        <span
                          className={`text-xs font-semibold ${
                            entry.accuracy_percent >= 70
                              ? 'text-green-600'
                              : entry.accuracy_percent >= 40
                              ? 'text-yellow-600'
                              : 'text-gray-400'
                          }`}
                        >
                          {entry.accuracy_percent}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-300">&mdash;</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums hidden sm:table-cell">
                    {entry.current_streak > 0 ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-orange-600">
                        <span className="text-xs">{'\u{1F525}'}</span>
                        {entry.current_streak}
                      </span>
                    ) : (
                      <span className="text-gray-300">&mdash;</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
