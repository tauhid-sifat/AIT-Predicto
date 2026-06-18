'use client'

type Entry = {
  user_id: string
  username: string
  total_points: number
  total_predictions: number
  correct_predictions: number
  accuracy_percent: number
  current_streak: number
  exact_score_count: number
}

type RankChange = Record<string, number>

const MEDAL_ICONS = ['\u{1F947}', '\u{1F948}', '\u{1F949}']
const PODIUM_BG = ['from-yellow-200/20', 'from-gray-200/20', 'from-orange-200/20']
const PODIUM_BORDER = ['border-yellow-300', 'border-gray-300', 'border-orange-300']

export default function PodiumSection({
  top3,
  rankChanges,
}: {
  top3: Entry[]
  rankChanges: RankChange
}) {
  if (top3.length === 0) return null

  const displayOrder = top3.length === 3 ? [1, 0, 2] : [0, 1, 2]

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-5 mb-8">
      {displayOrder.map((idx, position) => {
        if (idx >= top3.length) return null
        const entry = top3[idx]
        const isGold = idx === 0
        const change = rankChanges[entry.user_id]
        const orderClass = position === 0 ? 'order-1' : position === 1 ? 'order-2 scale-110 z-10' : 'order-3'

        return (
          <div
            key={entry.user_id}
            className={`flex flex-col items-center ${orderClass}`}
          >
            <div className="text-3xl sm:text-4xl mb-1">{MEDAL_ICONS[idx]}</div>
            <div
              className={`relative rounded-2xl border-2 ${PODIUM_BORDER[idx]} bg-gradient-to-b ${PODIUM_BG[idx]} to-white p-4 sm:p-5 text-center min-w-[120px] sm:min-w-[140px] shadow-md ${
                isGold ? 'shadow-yellow-200/50' : ''
              }`}
            >
              <div className="text-lg sm:text-xl font-extrabold text-gray-900 tabular-nums">
                {entry.total_points}
              </div>
              <div className="text-sm font-semibold text-gray-800 mt-0.5 truncate max-w-[100px]">
                {entry.username}
              </div>
              {change !== undefined && change !== 0 && (
                <div
                  className={`text-[11px] font-bold mt-0.5 ${
                    change > 0 ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {change > 0 ? '\u25B2' : '\u25BC'} {Math.abs(change)}
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">
                {entry.accuracy_percent}% acc
              </div>
            </div>
            <div
              className={`mt-2 text-xs font-medium ${isGold ? 'text-amber-500 font-semibold' : 'text-gray-400'}`}
            >
              {idx === 0 ? '1st Place' : idx === 1 ? '2nd Place' : '3rd Place'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
