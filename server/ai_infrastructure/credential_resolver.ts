import { credentialService } from './credential_service';
import { healthService } from './health_service';
import { secretVault } from '../security/secret_vault';

export interface ResolveInput {
  providerId: string;
  modelId?: string;
  taskType?: string;
}

export interface ResolvedCredential {
  credentialId: string;
  providerId: string;
  apiKey: string;
  healthStatus: string;
}

export const credentialResolver = {
  async resolveCredential(input: ResolveInput): Promise<ResolvedCredential> {
    const { providerId } = input;
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
      credentialId: selected.cred.id,
      providerId: selected.cred.providerId,
      apiKey,
      healthStatus: selected.health.status,
    };
  },
};
