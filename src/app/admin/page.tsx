import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'
import { redirect } from 'next/navigation'
import AdminPanel from './admin-panel'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, username')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) redirect('/')

  const admin = createAdminClient()

  const { data: stateRows } = await admin
    .from('system_state')
    .select('key, value')

  const { data: logs } = await admin
    .from('sync_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(25)

  const state = new Map<string, string>((stateRows ?? []).map(r => [r.key, r.value]))

  const { count: totalUsers } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
  const { count: totalPredictions } = await admin
    .from('predictions')
    .select('*', { count: 'exact', head: true })
  const { count: finishedMatches } = await admin
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'finished')

  const { data: pendingData } = await admin
    .from('predictions')
    .select('match_id')
    .is('points', null)
  const pendingMatches = new Set((pendingData ?? []).map((p: any) => p.match_id)).size

  const metrics = { totalUsers, totalPredictions, finishedMatches, pendingMatches }

  const reminderLastRun = state.get('reminder_last_run') ?? null
  const reminderSummary = state.get('reminder_last_summary')
  const reminderStatus = reminderSummary ? { ...JSON.parse(reminderSummary), lastRun: reminderLastRun } : null

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <span className="text-sm text-gray-500">Signed in as {profile.username}</span>
      </div>

      <AdminPanel state={state} metrics={metrics} reminderStatus={reminderStatus} />

      <section>
        <h2 className="text-lg font-bold mb-3">Recent Sync Logs</h2>
        <div className="bg-gray-900 text-green-300 text-xs font-mono rounded p-4 max-h-96 overflow-y-auto space-y-1">
          {(logs ?? []).length === 0 ? (
            <span className="text-gray-500">No logs yet</span>
          ) : (
            (logs ?? []).map((log: any) => (
              <div key={log.id}>
                <span className="text-gray-500">{new Date(log.created_at).toISOString().slice(11, 19)}</span>
                {' '}
                <span className={
                  log.event === 'sync_failed' ? 'text-red-400' :
                  log.event === 'sync_completed' ? 'text-green-400' :
                  'text-blue-300'
                }>{log.event}</span>
                {log.details && <span className="text-gray-400"> {JSON.stringify(log.details)}</span>}
              </div>
            ))
          )}
        </div>
      </section>

      <div className="flex gap-4 text-sm">
        <Link href="/" className="text-blue-600 hover:underline">← Back to matches</Link>
      </div>
    </div>
  )
}
