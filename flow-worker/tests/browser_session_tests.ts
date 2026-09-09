import { strict as assert } from 'node:assert';
import { createCdpBrowserSessionFactory } from '../browser/browser_session';
import type { FlowWorkerEnvelope } from '../../server/flow/flow_readonly_worker_contract';

const envelope: FlowWorkerEnvelope = { requestId: 'test', sessionId: 'session', operation: 'SESSION_STATUS', session: { sessionId: 'session', accountId: 'operator', status: 'AUTHENTICATED', transport: 'CDP', capabilities: [] } };

const unavailable = await createCdpBrowserSessionFactory({ endpoint: 'http://127.0.0.1:1', timeoutMs: 100 }).open();
const result = await unavailable.inspect(envelope);
assert.equal(result.transport, 'WORKER_UNAVAILABLE');
assert.equal(result.mutationDetected, false);
assert.equal(result.paidSubmission, false);
await unavailable.close();

console.log('Browser session adapter tests passed');
