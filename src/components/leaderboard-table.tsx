'use client'

import { useEffect, useState } from 'react'
import { LeaderboardSkeleton } from './skeleton'
import PodiumSection from './podium-section'
import RivalZone from './rival-zone'
import MatchdayMvp from './matchday-mvp'
import RecentForm from './recent-form'

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

type RankChange = Record<string, number>
type FormResult = 'correct' | 'incorrect' | 'pending'
type MvpData = {
  user_id: string
  username: string
  points_gained: number
  correct_count: number
}

function getBadges(e: Entry): string[] {
  const b: string[] = []
  if (e.exact_score_count >= 10) b.push('Perfect Predictor')
  if (e.longest_streak >= 5) b.push('Streak Master')
  return b
}

const TIER_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32']
const TIER_BG = ['rgba(255,215,0,0.08)', 'rgba(192,192,192,0.08)', 'rgba(205,127,50,0.08)']

function getMedalStyle(entryPoints: number, uniquePoints: number[]) {
  const tier = uniquePoints.indexOf(entryPoints)
  if (tier < 0 || tier > 2) return null
  return {
    icon: ['\u{1F947}', '\u{1F948}', '\u{1F949}'][tier] as string,
    title: ['1st place', '2nd place', '3rd place'][tier] as string,
    color: TIER_COLORS[tier],
    bg: TIER_BG[tier],
  }
}

const slideIn = (i: number) => ({
  animation: `slideIn 0.35s ease-out ${i * 0.04}s both`,
})

export default function LeaderboardTable({ userId }: { userId?: string }) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [rankChanges, setRankChanges] = useState<RankChange>({})
  const [recentForm, setRecentForm] = useState<FormResult[]>([])
  const [mvp, setMvp] = useState<MvpData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = userId ? `?user_id=${userId}` : ''
    fetch(`/api/leaderboard${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.leaderboard ?? [])
        setRankChanges(data.rankChanges ?? {})
        setRecentForm(data.recentForm ?? [])
        setMvp(data.mvp ?? null)
      })
      .finally(() => setLoading(false))
  }, [userId])

  const withRank = (() => {
    let rank = 0
    let prev: number | null = null
    return entries.map((e, i) => {
      if (e.total_points !== prev) rank = i + 1
      prev = e.total_points
      return { ...e, displayRank: rank }
    })
  })()
  const uniquePoints = Array.from(new Set(entries.map((e) => e.total_points))).sort(
    (a, b) => b - a
  )
  const top3 = withRank.filter((e) => e.displayRank <= 3)
  const currentUserData = userId
    ? withRank.find((e) => e.user_id === userId) ?? null
    : null

  if (loading) return <LeaderboardSkeleton />

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">{'\u{1F3C6}'}</div>
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
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 4px rgba(59,130,246,0.15); }
          50% { box-shadow: 0 0 12px rgba(59,130,246,0.3); }
        }
        .rank-badge-gold { background: linear-gradient(135deg, #FFD700, #FFA500); }
        .rank-badge-silver { background: linear-gradient(135deg, #E8E8E8, #B0B0B0); }
        .rank-badge-bronze { background: linear-gradient(135deg, #FFB07C, #CD7F32); }
      `}</style>

      {mvp && (
        <div className="mb-6">
          <MatchdayMvp mvp={mvp} />
        </div>
      )}

      <PodiumSection top3={top3} rankChanges={rankChanges} />

      {currentUserData && (
        <div className="mb-6">
          <RivalZone currentUser={currentUserData} entries={withRank} />
        </div>
      )}

      <div className="space-y-2.5">
        {withRank.map((entry, idx) => {
          const isMe = entry.user_id === userId
          const badges = getBadges(entry)
          const medal = getMedalStyle(entry.total_points, uniquePoints)
          const change = rankChanges[entry.user_id]

          return (
            <div
              key={entry.user_id}
              style={slideIn(idx)}
              className={`relative rounded-xl border px-4 py-3.5 transition-all duration-200 ${
                isMe
                  ? 'border-blue-200 bg-gradient-to-r from-blue-50/90 to-white shadow-sm animate-[glow_2s_ease-in-out_infinite]'
                  : medal
                  ? `border-gray-100 bg-gradient-to-r ${medal.color}08 to-white shadow-sm`
                  : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Rank badge */}
                <div className="shrink-0 w-9 h-9 flex items-center justify-center">
                  {medal ? (
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
                      style={{ backgroundColor: medal.bg }}
                      title={medal.title}
                    >
                      {medal.icon}
                    </div>
                  ) : (
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold tabular-nums ${
                        entry.displayRank <= 3
                          ? 'text-white'
                          : entry.displayRank <= 10
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      {entry.displayRank}
                    </div>
                  )}
                </div>

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 text-sm truncate">
                      {entry.username}
                    </span>
                    {isMe && (
                      <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-medium shrink-0">
                        You
                      </span>
                    )}
                    {change !== undefined && change !== 0 && (
                      <span
                        className={`text-[11px] font-bold shrink-0 ${
                          change > 0 ? 'text-green-600' : 'text-red-500'
                        }`}
                      >
                        {change > 0 ? '\u25B2' : '\u25BC'} {Math.abs(change)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-400">
                      {entry.total_predictions} pred
                    </span>
                    <span className="text-xs text-gray-300">|</span>
                    <span
                      className={`text-xs font-medium ${
                        entry.accuracy_percent >= 70
                          ? 'text-green-600'
                          : entry.accuracy_percent >= 40
                          ? 'text-yellow-600'
                          : 'text-gray-400'
                      }`}
                    >
                      {entry.accuracy_percent}% acc
                    </span>
                    {entry.current_streak > 0 && (
                      <>
                        <span className="text-xs text-gray-300">|</span>
                        <span className="text-xs font-medium text-orange-600">
                          {'\u{1F525}'} {entry.current_streak}
                        </span>
                      </>
                    )}
                  </div>
                  {badges.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {badges.map((b) => (
                        <span
                          key={b}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 font-medium border border-purple-200/50"
                        >
                          {b === 'Perfect Predictor' ? '\u{1F3C6}' : '\u{1F525}'} {b}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Points */}
                <div className="shrink-0 text-right">
                  <div
                    className={`text-xl font-extrabold tabular-nums ${
                      medal ? '' : 'text-gray-800'
                    }`}
                    style={medal ? { color: medal.color } : {}}
                  >
                    {entry.total_points}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
