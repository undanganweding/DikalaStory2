import { createOperatorWorkerAdapter, type FlowWorkerEnvelope, type FlowReadOnlyDiscoveryResult, type OperatorAuthenticatedFlowWorker } from '../../server/flow/flow_readonly_worker_contract';
import type { BrowserSessionFactory } from '../browser/browser_session';

export function createBrowserReadOnlyWorker(factory: BrowserSessionFactory): OperatorAuthenticatedFlowWorker {
  const discover = async (envelope: FlowWorkerEnvelope): Promise<FlowReadOnlyDiscoveryResult> => {
    const browser = await factory.open();
    try {
      const result = await browser.inspect(envelope);
      if (result.mutationDetected !== false || result.paidSubmission !== false) {
        throw new Error('Safety violation: browser transport reported mutation or paid submission');
      }
      return { ...result, mutationDetected: false, paidSubmission: false };
    } finally {
      await browser.close();
    }
  };
  return createOperatorWorkerAdapter(discover);
}
