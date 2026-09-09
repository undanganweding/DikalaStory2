import { spawnSync } from 'node:child_process';

const modelId = 'gemini-3.7-flash';
const script = 'server/ai_infrastructure/durable_usability_process_proof.ts';
const startedAt = new Date().toISOString();
const startMs = Date.now();
const args = ['node_modules/tsx/dist/cli.mjs', '-r', 'dotenv/config', script, 'read', modelId];
const child = spawnSync(process.execPath, args, {
  cwd: process.cwd(),
  env: { ...process.env, DURABLE_PROOF_CHILD: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
  timeout: 20000,
  killSignal: 'SIGTERM',
  maxBuffer: 10 * 1024 * 1024,
});
const elapsedMs = Date.now() - startMs;
console.log(JSON.stringify({
  runner: 'isolated-process-b-recovery',
  spawnTimestamp: startedAt,
  pid: child.pid || null,
  exitCode: child.status,
  signal: child.signal,
  timedOut: (child.error as any)?.code === 'ETIMEDOUT',
  elapsedMs,
  stdout: child.stdout || '',
  stderr: child.stderr || '',
}, null, 2));
if (child.error) process.exit(2);
if (child.status !== 0) process.exit(child.status ?? 1);
