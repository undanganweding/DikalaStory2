import { AICredential } from '../../src/types';
import { db } from '../db';
import { secretVault } from '../security/secret_vault';

const inMemoryCredentials: AICredential[] = [];

export const credentialService = {
  async listCredentials(): Promise<AICredential[]> {
    let creds: AICredential[] = [];
    try {
      const dbCreds = await db.getCredentials();
      if (dbCreds && dbCreds.length > 0) creds = [...dbCreds];
    } catch {}

    if (creds.length === 0 && inMemoryCredentials.length > 0) {
      creds = [...inMemoryCredentials];
    }

    // Production Environment Fallback: If no Google credentials exist in DB/memory,
    // automatically provide active fallback credential from GEMINI_API_KEY / GOOGLE_AI_API_KEY
    const googleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (googleKey && googleKey.trim().length > 0) {
      const hasGoogle = creds.some(c => c.providerId === 'google' && c.status === 'active');
      if (!hasGoogle) {
        creds.push({
          id: 'env_gemini_default',
          providerId: 'google',
          name: 'Environment GEMINI_API_KEY',
          maskedKey: secretVault.maskSecret(googleKey.trim()),
          encryptedSecret: secretVault.encryptSecret(googleKey.trim()),
          status: 'active',
          priority: 1,
          weight: 100,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
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

    if (id === 'env_gemini_default') {
      const googleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
      if (googleKey && googleKey.trim().length > 0) {
        return {
          id: 'env_gemini_default',
          providerId: 'google',
          name: 'Environment GEMINI_API_KEY',
          maskedKey: secretVault.maskSecret(googleKey.trim()),
          encryptedSecret: secretVault.encryptSecret(googleKey.trim()),
          status: 'active',
          priority: 1,
          weight: 100,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }
    }
    return null;
  },

  async getActiveCredentials(): Promise<AICredential[]> {
    const creds = await this.listCredentials();
    return creds.filter(c => c.status === 'active');
  },

  async addCredential(data: Partial<Pick<AICredential, 'encryptedSecret'>> & Omit<AICredential, 'id' | 'createdAt' | 'updatedAt' | 'maskedKey' | 'encryptedSecret'> & { secret?: string }): Promise<AICredential> {
    // Check referential integrity: provider must exist
    let provider = null;
    try {
      provider = await db.getProvider(data.providerId);
    } catch {}

    if (!provider && data.providerId !== 'google') {
      throw new Error(`Cannot add credential for nonexistent provider "${data.providerId}".`);
    }

    const id = `cred_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
    const idx = inMemoryCredentials.findIndex(c => c.id === id);
    if (idx !== -1) inMemoryCredentials.splice(idx, 1);
    try {
      return await db.deleteCredential(id);
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
    inMemoryCredentials.length = 0;
    let count = 0;
    try {
      const allCreds = await db.getCredentials();
      for (const cred of allCreds) {
        await db.deleteCredential(cred.id);
        count++;
      }
    } catch (err) {
      console.warn('[CredentialService] Error clearing all credentials from database:', err);
    }
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
};

