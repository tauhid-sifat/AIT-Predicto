import { createAdminClient } from '@/lib/supabase-admin'

export async function getState(key: string): Promise<string | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('system_state')
    .select('value')
    .eq('key', key)
    .single()
  return data?.value ?? null
}

export async function setState(key: string, value: string) {
  const supabase = createAdminClient()
  await supabase.from('system_state').upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
}

export async function incrementCounter(key: string, by = 1) {
  const current = await getState(key)
  const next = (parseInt(current ?? '0', 10) + by).toString()
  await setState(key, next)
  return next
}

export async function logToDb(event: string, details?: Record<string, unknown>) {
  const supabase = createAdminClient()
  await supabase.from('sync_log').insert({
    event,
    details: details ?? null,
  })
}
