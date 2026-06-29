process.loadEnvFile('.env.local');
const { createClient } = require('@supabase/supabase-js');

async function main() {
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Find predictions on finished matches that have NULL points (unscored)
const { data: unscored } = await supabase
  .from('predictions')
  .select('id, match_id, user_id, predicted_winner, predicted_home_score, predicted_away_score')
  .is('points', null);

if (!unscored?.length) { console.log('No unscored predictions'); return; }

const matchIds = [...new Set(unscored.map(p => p.match_id))];
const { data: matches } = await supabase
  .from('matches')
  .select('id, status, home_team, away_team, home_score, away_score')
  .in('id', matchIds);

const matchMap = new Map((matches || []).map(m => [m.id, m]));

const { data: profiles } = await supabase.from('profiles').select('id, username');
const usernameMap = new Map((profiles || []).map(p => [p.id, p.username]));

const onFinished = unscored.filter(p => {
  const m = matchMap.get(p.match_id);
  return m && m.status === 'finished' && m.home_score !== null && m.away_score !== null;
});

console.log(`Unscored predictions on finished matches: ${onFinished.length}`);
for (const p of onFinished.slice(0, 20)) {
  const m = matchMap.get(p.match_id);
  const u = usernameMap.get(p.user_id) || p.user_id.slice(0,8);
  console.log(`  ${u} | ${m.home_team} vs ${m.away_team} (${m.home_score}-${m.away_score}) | predicted: ${p.predicted_winner} ${p.predicted_home_score}-${p.predicted_away_score}`);
}

// Also check: total predictions count vs scored count per user
const { data: profiles2 } = await supabase.from('profiles').select('id, username');
const { data: preds } = await supabase.from('predictions').select('user_id, points, match_id');

// Get all match statuses
const { data: allMatches } = await supabase.from('matches').select('id, status');
const matchStatusMap = new Map((allMatches || []).map(m => [m.id, m.status]));

const byUser = {};
for (const p of preds || []) {
  if (!byUser[p.user_id]) byUser[p.user_id] = { total: 0, scored: 0, onFinished: 0, unscoredOnFinished: 0 };
  byUser[p.user_id].total++;
  const status = matchStatusMap.get(p.match_id);
  if (status === 'finished') {
    byUser[p.user_id].onFinished++;
    if (p.points !== null) byUser[p.user_id].scored++;
    else byUser[p.user_id].unscoredOnFinished++;
  }
}

const uidMap = new Map((profiles2 || []).map(p => [p.id, p.username]));
for (const [uid, stats] of Object.entries(byUser)) {
  if (stats.unscoredOnFinished > 0) {
    console.log(`UNSCORED ON FINISHED: ${uidMap.get(uid) || uid.slice(0,8)}: ${stats.unscoredOnFinished} on finished (${stats.scored} scored / ${stats.onFinished} total on finished)`);
  }
}
}
main().catch(console.error);
