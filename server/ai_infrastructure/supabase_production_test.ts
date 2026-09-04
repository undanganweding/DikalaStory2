import { randomUUID } from 'node:crypto';
import { getSupabaseClient, getSupabaseConfig } from '../db/supabase_client';
import { aiGateway } from './ai_gateway';

const requiredTables = [
  'ai_providers', 'ai_models', 'ai_credentials', 'ai_usage_logs',
  'ai_telemetry', 'adaptive_memory', 'decision_feedback',
  'calibration_records', 'cost_records',
];

async function main() {
  const config = getSupabaseConfig();
  if (!config) throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  const client = getSupabaseClient();

  for (const table of requiredTables) {
    const { error } = await client.from(table).select('*').limit(1);
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`PASS table: ${table}`);
  }

  const id = `production_probe_${randomUUID()}`;
  const probe = {
    id,
    trace_id: id,
    span_id: `span_${id}`,
    agent_name: 'supabase-production-probe',
    task_class: 'connectivity_probe',
    provider_id: 'probe',
    model_id: 'probe',
    status: 'success',
    input_tokens: 1,
    output_tokens: 1,
    total_tokens: 2,
    latency_ms: 1,
    metadata: { temporary: true },
  };
  const inserted = await client.from('ai_telemetry').insert(probe).select('id').single();
  if (inserted.error) throw new Error(`ai_telemetry insert: ${inserted.error.message}`);
  const read = await client.from('ai_telemetry').select('id').eq('id', id).single();
  if (read.error || read.data?.id !== id) throw new Error(`ai_telemetry read failed: ${read.error?.message || 'missing row'}`);
  const removed = await client.from('ai_telemetry').delete().eq('id', id);
  if (removed.error) throw new Error(`ai_telemetry cleanup: ${removed.error.message}`);
  console.log('PASS telemetry insert/read/delete');

  if (process.env.SUPABASE_PROBE_GATEWAY === 'true') {
    const response = await aiGateway.generate({ model: 'ops-5', prompt: 'connectivity probe', agentName: 'supabase-production-probe' });
    if (!response.text) throw new Error('AI Gateway returned an empty response');
    console.log('PASS AI Gateway database-layer access');
  } else {
    console.log('SKIP AI Gateway live provider probe (set SUPABASE_PROBE_GATEWAY=true to enable)');
  }

  console.log('SUPABASE PRODUCTION READINESS: PASS');
}

main().catch((error) => {
  console.error(`SUPABASE PRODUCTION READINESS: FAIL - ${error.message}`);
  process.exitCode = 1;
});
