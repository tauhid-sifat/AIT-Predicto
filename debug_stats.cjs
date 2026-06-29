process.loadEnvFile('.env.local');
const { createClient } = require('@supabase/supabase-js');

async function main() {
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: profiles } = await supabase.from('profiles').select('id, username');
if (!profiles?.length) { console.log('no profiles'); process.exit(0); }

for (const p of profiles) {
  const { data: stats } = await supabase.rpc('get_user_stats', { p_user_id: p.id });
  const s = stats?.[0] || {};
  const { count: total } = await supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('user_id', p.id);
  const { count: finished } = await supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('user_id', p.id).not('points', 'is', null);
  const { count: correct } = await supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('user_id', p.id).gt('points', 0);
  const { count: matches } = await supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'finished');

  console.log(`\n=== ${p.username} (${p.id.slice(0,8)}...) ===`);
  console.log(`  Stats RPC: total_preds=${s.total_predictions} correct=${s.correct_predictions} accuracy=${s.accuracy_percent}% streak=${s.current_streak} longest=${s.longest_streak} exact=${s.exact_score_count}`);
  console.log(`  Raw: total=${total} finished=${finished} correct=${correct} | finished_matches=${matches}`);
}
}
main().catch(console.error);
