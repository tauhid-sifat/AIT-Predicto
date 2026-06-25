import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function GET(request: Request) {
  const secret = request.headers.get('x-sync-secret')
  if (secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()

  const { error: colErr } = await admin.rpc('exec_sql', {
    sql: 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false'
  })

  if (colErr) {
    return NextResponse.json({ error: colErr.message }, { status: 500 })
  }

  const { error: updErr } = await admin
    .from('profiles')
    .update({ is_admin: true })
    .eq('email', 'tauhidur.sifat@gmail.com')

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
