import { createClient } from '@/lib/supabase-server'
import LeaderboardTable from '@/components/leaderboard-table'
import UserProfile from '@/components/user-profile'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
      </div>

      {user && <UserProfile userId={user.id} />}

      <LeaderboardTable userId={user?.id} />
    </div>
  )
}
