'use client'

type MvpData = {
  user_id: string
  username: string
  points_gained: number
  correct_count: number
}

export default function MatchdayMvp({ mvp }: { mvp: MvpData | null }) {
  if (!mvp) return null

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <div className="text-3xl sm:text-4xl shrink-0">{'\u{1F3C6}'}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
            Matchday MVP
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-lg font-bold text-gray-900 truncate">
              {mvp.username}
            </span>
            <span className="text-sm font-semibold text-amber-600 whitespace-nowrap">
              +{mvp.points_gained} pts
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {mvp.correct_count} correct prediction{mvp.correct_count !== 1 ? 's' : ''} this round
          </div>
        </div>
      </div>
    </div>
  )
}
