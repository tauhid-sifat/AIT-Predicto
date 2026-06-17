import { NextResponse } from 'next/server'
import { getState } from '@/lib/system-state'

export async function GET() {
  const lastRun = await getState('reminder_last_run')
  const summary = await getState('reminder_last_summary')

  return NextResponse.json({
    lastRun,
    summary: summary ? JSON.parse(summary) : null,
  })
}
