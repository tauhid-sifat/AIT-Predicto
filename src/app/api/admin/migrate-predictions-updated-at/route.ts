import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.SYNC_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { error: addColErr } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
  })
  if (addColErr) return NextResponse.json({ error: addColErr.message }, { status: 500 })

  const { error: backfillErr } = await supabase.rpc('exec_sql', {
    sql: `UPDATE predictions SET updated_at = created_at WHERE updated_at IS NULL`,
  })
  if (backfillErr) return NextResponse.json({ error: backfillErr.message }, { status: 500 })

  const { error: funcErr } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION update_predictions_updated_at()
      RETURNS TRIGGER
      LANGUAGE plpgsql AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$;
    `.trim(),
  })
  if (funcErr) return NextResponse.json({ error: funcErr.message }, { status: 500 })

  const { error: triggerErr } = await supabase.rpc('exec_sql', {
    sql: `
      DROP TRIGGER IF EXISTS set_predictions_updated_at ON predictions;
      CREATE TRIGGER set_predictions_updated_at
        BEFORE UPDATE ON predictions
        FOR EACH ROW
        EXECUTE FUNCTION update_predictions_updated_at();
    `.trim(),
  })
  if (triggerErr) return NextResponse.json({ error: triggerErr.message }, { status: 500 })

  return NextResponse.json({ success: true, message: 'predictions.updated_at column + trigger added' })
}
