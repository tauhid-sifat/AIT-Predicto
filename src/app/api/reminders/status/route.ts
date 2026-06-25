import { NextRequest, NextResponse } from 'next/server'
import { getState } from '@/lib/system-state'

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-sync-secret')
  if (secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const lastRun = await getState('reminder_last_run')
  const summary = await getState('reminder_last_summary')

  return NextResponse.json({
    lastRun,
    summary: summary ? JSON.parse(summary) : null,
  })
}
