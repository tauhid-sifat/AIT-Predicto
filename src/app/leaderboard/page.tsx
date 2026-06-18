import { createClient } from '@/lib/supabase-server'
import LeaderboardTable from '@/components/leaderboard-table'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
      </div>

      <LeaderboardTable userId={user?.id} />
    </div>
  )
}
