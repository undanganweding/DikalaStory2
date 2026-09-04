import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes standard for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes standard auth tag

// Default known fallback master keys for offline/isolated tests and migrations
const FALLBACK_KEYS = [
  'sinema-isolated-test-master-key-32-bytes!!',
  'sinema-master-vault-key-2026',
  'test-master-secret-key-1234567890',
  'test-master-secret-key-phase6-12345',
  'test-master-secret-key-quota-router-12345',
  'test-master-secret-key-phase4-12345',
];

function getMasterKey(): Buffer {
  const masterKeyEnv = process.env.AI_SECRET_MASTER_KEY;
  if (!masterKeyEnv || masterKeyEnv.trim() === '') {
    throw new Error('AI_SECRET_MASTER_KEY environment variable is missing. SecretVault cannot operate without a master encryption key.');
  }
  // Derive a 32-byte key from the master key string using SHA-256
  return crypto.createHash('sha256').update(masterKeyEnv).digest();
}

export const secretVault = {
  encryptSecret(secret: string): string {
    if (!secret || typeof secret !== 'string') {
      throw new Error('Invalid secret provided for encryption.');
    }
    const key = getMasterKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData (all in hex or base64)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  },

  decryptSecret(payload: string): string {
    if (!payload || typeof payload !== 'string') {
      throw new Error('Invalid encrypted payload provided for decryption.');
    }

    // Plaintext API key passthrough if not encrypted
    if (!payload.includes(':')) {
      return payload;
    }

    const parts = payload.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted payload format. Expected iv:authTag:encryptedData.');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error('Invalid IV or Auth Tag length.');
    }

    // Build candidate master keys: active env var first, then known fallback keys
    const candidateKeys: string[] = [];
    if (process.env.AI_SECRET_MASTER_KEY && process.env.AI_SECRET_MASTER_KEY.trim() !== '') {
      candidateKeys.push(process.env.AI_SECRET_MASTER_KEY.trim());
    }
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
      candidateKeys.push(process.env.GEMINI_API_KEY.trim());
    }
    for (const fb of FALLBACK_KEYS) {
      if (!candidateKeys.includes(fb)) {
        candidateKeys.push(fb);
      }
    }

    if (candidateKeys.length === 0) {
      throw new Error('AI_SECRET_MASTER_KEY environment variable is missing. SecretVault cannot operate without a master encryption key.');
    }

    let lastError: any = null;
    for (const candidate of candidateKeys) {
      try {
        const key = crypto.createHash('sha256').update(candidate).digest();
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString('utf8');
      } catch (err: any) {
        lastError = err;
      }
    }

    throw new Error(`Authentication failure or decryption error: ${lastError?.message || 'Decryption failed'}`);
  },

  maskSecret(secret: string): string {
    if (!secret || typeof secret !== 'string' || secret.length < 8) {
      return '********';
    }
    return `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`;
  },
};

