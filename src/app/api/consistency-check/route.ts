import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getState, incrementCounter } from '@/lib/system-state'
import { logEvent } from '@/lib/sync-logger'

export async function GET(request: NextRequest) {
  if (request.headers.get('x-sync-secret') !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Run consistency checks
  const { data: issues } = await supabase.rpc('check_data_consistency')

  // Gather system state
  const [lastSync, lastScoring, syncCount, failCount, cursor] = await Promise.all([
    getState('last_successful_sync_time'),
    getState('last_scoring_run_time'),
    getState('total_sync_count'),
    getState('failed_sync_count'),
    getState('last_sync_cursor'),
  ])

  logEvent('consistency_check', {
    issuesFound: (issues ?? []).length,
  })

  await incrementCounter('consistency_check_count')

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    state: {
      last_successful_sync_time: lastSync,
      last_scoring_run_time: lastScoring,
      total_sync_count: syncCount ? parseInt(syncCount, 10) : 0,
      failed_sync_count: failCount ? parseInt(failCount, 10) : 0,
      last_sync_cursor: cursor ? parseInt(cursor, 10) : null,
    },
    issues: issues ?? [],
  })
}
