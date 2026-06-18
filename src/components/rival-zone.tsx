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
  displayRank: number
}

export default function RivalZone({
  currentUser,
  entries,
}: {
  currentUser: { user_id: string; displayRank: number; total_points: number }
  entries: Entry[]
}) {
  const myIdx = entries.findIndex((e) => e.user_id === currentUser.user_id)
  if (myIdx < 0) return null

  const rivals: Entry[] = []
  if (myIdx > 0) rivals.push(entries[myIdx - 1])
  if (myIdx < entries.length - 1) rivals.push(entries[myIdx + 1])

  if (rivals.length === 0) return null

  const ptsDiff = (rival: Entry) => Math.abs(currentUser.total_points - rival.total_points)

  return (
    <div className="bg-gradient-to-r from-indigo-50/60 to-purple-50/60 rounded-xl border border-indigo-100 p-4 sm:p-5">
      <h3 className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <span>{'\u26E9'}</span> Rival Zone
      </h3>
      <div className="flex items-center gap-3 sm:gap-4">
        {rivals.map((rival) => {
          const ahead = rival.total_points > currentUser.total_points
          return (
            <div
              key={rival.user_id}
              className="flex-1 bg-white/80 rounded-lg border border-indigo-100/80 px-3 py-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-gray-900">{rival.username}</span>
                <span className="text-xs text-gray-400">#{rival.displayRank}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-lg font-extrabold tabular-nums text-gray-800">
                  {rival.total_points}
                </span>
                <span
                  className={`text-xs font-bold ${ahead ? 'text-red-500' : 'text-green-600'}`}
                >
                  {ahead ? '-' : '+'}
                  {ptsDiff(rival)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
