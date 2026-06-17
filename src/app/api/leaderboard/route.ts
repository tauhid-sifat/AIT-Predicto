import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { getState } from '@/lib/system-state'

const getCachedLeaderboard = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('get_leaderboard_extended')
    if (error) throw new Error(error.message)
    return data ?? []
  },
  ['leaderboard-extended'],
  { tags: ['leaderboard'], revalidate: false }
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const weekly = searchParams.get('weekly') === 'true'
  const userId = searchParams.get('user_id')

  if (weekly) {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('get_leaderboard_weekly')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ leaderboard: data ?? [] })
  }

  let data
  try {
    data = await getCachedLeaderboard()
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  // Compute rank changes from previous snapshot
  const snapshotJson = await getState('leaderboard_snapshot')
  let rankChanges: Record<string, number> = {}
  if (snapshotJson) {
    const snapshot = JSON.parse(snapshotJson) as { user_id: string; rank: number }[]
    const prevRanks = new Map(snapshot.map((e) => [e.user_id, e.rank]))
    for (const entry of data) {
      const prev = prevRanks.get(entry.user_id)
      rankChanges[entry.user_id] = prev ? prev - entry.rank : 0
    }
  }

  let stats = null
  if (userId) {
    const supabase = createAdminClient()
    const { data: userStats } = await supabase.rpc('get_user_stats', { p_user_id: userId })
    stats = userStats?.[0] ?? null
  }

  return NextResponse.json({ leaderboard: data, rankChanges, stats })
}
