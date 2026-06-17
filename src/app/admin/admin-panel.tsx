'use client'

import { useState } from 'react'

type Metrics = {
  totalUsers: number | null
  totalPredictions: number | null
  finishedMatches: number | null
  pendingMatches: number
}

type ReminderStatus = {
  lastRun: string | null
  sent: number
  skipped: number
  errors: number
  timestamp: string
}

export default function AdminPanel({
  state,
  metrics,
  reminderStatus,
}: {
  state: Map<string, string>
  metrics: Metrics
  reminderStatus: ReminderStatus | null
}) {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const [reminding, setReminding] = useState(false)
  const [reminderResult, setReminderResult] = useState<string | null>(null)

  const handleSync = async () => {
    setSyncing(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/sync', { method: 'POST' })
      const data = await res.json()
      setResult(res.ok
        ? `OK — synced ${data.synced}, finished ${data.finished} (source: ${data.source})`
        : `Error: ${data.error}`)
    } catch (err: any) {
      setResult(`Error: ${err.message}`)
    } finally {
      setSyncing(false)
    }
  }

  const handleTestReminder = async () => {
    setReminding(true)
    setReminderResult(null)
    try {
      const res = await fetch('/api/reminders/send', { method: 'POST' })
      const data = await res.json()
      setReminderResult(res.ok
        ? `OK — sent ${data.sent}, skipped ${data.skipped}${data.errors.length ? `, ${data.errors.length} errors` : ''}`
        : `Error: ${data.error}`)
    } catch (err: any) {
      setReminderResult(`Error: ${err.message}`)
    } finally {
      setReminding(false)
    }
  }

  return (
    <>
      <section className="grid gap-6 md:grid-cols-4">
        <div className="border rounded p-4 text-center">
          <div className="text-2xl font-bold">{metrics.totalUsers ?? '?'}</div>
          <div className="text-xs text-gray-500 mt-1">Total Users</div>
        </div>
        <div className="border rounded p-4 text-center">
          <div className="text-2xl font-bold">{metrics.totalPredictions ?? '?'}</div>
          <div className="text-xs text-gray-500 mt-1">Predictions</div>
        </div>
        <div className="border rounded p-4 text-center">
          <div className="text-2xl font-bold">{metrics.finishedMatches ?? '?'}</div>
          <div className="text-xs text-gray-500 mt-1">Matches Finished</div>
        </div>
        <div className="border rounded p-4 text-center">
          <div className={`text-2xl font-bold ${metrics.pendingMatches > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {metrics.pendingMatches}
          </div>
          <div className="text-xs text-gray-500 mt-1">Pending Scoring</div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="border rounded p-4 space-y-2">
          <h2 className="font-semibold">System Health</h2>
          <dl className="text-sm space-y-1">
            <HealthRow label="Last sync" value={state.get('last_successful_sync_time') ?? 'never'} />
            <HealthRow label="Last scoring" value={state.get('last_scoring_run_time') ?? 'never'} />
            <HealthRow label="Total syncs" value={state.get('total_sync_count') ?? '0'} />
            <HealthRow label="Failed syncs" value={state.get('failed_sync_count') ?? '0'} />
          </dl>
        </div>

        <div className="border rounded p-4 space-y-3">
          <h2 className="font-semibold">Actions</h2>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-blue-700 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm transition-colors"
          >
            {syncing ? 'Syncing...' : 'Sync Matches Now'}
          </button>
          <button
            onClick={handleTestReminder}
            disabled={reminding}
            className="bg-purple-700 hover:bg-purple-600 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm transition-colors ml-2"
          >
            {reminding ? 'Sending...' : 'Test Reminder'}
          </button>
          {result && (
            <p className={`text-sm ${result.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>
              {result}
            </p>
          )}
          {reminderResult && (
            <p className={`text-sm ${reminderResult.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>
              {reminderResult}
            </p>
          )}
        </div>
      </section>

      {reminderStatus && (
        <section className="border rounded p-4 space-y-2">
          <h2 className="font-semibold">Last Reminder Run</h2>
          <dl className="text-sm space-y-1">
            <HealthRow label="Ran at" value={reminderStatus.lastRun ? new Date(reminderStatus.lastRun).toISOString().slice(0, 19).replace('T', ' ') : 'never'} />
            <HealthRow label="Sent" value={String(reminderStatus.sent)} />
            <HealthRow label="Skipped" value={String(reminderStatus.skipped)} />
            <HealthRow label="Errors" value={String(reminderStatus.errors)} />
          </dl>
        </section>
      )}
    </>
  )
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-mono text-xs">{value}</dd>
    </div>
  )
}
