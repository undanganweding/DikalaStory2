import { AICredential } from '../../src/types';
import { db } from '../db';
import { secretVault } from '../security/secret_vault';

const inMemoryCredentials: AICredential[] = [];
const suppressedCredentialIds = new Set<string>();
const suppressedMaskedKeys = new Set<string>();

/**
 * Identifies whether a credential is a test or probe fixture.
 * Test credentials should only be used in explicit test harnesses and are barred from production routing.
 */
export function isTestCredential(cred: { id?: string; name?: string; providerId?: string; encryptedSecret?: string }): boolean {
  if (!cred) return false;
  const id = (cred.id || '').toLowerCase();
  const name = (cred.name || '').toLowerCase();
  const prov = (cred.providerId || '').toLowerCase();
  return (
    id === 'cred_google_test' ||
    id.includes('test_') ||
    id.endsWith('_test') ||
    id.includes('mock_') ||
    id.startsWith('__e2e_') ||
    name.includes('test google credential') ||
    name.includes('mock_') ||
    prov.startsWith('__e2e_') ||
    prov.includes('_test_') ||
    prov.startsWith('mock_')
  );
}

export const credentialService = {
  async listCredentials(options?: { includeTest?: boolean }): Promise<AICredential[]> {
    let creds: AICredential[] = [];
    try {
      const dbCreds = await db.getCredentials();
      if (dbCreds && dbCreds.length > 0) {
        for (const c of dbCreds) {
          if (c.status === 'deleted') {
            suppressedCredentialIds.add(c.id);
            if (c.maskedKey) suppressedMaskedKeys.add(c.maskedKey);
          } else {
            creds.push(c);
          }
        }
      }
    } catch {}

    if (creds.length === 0 && inMemoryCredentials.length > 0) {
      creds = inMemoryCredentials.filter(c => c.status !== 'deleted' && !suppressedCredentialIds.has(c.id));
    }

    // Filter out test credentials in production unless explicitly requested
    if (!options?.includeTest) {
      creds = creds.filter(c => !isTestCredential(c));
    }

    // Production Environment Fallback: If Google credentials exist in environment,
    // automatically add them into the Credential Pool with appropriate priority tiers (supports 3 to 20+ keys!).
    const detectedEnvKeys: { key: string; id: string; name: string; priority: number }[] = [];
    const addedRawKeys = new Set<string>();

    const checkAndAddEnvKey = (rawKey: string | undefined, id: string, name: string, priority: number) => {
      if (!rawKey) return;
      const trimmed = rawKey.trim();
      if (trimmed.length > 5 && !addedRawKeys.has(trimmed)) {
        addedRawKeys.add(trimmed);
        detectedEnvKeys.push({ key: trimmed, id, name, priority });
      }
    };

    // 1. Standard primary keys
    checkAndAddEnvKey(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY, 'env_gemini_default', 'Environment GEMINI_API_KEY (Primary)', 1);
    checkAndAddEnvKey(process.env.GEMINI_API_KEY_SECONDARY || process.env.GEMINI_API_KEY_2 || process.env.GOOGLE_API_KEY_2, 'env_gemini_secondary', 'Environment GEMINI_API_KEY_2 (Secondary)', 2);
    checkAndAddEnvKey(process.env.GEMINI_API_KEY_BACKUP || process.env.GEMINI_API_KEY_3 || process.env.GOOGLE_API_KEY_3, 'env_gemini_backup', 'Environment GEMINI_API_KEY_3 (Backup)', 3);

    // 2. Numbered keys 4 through 20
    for (let i = 4; i <= 20; i++) {
      const kVal = process.env[`GEMINI_API_KEY_${i}`] || process.env[`GOOGLE_API_KEY_${i}`] || process.env[`GOOGLE_AI_API_KEY_${i}`];
      checkAndAddEnvKey(kVal, `env_gemini_key_${i}`, `Environment GEMINI_API_KEY_${i}`, i);
    }

    // 3. Multi-key bulk list (comma, semicolon, or newline separated)
    const bulkEnvKeys = process.env.GEMINI_API_KEYS || process.env.GOOGLE_API_KEYS || process.env.GOOGLE_AI_API_KEYS;
    if (bulkEnvKeys && bulkEnvKeys.trim().length > 0) {
      const splitKeys = bulkEnvKeys.split(/[\n,;]+/).map(k => k.trim()).filter(k => k.length > 5);
      splitKeys.forEach((k, idx) => {
        const pNum = detectedEnvKeys.length + idx + 1;
        checkAndAddEnvKey(k, `env_gemini_bulk_${idx + 1}`, `Environment GEMINI_BULK_KEY_${idx + 1}`, pNum);
      });
    }

    for (const item of detectedEnvKeys) {
      const masked = secretVault.maskSecret(item.key);
      const isSuppressed = suppressedCredentialIds.has(item.id) || suppressedMaskedKeys.has(masked);
      const alreadyExists = creds.some(c => c.id === item.id || (c.maskedKey === masked && c.providerId === 'google'));
      if (!alreadyExists && !isSuppressed) {
        creds.push({
          id: item.id,
          providerId: 'google',
          name: item.name,
          maskedKey: masked,
          encryptedSecret: secretVault.encryptSecret(item.key),
          status: 'active',
          priority: item.priority,
          weight: Math.max(10, 100 - (item.priority - 1) * 5),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    // STRICT UNIQUE & SEQUENTIAL PRIORITY NORMALIZATION:
    // Ensures NO TWO CREDENTIALS ever have the same priority (e.g. Account A = 1, Account B = 1 is forbidden).
    // Sort criteria:
    // 1. Priority ascending (1, 2, 3...)
    // 2. Weight descending
    // 3. CreatedAt ascending
    creds.sort((a, b) => {
      const pA = typeof a.priority === 'number' && !isNaN(a.priority) ? a.priority : 9999;
      const pB = typeof b.priority === 'number' && !isNaN(b.priority) ? b.priority : 9999;
      if (pA !== pB) return pA - pB;
      const wA = typeof a.weight === 'number' && !isNaN(a.weight) ? a.weight : 0;
      const wB = typeof b.weight === 'number' && !isNaN(b.weight) ? b.weight : 0;
      if (wA !== wB) return wB - wA;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });

    // Re-index contiguous priorities 1, 2, 3, 4... strictly unique
    let hasModifiedPriorities = false;
    for (let i = 0; i < creds.length; i++) {
      const expectedPriority = i + 1;
      if (creds[i].priority !== expectedPriority) {
        creds[i].priority = expectedPriority;
        hasModifiedPriorities = true;
      }
    }

    // Keep in-memory mirrors in sync
    if (hasModifiedPriorities) {
      for (const c of creds) {
        const memIdx = inMemoryCredentials.findIndex(m => m.id === c.id);
        if (memIdx !== -1) inMemoryCredentials[memIdx].priority = c.priority;
      }
    }

    return creds;
  },

  async getCredential(id: string): Promise<AICredential | null> {
    try {
      const cred = await db.getCredential(id);
      if (cred) return cred;
    } catch {}
    const mem = inMemoryCredentials.find(c => c.id === id);
    if (mem) return mem;

    const allCreds = await this.listCredentials();
    const found = allCreds.find(c => c.id === id);
    if (found) return found;

    return null;
  },

  async getActiveCredentials(): Promise<AICredential[]> {
    const creds = await this.listCredentials();
    return creds.filter(c => c.status === 'active');
  },

  async addCredential(data: Partial<Pick<AICredential, 'id' | 'encryptedSecret'>> & Omit<AICredential, 'id' | 'createdAt' | 'updatedAt' | 'maskedKey' | 'encryptedSecret'> & { secret?: string }): Promise<AICredential> {
    // Check referential integrity: provider must exist
    let provider = null;
    try {
      provider = await db.getProvider(data.providerId);
    } catch {}

    if (!provider && data.providerId !== 'google') {
      throw new Error(`Cannot add credential for nonexistent provider "${data.providerId}".`);
    }

    const id = (data as any).id || `cred_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    // If 'secret' (plaintext) is provided, encrypt it. If 'encryptedSecret' is provided directly, use it or encrypt it.
    let finalEncryptedSecret = data.encryptedSecret;
    let rawSecret = data.secret;

    if (rawSecret && !finalEncryptedSecret) {
      finalEncryptedSecret = secretVault.encryptSecret(rawSecret);
    } else if (finalEncryptedSecret && !finalEncryptedSecret.includes(':')) {
      // If encryptedSecret was passed as plaintext by mistake, encrypt it
      rawSecret = finalEncryptedSecret;
      finalEncryptedSecret = secretVault.encryptSecret(rawSecret);
    } else if (finalEncryptedSecret && finalEncryptedSecret.includes(':')) {
      // Already encrypted, decrypt temporarily to get masked key if needed
      try {
        rawSecret = secretVault.decryptSecret(finalEncryptedSecret);
      } catch {
        rawSecret = '********';
      }
    }

    const maskedKey = secretVault.maskSecret(rawSecret || '');

    if (id) suppressedCredentialIds.delete(id);
    if (maskedKey) suppressedMaskedKeys.delete(maskedKey);

    const newCred: AICredential = {
      ...data,
      encryptedSecret: finalEncryptedSecret || '',
      maskedKey,
      id,
      createdAt: now,
      updatedAt: now,
    };
    inMemoryCredentials.push(newCred);
    try {
      await db.saveCredential(newCred);
    } catch {}
    return newCred;
  },

  async updateCredential(id: string, partial: Partial<AICredential> & { secret?: string }): Promise<AICredential | null> {
    const existing = await db.getCredential(id);
    if (!existing) return null;

    let finalEncryptedSecret = partial.encryptedSecret ?? existing.encryptedSecret;
    let maskedKey = partial.maskedKey ?? existing.maskedKey;

    if (partial.secret) {
      finalEncryptedSecret = secretVault.encryptSecret(partial.secret);
      maskedKey = secretVault.maskSecret(partial.secret);
    } else if (partial.encryptedSecret && !partial.encryptedSecret.includes(':')) {
      finalEncryptedSecret = secretVault.encryptSecret(partial.encryptedSecret);
      maskedKey = secretVault.maskSecret(partial.encryptedSecret);
    }

    const updated: AICredential = {
      ...existing,
      ...partial,
      encryptedSecret: finalEncryptedSecret,
      maskedKey,
      id,
      updatedAt: Date.now(),
    };
    return db.saveCredential(updated);
  },

  async removeCredential(id: string): Promise<boolean> {
    suppressedCredentialIds.add(id);
    const idx = inMemoryCredentials.findIndex(c => c.id === id);
    let targetCred: AICredential | null = null;
    if (idx !== -1) {
      targetCred = inMemoryCredentials[idx];
      inMemoryCredentials.splice(idx, 1);
    } else {
      targetCred = await this.getCredential(id);
    }

    if (targetCred && targetCred.maskedKey) {
      suppressedMaskedKeys.add(targetCred.maskedKey);
    }

    try {
      const now = Date.now();
      await db.saveCredential({
        id,
        providerId: targetCred?.providerId || 'google',
        name: targetCred?.name || `Deleted Credential (${id})`,
        maskedKey: targetCred?.maskedKey || '********',
        encryptedSecret: targetCred?.encryptedSecret || '',
        status: 'deleted',
        priority: 9999,
        weight: 0,
        createdAt: targetCred?.createdAt || now,
        updatedAt: now,
      });
    } catch {}

    try {
      await db.deleteCredential(id);
    } catch {}

    return true;
  },

  async bulkRemoveCredentials(ids: string[]): Promise<number> {
    let count = 0;
    for (const id of ids) {
      const removed = await this.removeCredential(id);
      if (removed) count++;
    }
    return count;
  },

  async clearAllCredentials(): Promise<number> {
    let count = 0;
    try {
      const allCreds = await this.listCredentials({ includeTest: true });
      for (const cred of allCreds) {
        suppressedCredentialIds.add(cred.id);
        if (cred.maskedKey) suppressedMaskedKeys.add(cred.maskedKey);
        try {
          await db.saveCredential({
            ...cred,
            status: 'deleted',
            updatedAt: Date.now(),
          });
        } catch {}
        try {
          await db.deleteCredential(cred.id);
        } catch {}
        count++;
      }
    } catch (err) {
      console.warn('[CredentialService] Error clearing all credentials:', err);
    }
    inMemoryCredentials.length = 0;
    return count;
  },

  async removeCredentialsByProvider(providerId: string): Promise<number> {
    const creds = await db.getCredentials();
    const toRemove = creds.filter(c => c.providerId === providerId);
    let count = 0;
    for (const c of toRemove) {
      await db.deleteCredential(c.id);
      count++;
    }
    return count;
  },

  async rotateCredential(id: string, newSecret?: string): Promise<AICredential | null> {
    const existing = await db.getCredential(id);
    if (!existing) return null;

    let finalEncryptedSecret = existing.encryptedSecret;
    let maskedKey = existing.maskedKey;

    if (newSecret && newSecret.trim()) {
      finalEncryptedSecret = secretVault.encryptSecret(newSecret.trim());
      maskedKey = secretVault.maskSecret(newSecret.trim());
    }

    const updated: AICredential = {
      ...existing,
      encryptedSecret: finalEncryptedSecret,
      maskedKey,
      status: 'active',
      updatedAt: Date.now(),
    };
    return db.saveCredential(updated);
  },

  maskCredential(secret: string): string {
    return secretVault.maskSecret(secret);
  },

  /**
   * Reorders credentials by assigning strictly sequential priorities:
   * 1st item -> Priority 1
   * 2nd item -> Priority 2
   * 3rd item -> Priority 3, and so on.
   * Eliminates any duplicate priorities and persists the new order.
   */
  async reorderCredentials(orderedIds: string[]): Promise<AICredential[]> {
    const all = await this.listCredentials({ includeTest: true });
    const credMap = new Map<string, AICredential>(all.map(c => [c.id, c]));

    const reordered: AICredential[] = [];
    for (const id of orderedIds) {
      const c = credMap.get(id);
      if (c) {
        reordered.push(c);
        credMap.delete(id);
      }
    }

    // Append any remaining items
    for (const remaining of credMap.values()) {
      reordered.push(remaining);
    }

    const now = Date.now();
    for (let i = 0; i < reordered.length; i++) {
      const newPriority = i + 1;
      reordered[i].priority = newPriority;
      reordered[i].updatedAt = now;

      // Mirror in-memory
      const memIdx = inMemoryCredentials.findIndex(m => m.id === reordered[i].id);
      if (memIdx !== -1) {
        inMemoryCredentials[memIdx].priority = newPriority;
        inMemoryCredentials[memIdx].updatedAt = now;
      }

      // Persist to database
      try {
        await db.saveCredential(reordered[i]);
      } catch (err) {
        console.warn(`[CredentialService] Failed to persist reordered priority for ${reordered[i].id}:`, err);
      }
    }

    return reordered;
  },
};

