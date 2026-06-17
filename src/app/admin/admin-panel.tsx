'use client'

import { useState } from 'react'

type Metrics = {
  totalUsers: number | null
  totalPredictions: number | null
  finishedMatches: number | null
  pendingMatches: number
}

export default function AdminPanel({ state, metrics }: { state: Map<string, string>; metrics: Metrics }) {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

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

  return (
    <>
      <section className="grid gap-6 md:grid-cols-3">
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
          {result && (
            <p className={`text-sm ${result.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>
              {result}
            </p>
          )}
        </div>
      </section>
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
