import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tracePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.cross_provider_trace.jsonl');
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
