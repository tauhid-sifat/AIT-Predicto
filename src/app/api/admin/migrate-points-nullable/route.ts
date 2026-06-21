import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { error: alterErr } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE predictions ALTER COLUMN points DROP DEFAULT`,
  })
  if (alterErr) return NextResponse.json({ error: alterErr.message }, { status: 500 })

  const { error: defaultErr } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE predictions ALTER COLUMN points SET DEFAULT NULL`,
  })
  if (defaultErr) return NextResponse.json({ error: defaultErr.message }, { status: 500 })

  const { error: nullErr } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE predictions ALTER COLUMN points DROP NOT NULL`,
  })
  if (nullErr) return NextResponse.json({ error: nullErr.message }, { status: 500 })

  const { error: checkErr } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_points_check`,
  })
  if (checkErr) return NextResponse.json({ error: checkErr.message }, { status: 500 })

  const { error: addCheckErr } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE predictions ADD CONSTRAINT predictions_points_check CHECK (points IS NULL OR points >= 0)`,
  })
  if (addCheckErr) return NextResponse.json({ error: addCheckErr.message }, { status: 500 })

  return NextResponse.json({ success: true, message: 'points column now nullable, defaults to NULL' })
}
