'use client'

import { useState } from 'react'

export default function AdminPanel({ state }: { state: Map<string, string> }) {
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
