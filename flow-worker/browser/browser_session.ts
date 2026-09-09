import type { FlowWorkerEnvelope, FlowReadOnlyDiscoveryResult } from '../../server/flow/flow_readonly_worker_contract';
import { extractVerifiedModels } from './model_discovery';

export interface ReadOnlyBrowserSession {
  readonly transport: 'CDP' | 'PLAYWRIGHT' | 'BROWSER_UI';
  inspect(envelope: FlowWorkerEnvelope): Promise<FlowReadOnlyDiscoveryResult>;
  close(): Promise<void>;
}

export interface BrowserSessionFactory { open(): Promise<ReadOnlyBrowserSession>; }

export interface CdpBrowserOptions {
  endpoint?: string;
  flowUrl?: string;
  targetUrl?: string;
  timeoutMs?: number;
  logger?: (line: string) => void;
}

type CdpTarget = { url?: string; title?: string; webSocketDebuggerUrl?: string };

function unavailable(reason: string): BrowserSessionFactory {
  return { async open() { return { transport: 'CDP', async inspect(envelope) { return { ok: false, transport: 'WORKER_UNAVAILABLE', status: 'UNAVAILABLE', accountId: envelope.session.accountId, capabilities: [], reason, mutationDetected: false, paidSubmission: false }; }, async close() {} }; } };
}

export function createUnavailableBrowserSessionFactory(reason = 'Browser session unavailable'): BrowserSessionFactory { return unavailable(reason); }

/** Attach only. Uses Chrome DevTools Protocol HTTP discovery and Runtime.evaluate; never clicks or submits. */
export function createCdpBrowserSessionFactory(options: CdpBrowserOptions = {}): BrowserSessionFactory {
  const endpoint = options.endpoint ?? process.env.FLOW_CDP_ENDPOINT ?? `http://127.0.0.1:${process.env.FLOW_CDP_PORT ?? '9222'}`;
  const flowUrl = options.flowUrl ?? process.env.FLOW_URL ?? 'https://flow.google.com/';
  const timeout = options.timeoutMs ?? 10000;
  const log = options.logger ?? ((line) => console.log(`[FlowWorker] ${line}`));
  return { async open() {
    let socket: WebSocket | undefined;
    let nextId = 0;
    const pending = new Map<number, (value: any) => void>();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const endpointBase = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
      const targets = await fetch(`${endpointBase}/json/list`, { signal: controller.signal }).then((r) => r.ok ? r.json() as Promise<CdpTarget[]> : Promise.reject(new Error(`CDP HTTP ${r.status}`))).finally(() => clearTimeout(timer));
      const target = targets.find((candidate) => candidate.webSocketDebuggerUrl && (options.targetUrl ? candidate.url === options.targetUrl : candidate.url?.startsWith(flowUrl) && /Google Flow/i.test(candidate.title ?? ''))) ?? targets.find((candidate) => candidate.webSocketDebuggerUrl && candidate.url?.includes('flow.google.com') && /Google Flow/i.test(candidate.title ?? ''));
      if (!target?.webSocketDebuggerUrl) return unavailable('Browser target unavailable').open();
      socket = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise<void>((resolve, reject) => { const t = setTimeout(() => reject(new Error('CDP websocket timeout')), timeout); socket!.onopen = () => { clearTimeout(t); resolve(); }; socket!.onerror = () => { clearTimeout(t); reject(new Error('CDP websocket unavailable')); }; });
      socket.onmessage = (event) => { const message = JSON.parse(String(event.data)); if (message.id) pending.get(message.id)?.(message.result); };
      const evaluate = (expression: string) => new Promise<any>((resolve, reject) => { const id = ++nextId; pending.set(id, resolve); socket!.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } })); setTimeout(() => { pending.delete(id); reject(new Error('CDP evaluate timeout')); }, timeout); });
      log('CDP connected'); log('Browser target found');
      return { transport: 'CDP', async inspect(envelope) {
        const data = await evaluate(`(() => { const text = document.body?.innerText || ''; const url = location.href; const selectors = '[data-model-id], [data-model], [model-id], [modelid], [aria-controls]'; const candidates = [...document.querySelectorAll(selectors)].map((element) => ({ text: (element.textContent || '').trim(), attributes: Object.fromEntries([...element.attributes].map((attribute) => [attribute.name, attribute.value])), path: element.tagName.toLowerCase() })); return { url, title: document.title, text: text.slice(0, 20000), candidates }; })()`);
        const evaluated = data?.result?.value ?? {};
        const text = String(evaluated.text ?? '');
        const pageUrl = String(evaluated.url ?? '');
        const pageTitle = String(evaluated.title ?? '');
        if (!pageUrl.includes('flow.google.com') || !/Google Flow/i.test(pageTitle)) return { ok: false, transport: 'WORKER_UNAVAILABLE', status: 'UNAVAILABLE', accountId: envelope.session.accountId, capabilities: [], reason: 'Flow page unavailable', mutationDetected: false, paidSubmission: false };
        log('Flow page detected');
        if (/captcha|unusual traffic|verify you are human|bot challenge/i.test(text)) { log('Authentication state: BOT_CHALLENGE'); return { ok: false, transport: 'AUTHENTICATED_PAGE', status: 'BOT_CHALLENGE', accountId: envelope.session.accountId, capabilities: [], reason: 'Bot challenge detected; stopped', mutationDetected: false, paidSubmission: false }; }
        if (/sign in|log in|to continue to google/i.test(text)) { log('Authentication state: REAUTH_REQUIRED'); return { ok: false, transport: 'AUTHENTICATED_PAGE', status: 'REAUTH_REQUIRED', accountId: envelope.session.accountId, capabilities: [], reason: 'Flow authentication required', mutationDetected: false, paidSubmission: false }; }
        const capabilities = ['SESSION_STATUS', 'CAPABILITY_STATUS', 'MODEL_DISCOVERY', 'CREDIT_STATUS', 'QUOTE_DISCOVERY'];
        const modelEvidence = extractVerifiedModels(Array.isArray(evaluated.candidates) ? evaluated.candidates : []);
        const models = modelEvidence.models;
        const creditMatch = text.match(/(?:credits?|remaining)[^\\d]{0,20}(\\d+(?:[.,]\\d+)?)/i);
        const credits = creditMatch ? Number(creditMatch[1].replace(',', '.')) : undefined;
        log('Authentication state: AUTHENTICATED'); log(`Account: ${envelope.session.accountId || 'unavailable'}`); log(`Models discovered: ${models.length}`); if (credits !== undefined) log(`Credits discovered: ${credits}`); log('Quote: UNAVAILABLE'); log('Paid submission: false'); log('Mutation: false');
        return { ok: true, transport: 'AUTHENTICATED_PAGE', status: 'AUTHENTICATED', accountId: envelope.session.accountId, capabilities, models, ...(credits === undefined ? {} : { credits }), reason: 'Read-only DOM inspection', mutationDetected: false, paidSubmission: false };
      }, async close() { socket?.close(); } };
    } catch (error) { return unavailable(error instanceof Error ? error.message : 'CDP unavailable').open(); }
  } };
}
