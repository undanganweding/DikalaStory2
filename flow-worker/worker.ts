import { createBrowserReadOnlyWorker } from './transport/readonly_worker';
import { createCdpBrowserSessionFactory } from './browser/browser_session';
import type { FlowWorkerEnvelope } from '../server/flow/flow_readonly_worker_contract';

export interface WorkerServerOptions {
  port?: number;
  host?: string;
}

/** External worker entrypoint. Default path attaches to operator-controlled Chrome over CDP. */
export function createFlowWorker(factory = createCdpBrowserSessionFactory()) {
  const worker = createBrowserReadOnlyWorker(factory);
  return {
    async handle(envelope: FlowWorkerEnvelope) {
      return worker.discoverReadOnly(envelope);
    },
  };
}

export async function startFlowWorker(options: WorkerServerOptions = {}): Promise<void> {
  const port = options.port ?? Number(process.env.FLOW_WORKER_PORT || 8787);
  const host = options.host ?? process.env.FLOW_WORKER_HOST ?? '127.0.0.1';
  const server = await import('node:http');
  const worker = createFlowWorker();
  const httpServer = server.createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/readonly') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'READ_ONLY_ROUTE_NOT_FOUND' }));
      return;
    }
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const envelope = JSON.parse(Buffer.concat(chunks).toString('utf8')) as FlowWorkerEnvelope;
      const result = await worker.handle(envelope);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'MALFORMED_REQUEST' }));
    }
  });
  await new Promise<void>((resolve) => httpServer.listen(port, host, resolve));
  await new Promise<never>(() => undefined);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void startFlowWorker();
}
