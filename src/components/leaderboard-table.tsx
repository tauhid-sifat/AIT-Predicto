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
  if (e.accuracy_percent >= 70) b.push('Consistent Player')
  return b
}

function RankDisplay({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl" title="1st place">&#127942;</span>
  if (rank === 2) return <span className="text-xl" title="2nd place">&#129352;</span>
  if (rank === 3) return <span className="text-xl" title="3rd place">&#129353;</span>
  return <span className="text-gray-400 font-medium tabular-nums">{rank}</span>
}

type RankChange = Record<string, number>

function RankMovement({ change }: { change: number | undefined }) {
  if (change === undefined || change === 0) return <span className="text-gray-300">&mdash;</span>
  if (change > 0) return <span className="text-green-600 font-semibold" title={`Up ${change}`}>&#9650; {change}</span>
  return <span className="text-red-500 font-semibold" title={`Down ${Math.abs(change)}`}>&#9660; {Math.abs(change)}</span>
}

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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-400 uppercase text-[11px] tracking-wider font-semibold">
            <th className="py-3 px-2 text-left w-12">#</th>
            <th className="py-3 px-2 text-left">User</th>
            <th className="py-3 px-2 text-center w-14 hidden sm:table-cell"></th>
            <th className="py-3 px-2 text-right w-14">Pts</th>
            <th className="py-3 px-2 text-right w-14 hidden sm:table-cell">Acc</th>
            <th className="py-3 px-2 text-right w-14 hidden sm:table-cell">Streak</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const rank = entry.rank
            const isTop3 = rank <= 3
            const isMe = entry.user_id === userId
            const badges = getBadges(entry)

            return (
              <tr
                key={entry.user_id}
                className={`border-b border-gray-100 transition-colors ${
                  isMe ? 'bg-blue-50' : isTop3 ? 'bg-yellow-50/50' : 'hover:bg-gray-50'
                }`}
              >
                <td className="py-3 px-2">
                  <RankDisplay rank={rank} />
                </td>
                <td className="py-3 px-2 text-center hidden sm:table-cell">
                  <RankMovement change={rankChanges[entry.user_id]} />
                </td>
                <td className="py-3 px-2">
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
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium leading-none"
                        >
                          {b === 'Perfect Predictor'
                            ? '\u{1F3C6}'
                            : b === 'Streak Master'
                            ? '\u{1F525}'
                            : '\u{1F3AF}'}{' '}
                          {b}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="py-3 px-2 text-right font-extrabold text-gray-900 tabular-nums text-base">
                  {entry.total_points}
                </td>
                <td className="py-3 px-2 text-right tabular-nums hidden sm:table-cell">
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
                          style={{ width: `${entry.accuracy_percent}%` }}
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
                <td className="py-3 px-2 text-right tabular-nums hidden sm:table-cell">
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
  )
}
