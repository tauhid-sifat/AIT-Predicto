'use client'

import { useEffect, useState } from 'react'

type Stats = {
  total_predictions: number
  correct_predictions: number
  accuracy_percent: number
  current_streak: number
  longest_streak: number
  exact_score_count: number
} | null

export default function UserProfile({ userId }: { userId: string }) {
  const [stats, setStats] = useState<Stats>(null)

  useEffect(() => {
    fetch(`/api/leaderboard?user_id=${userId}`)
      .then((r) => r.json())
      .then((data) => setStats(data.stats))
  }, [userId])

  if (!stats || stats.total_predictions === 0) return null

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
      <h2 className="text-sm font-semibold text-blue-800 mb-3">Your Stats</h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div>
          <div className="text-xs text-blue-600">Accuracy</div>
          <div className="text-xl font-bold text-blue-900">
            {stats.accuracy_percent}%
          </div>
        </div>
        <div>
          <div className="text-xs text-blue-600">Predictions</div>
          <div className="text-xl font-bold text-blue-900">
            {stats.total_predictions}
          </div>
        </div>
        <div>
          <div className="text-xs text-blue-600">Correct</div>
          <div className="text-xl font-bold text-green-600">
            {stats.correct_predictions}
          </div>
        </div>
        <div>
          <div className="text-xs text-blue-600">Streak</div>
          <div className="text-xl font-bold text-orange-600">
            {stats.current_streak}
          </div>
        </div>
        <div>
          <div className="text-xs text-blue-600">Exact Scores</div>
          <div className="text-xl font-bold text-purple-600">
            {stats.exact_score_count}
          </div>
        </div>
      </div>
    </div>
  )
}
