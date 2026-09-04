import { AICredential } from '../../src/types';
import { db } from '../db';
import { secretVault } from '../security/secret_vault';

const inMemoryCredentials: AICredential[] = [];

export const credentialService = {
  async listCredentials(): Promise<AICredential[]> {
    try {
      const creds = await db.getCredentials();
      if (creds && creds.length > 0) return creds;
    } catch {}
    return inMemoryCredentials;
  },

  async getCredential(id: string): Promise<AICredential | null> {
    try {
      const cred = await db.getCredential(id);
      if (cred) return cred;
    } catch {}
    return inMemoryCredentials.find(c => c.id === id) || null;
  },

  async getActiveCredentials(): Promise<AICredential[]> {
    try {
      const creds = await db.getCredentials();
      if (creds && creds.length > 0) return creds.filter(c => c.status === 'active');
    } catch {}
    return inMemoryCredentials.filter(c => c.status === 'active');
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

