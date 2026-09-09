import fs from 'node:fs';
import path from 'node:path';

// Vercel bundles API code as CJS; import.meta.url is unavailable there.
// Keep local traces beside source, but use writable /tmp in serverless runtime.
const traceRoot = process.env.VERCEL ? '/tmp' : __dirname;
const tracePath = path.resolve(traceRoot, '.cross_provider_trace.jsonl');
const startedAt = Date.now();

export function resetCrossProviderTrace(): void {
  fs.writeFileSync(tracePath, '');
}

export function traceCrossProviderEvent(event: string, fields: Record<string, unknown> = {}): void {
  fs.appendFileSync(tracePath, `${JSON.stringify({ timestamp: new Date().toISOString(), event, elapsed_ms: Date.now() - startedAt, ...fields })}\n`);
}

export function getCrossProviderTracePath(): string {
  return tracePath;
}
