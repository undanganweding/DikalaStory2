import { credentialService } from './credential_service';
import { healthService } from './health_service';
import { secretVault } from '../security/secret_vault';
import { flowSessionManager } from '../flow/flow_session_manager';
import { FlowSession, FlowSessionState } from '../flow/flow_types';
import { recordFlowLifecycleEvent } from '../flow/flow_events';

export type CredentialResolutionDomain = 'API' | 'GOOGLE_FLOW_SESSION';

export interface ResolveInput {
  providerId: string;
  modelId?: string;
  taskType?: string;
  credentialDomain?: CredentialResolutionDomain;
  sessionId?: string;
  requiredCapability?: string;
}

export type ResolvedCredential =
  | {
      domain: 'API';
      credentialId: string;
      providerId: string;
      apiKey: string;
      healthStatus: string;
    }
  | {
      domain: 'GOOGLE_FLOW_SESSION';
      sessionId: string;
      accountId: string;
      providerId: 'google-flow';
      status: FlowSessionState;
      transport: FlowSession['transport'];
    };

export const credentialResolver = {
  async resolveCredential(input: ResolveInput): Promise<ResolvedCredential> {
    const { providerId } = input;
    const domain = input.credentialDomain || (providerId === 'google-flow' ? 'GOOGLE_FLOW_SESSION' : 'API');

    if (domain === 'GOOGLE_FLOW_SESSION') {
      if (providerId !== 'google-flow') {
        throw new Error(`Credential domain mismatch: ${providerId} cannot use GOOGLE_FLOW_SESSION`);
      }
      const sessions = flowSessionManager.list();
      const session = input.sessionId
        ? sessions.find((candidate) => candidate.sessionId === input.sessionId)
        : sessions.find((candidate) => candidate.status === 'AUTHENTICATED');
      if (!session) {
        recordFlowLifecycleEvent({ providerId: 'google-flow',
          type: 'FLOW_SESSION_CHECK', operation: 'resolve-credential', credentialDomain: 'GOOGLE_FLOW_SESSION',
          resourceDomain: 'GOOGLE_FLOW_CREDITS', sessionId: input.sessionId, status: 'UNAVAILABLE',
        });
        throw new Error('No Google Flow session available');
      }
      recordFlowLifecycleEvent({ providerId: 'google-flow',
        type: 'FLOW_SESSION_CHECK', operation: 'resolve-credential', credentialDomain: 'GOOGLE_FLOW_SESSION',
        resourceDomain: 'GOOGLE_FLOW_CREDITS', sessionId: session.sessionId, status: session.status,
      });
      if (session.status !== 'AUTHENTICATED') {
        throw new Error(`Google Flow session requires human action: ${session.status === 'EXPIRED' ? 'REAUTH_REQUIRED' : session.status}`);
      }
      if (input.requiredCapability && !session.capabilities.includes(input.requiredCapability)) {
        throw new Error(`Google Flow session lacks capability: ${input.requiredCapability}`);
      }
      return {
        domain: 'GOOGLE_FLOW_SESSION',
        sessionId: session.sessionId,
        accountId: session.accountId,
        providerId: 'google-flow',
        status: session.status,
        transport: session.transport,
      };
    }

    if (providerId === 'google-flow') {
      throw new Error('Credential domain mismatch: google-flow requires GOOGLE_FLOW_SESSION');
    }

    const allCreds = await credentialService.listCredentials();

    // 1. Filter by provider and status
    const candidateCreds = [];
    for (const cred of allCreds) {
      if (cred.providerId !== providerId) continue;

      // Ignore disabled or invalid credentials
      if (cred.status === 'disabled' || cred.status === 'invalid_auth' || cred.status === 'exhausted') {
        continue;
      }

      // Check health and cooldown
      const isAvailable = await healthService.isAvailable(cred.id);
      if (!isAvailable) {
        continue;
      }

      const health = await healthService.getHealth(cred.id);
      // Ignore if down
      if (health.status === 'down') {
        continue;
      }

      candidateCreds.push({
        cred,
        health,
      });
    }

    if (candidateCreds.length === 0) {
      throw new Error(`No healthy available credentials found for provider: ${providerId}`);
    }

    // 2. Ranking / Sorting according to rules:
    // 1. priority (ascending: 1, 2, 3...)
    // 2. health status ('healthy' > 'degraded' > 'down')
    // 3. success rate (descending: higher success rate first)
    // 4. lastUsedAt (ascending: least recently used first)
    candidateCreds.sort((a, b) => {
      // 1. Priority
      if (a.cred.priority !== b.cred.priority) {
        return a.cred.priority - b.cred.priority;
      }

      // 2. Health status rank
      const rankStatus = (status: string) => {
        if (status === 'healthy') return 3;
        if (status === 'degraded') return 2;
        return 1;
      };
      const rankA = rankStatus(a.health.status);
      const rankB = rankStatus(b.health.status);
      if (rankA !== rankB) {
        return rankB - rankA; // higher rank first
      }

      // 3. Success rate
      if (a.health.successRate !== b.health.successRate) {
        return b.health.successRate - a.health.successRate; // higher success rate first
      }

      // 4. Last used at (least recently used / oldest first)
      const lastA = a.cred.lastUsedAt || 0;
      const lastB = b.cred.lastUsedAt || 0;
      return lastA - lastB;
    });

    const selected = candidateCreds[0];

    // 3. Decrypt API key at runtime
    let apiKey = '';
    try {
      apiKey = secretVault.decryptSecret(selected.cred.encryptedSecret);
    } catch (err: any) {
      if ((selected.cred as any).secret) {
        apiKey = (selected.cred as any).secret;
      } else {
        throw new Error(`Failed to decrypt API key for credential ${selected.cred.id}: ${err.message}`);
      }
    }
    if (!apiKey && (selected.cred as any).secret) {
      apiKey = (selected.cred as any).secret;
    }

    // 4. Update lastUsedAt timestamp
    await credentialService.updateCredential(selected.cred.id, { lastUsedAt: Date.now() });

    return {
      domain: 'API',
      credentialId: selected.cred.id,
      providerId: selected.cred.providerId,
      apiKey,
      healthStatus: selected.health.status,
    };
  },
};
