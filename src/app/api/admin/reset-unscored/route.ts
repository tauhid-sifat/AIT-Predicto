import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { error: setNullErr, data: result } = await supabase.rpc('exec_sql', {
    sql: `UPDATE predictions SET points = NULL WHERE points = 0 AND match_id IN (SELECT id FROM matches WHERE status != 'finished')`,
  })
  if (setNullErr) return NextResponse.json({ error: setNullErr.message }, { status: 500 })

  return NextResponse.json({ success: true, message: 'Reset unscored predictions to NULL' })
}
