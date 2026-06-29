import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: profiles } = await supabase.from('profiles').select('id, username');
if (!profiles?.length) { console.log('no profiles'); process.exit(0); }
const uid = profiles[0].id;
console.log('user:', profiles[0].username, uid);

const { data: stats } = await supabase.rpc('get_user_stats', { p_user_id: uid });
console.log('stats:', JSON.stringify(stats, null, 2));

const { count: totalPreds } = await supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('user_id', uid);
console.log('total predictions:', totalPreds);

const { count: finishedPreds } = await supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('user_id', uid).not('points', 'is', null);
console.log('scored predictions:', finishedPreds);

const { count: correctPreds } = await supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('user_id', uid).gt('points', 0);
console.log('correct predictions:', correctPreds);

const { count: finishedMatches } = await supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'finished');
console.log('finished matches total:', finishedMatches);

const { data: matchData } = await supabase.from('matches').select('id, home_team, away_team, home_score, away_score, kickoff_time').eq('status', 'finished').order('kickoff_time', { ascending: false }).limit(5);
console.log('last 5 finished matches:', JSON.stringify(matchData, null, 2));
}
main().catch(console.error);
