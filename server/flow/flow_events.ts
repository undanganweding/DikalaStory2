import { randomUUID } from 'node:crypto';
import { observabilityService } from '../ai_infrastructure/observability_service';
import { CredentialDomain, ResourceDomain } from './flow_types';

export type FlowLifecycleEventType =
  | 'FLOW_SESSION_CHECK'
  | 'FLOW_RESOURCE_CHECK'
  | 'FLOW_CAPABILITY_CHECK'
  | 'FLOW_COST_ESTIMATE'
  | 'FLOW_BUDGET_GATE'
  | 'FLOW_GENERATION_PREPARED';

export interface FlowLifecycleEvent {
  eventId: string;
  type: FlowLifecycleEventType;
  providerId: 'google-flow';
  operation: string;
  credentialDomain: CredentialDomain;
  resourceDomain: ResourceDomain;
  sessionId?: string;
  resourceId?: string;
  status?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export function recordFlowLifecycleEvent(event: Omit<FlowLifecycleEvent, 'eventId' | 'timestamp'>): FlowLifecycleEvent {
  const completed: FlowLifecycleEvent = {
    ...event,
    providerId: 'google-flow',
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
  };
  observabilityService.recordExecutionEvent(completed);
  observabilityService.recordTelemetry({
    traceId: completed.eventId,
    spanId: completed.eventId,
    agentName: 'FlowLifecycle',
    taskType: completed.type,
    providerId: completed.providerId,
    model: completed.operation,
    status: 'success',
    latencyMs: 0,
    originalTask: completed.operation,
    decisionExplanation: JSON.stringify({
      credentialDomain: completed.credentialDomain,
      resourceDomain: completed.resourceDomain,
      sessionId: completed.sessionId,
      resourceId: completed.resourceId,
      status: completed.status,
      metadata: completed.metadata,
    }),
  });
  return completed;
}
