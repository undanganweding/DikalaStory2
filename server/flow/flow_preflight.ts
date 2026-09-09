import { flowResourceManager } from './flow_resource_manager';
import { flowSessionManager } from './flow_session_manager';
import { ResourceDomain } from './flow_types';

export type FlowExecutionPolicy = 'PREPARE_ONLY' | 'NO_SPEND' | 'EXECUTE';

export interface FlowPreflightRequest {
  operation: string;
  capability: string;
  sessionId?: string;
  resourceId?: string;
  policy: FlowExecutionPolicy;
}

export interface FlowPreflightResult {
  viable: boolean;
  canSubmitPaidGeneration: false;
  status: 'READY_FOR_PREPARATION' | 'BLOCKED';
  reason: string;
  providerId: 'google-flow';
  credentialDomain: 'GOOGLE_FLOW_SESSION';
  resourceDomain: ResourceDomain;
  sessionStatus?: string;
  resourceStatus?: string;
}

export function checkFlowPreflight(request: FlowPreflightRequest): FlowPreflightResult {
  const base = {
    providerId: 'google-flow' as const,
    credentialDomain: 'GOOGLE_FLOW_SESSION' as const,
    resourceDomain: 'GOOGLE_FLOW_CREDITS' as const,
    canSubmitPaidGeneration: false as const,
  };
  const session = request.sessionId ? flowSessionManager.get(request.sessionId) : undefined;
  if (!session) {
    return { ...base, viable: false, status: 'BLOCKED', reason: 'Flow session unavailable: REAUTH_REQUIRED' };
  }
  if (session.status !== 'AUTHENTICATED') {
    return { ...base, viable: false, status: 'BLOCKED', sessionStatus: session.status, reason: `Flow session unavailable: ${session.status === 'EXPIRED' ? 'REAUTH_REQUIRED' : session.status}` };
  }
  if (!session.capabilities.includes(request.capability)) {
    return { ...base, viable: false, status: 'BLOCKED', sessionStatus: session.status, reason: `Flow capability unavailable: ${request.capability}` };
  }
  const resource = request.resourceId ? flowResourceManager.get(request.resourceId) : undefined;
  if (!resource) {
    return { ...base, viable: false, status: 'BLOCKED', sessionStatus: session.status, resourceStatus: 'UNKNOWN', reason: 'Flow resource unavailable: cost not verified' };
  }
  if (resource.accountId !== session.accountId) {
    return { ...base, viable: false, status: 'BLOCKED', sessionStatus: session.status, resourceStatus: 'ACCOUNT_MISMATCH', reason: 'Flow session and credit account mismatch' };
  }
  if (request.policy === 'EXECUTE') {
    return { ...base, viable: false, status: 'BLOCKED', sessionStatus: session.status, resourceStatus: 'UNVERIFIED_COST', reason: 'Flow paid execution unavailable: real cost estimation and approval gate not implemented' };
  }
  return { ...base, viable: true, status: 'READY_FOR_PREPARATION', sessionStatus: session.status, resourceStatus: 'AVAILABLE', reason: `${request.policy} allows preparation only; paid submission disabled` };
}
