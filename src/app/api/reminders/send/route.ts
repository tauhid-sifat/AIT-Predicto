import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { getState, setState } from '@/lib/system-state'
import { sendPredictionReminder } from '@/lib/email'

function isAuthorized(request: NextRequest): boolean {
  if (request.headers.get('x-sync-secret') === process.env.SYNC_SECRET) return true
  const auth = request.headers.get('authorization')
  if (auth === `Bearer ${process.env.SYNC_SECRET}`) return true
  return false
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const sent: string[] = []
  const errors: string[] = []
  let skipped = 0

  // Find upcoming matches without predictions
  const { data: upcoming } = await supabase
    .from('matches')
    .select('id')
    .eq('status', 'scheduled')
    .gt('kickoff_time', now)

  if (!upcoming || upcoming.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, errors: [] })
  }

  const matchIds = upcoming.map((m) => m.id)

  // Find predictions for upcoming matches
  const { data: existingPreds } = await supabase
    .from('predictions')
    .select('user_id, match_id')
    .in('match_id', matchIds)

  // Build set of (user_id, match_id) pairs already predicted
  const predicted = new Set(
    (existingPreds ?? []).map((p) => `${p.user_id}:${p.match_id}`)
  )

  // Get all profiles that have at least one unpredicted match
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, email')

  for (const profile of profiles ?? []) {
    if (!profile.email) { skipped++; continue }

    // Check opt-out (stored in system_state)
    const optOut = await getState(`email_opt_out:${profile.id}`)
    if (optOut === 'true') { skipped++; continue }

    // Rate limit: at most once per day
    const lastSent = await getState(`reminder_last_sent:${profile.id}`)
    if (lastSent) {
      const hoursSinceLast = (Date.now() - new Date(lastSent).getTime()) / 3600000
      if (hoursSinceLast < 20) { skipped++; continue }
    }

    // Count unpredicted upcoming matches for this user
    let unpredictedCount = 0
    for (const mid of matchIds) {
      if (!predicted.has(`${profile.id}:${mid}`)) unpredictedCount++
    }

    if (unpredictedCount === 0) { skipped++; continue }

    const result = await sendPredictionReminder(
      profile.email,
      profile.username ?? profile.email,
      unpredictedCount
    )

    if (result.ok) {
      await setState(`reminder_last_sent:${profile.id}`, now)
      sent.push(profile.id)
    } else {
      errors.push(`${profile.id}: ${result.error}`)
    }
  }

  // Save summary for admin status
  await setState('reminder_last_run', now)
  await setState('reminder_last_summary', JSON.stringify({
    sent: sent.length,
    skipped,
    errors: errors.length,
    timestamp: now,
  }))

  return NextResponse.json({
    ok: true,
    sent: sent.length,
    skipped,
    errors,
  })
}
