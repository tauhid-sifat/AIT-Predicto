import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import MatchCard from '@/components/match-card'
import FinishedMatches from '@/components/finished-matches'

export const dynamic = 'force-dynamic'

function sectionLabel(date: Date): string {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const dStr = date.toDateString()
  if (dStr === today.toDateString()) return 'Today'
  if (dStr === tomorrow.toDateString()) return 'Tomorrow'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function getDayKey(date: Date): string {
  return date.toDateString()
}

export default async function HomePage() {
  const supabase = createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .order('kickoff_time', { ascending: true })
    .limit(200)

  const now = new Date()

  // Prediction counts for hot match detection
  const { data: countData } = await admin.rpc('get_match_prediction_counts')
  const countMap = new Map<number, number>(
    (countData ?? []).map((c: any) => [c.match_id, Number(c.count)])
  )
  const counts = Array.from(countMap.values()).sort((a, b) => b - a)
  const hotThreshold = counts.length >= 4 ? counts[Math.floor(counts.length * 0.25)] : Infinity

  const live = (matches ?? []).filter((m) => m.status === 'live')
  const upcoming = (matches ?? []).filter(
    (m) => m.status === 'scheduled' && new Date(m.kickoff_time) > now
  )
  const finished = (matches ?? []).filter((m) => m.status === 'finished')

  // Group upcoming by day
  const groups = new Map<string, typeof upcoming>()
  for (const m of upcoming) {
    const key = getDayKey(new Date(m.kickoff_time))
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(m)
  }

  const sortedGroups = Array.from(groups.entries()).sort(
    (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
  )

  let predictionsMap = new Map<number, any>()
  if (user && matches) {
    const { data: predictions } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id)
      .in('match_id', matches.map((m) => m.id))

    for (const p of predictions ?? []) {
      predictionsMap.set(p.match_id, p)
    }
  }

  const isHot = (m: any) => {
    const count = countMap.get(m.id) ?? 0
    return count > 0 && count >= hotThreshold
  }

  let stats = null
  if (user) {
    const { data: userStats } = await admin.rpc('get_user_stats', { p_user_id: user.id })
    stats = userStats?.[0]
  }

  return (
    <div className="space-y-8">
      {stats && (stats.total_predictions ?? 0) > 0 && (
        <section className="grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[#714DFF]">{stats.total_predictions}</div>
            <div className="text-xs text-gray-500 mt-0.5">Predictions Made</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-white border border-green-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.correct_predictions}</div>
            <div className="text-xs text-gray-500 mt-0.5">Correct Picks</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.accuracy_percent}%</div>
            <div className="text-xs text-gray-500 mt-0.5">Accuracy</div>
          </div>
        </section>
      )}

      {/* Section A: Live */}
      {live.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-red-600 flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Live
          </h2>
          <div className="grid gap-3">
            {live.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                prediction={predictionsMap.get(m.id) ?? null}
                userId={user?.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Section B: Upcoming grouped by day */}
      {sortedGroups.length > 0 && (
        <>
          {sortedGroups.map(([dayKey, dayMatches]) => (
            <section key={dayKey}>
              <h2 className="text-lg font-bold text-gray-800 mb-3">
                {sectionLabel(new Date(dayKey))}
              </h2>
              <div className="grid gap-3">
                {dayMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    prediction={predictionsMap.get(m.id) ?? null}
                    userId={user?.id}
                    isHot={isHot(m)}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      {sortedGroups.length === 0 && live.length === 0 && (
        <section className="text-center py-12">
          <div className="text-4xl mb-3">&#x26BD;</div>
          <p className="text-gray-500 font-medium">No upcoming matches</p>
          <p className="text-gray-400 text-sm mt-1">Check back when matches are scheduled</p>
        </section>
      )}

      {/* Section C: Finished (collapsed by default) */}
      <FinishedMatches
        matches={finished}
        predictionsMap={predictionsMap}
        userId={user?.id}
      />
    </div>
  )
}
