import { secretVault } from './secret_vault';
import crypto from 'crypto';

function runTests() {
  console.log('Running SecretVault Tests...');

  // Set test master key if not present
  if (!process.env.AI_SECRET_MASTER_KEY) {
    process.env.AI_SECRET_MASTER_KEY = 'test-master-secret-key-1234567890';
  }

  // Test 1: Encrypt then decrypt returns original value
  const originalKey = 'AIzaSyTestApiKey1234567890abcdef';
  const encrypted = secretVault.encryptSecret(originalKey);
  const decrypted = secretVault.decryptSecret(encrypted);
  if (decrypted !== originalKey) {
    throw new Error(`Test 1 Failed: Decrypted value "${decrypted}" does not match original "${originalKey}"`);
  }
  console.log('✅ Test 1 Passed: Encrypt & Decrypt match');

  // Test 2: Masked key hides sensitive characters
  const masked = secretVault.maskSecret(originalKey);
  if (!masked.startsWith('AIza') || !masked.includes('...')) {
    throw new Error(`Test 2 Failed: Masked value "${masked}" is invalid`);
  }
  console.log('✅ Test 2 Passed: Masked key formatting');

  // Test 3: Wrong key / Auth failure fails decryption
  const parts = encrypted.split(':');
  // Tamper with encrypted data or auth tag
  const tampered = `${parts[0]}:${parts[1]}:deadbeef${parts[2].substring(8)}`;
  let failed = false;
  try {
    secretVault.decryptSecret(tampered);
  } catch (err) {
    failed = true;
  }
  if (!failed) {
    throw new Error('Test 3 Failed: Decrypting tampered payload should have thrown an error');
  }
  console.log('✅ Test 3 Passed: Tampered payload rejected (Authentication failure)');

  // Test 4: Missing master key validation
  const oldKey = process.env.AI_SECRET_MASTER_KEY;
  delete process.env.AI_SECRET_MASTER_KEY;
  let missingKeyFailed = false;
  try {
    secretVault.encryptSecret('test');
  } catch (err) {
    missingKeyFailed = true;
  }
  process.env.AI_SECRET_MASTER_KEY = oldKey; // restore
  if (!missingKeyFailed) {
    throw new Error('Test 4 Failed: Encrypting without master key should have thrown an error');
  }
  console.log('✅ Test 4 Passed: Missing master key validated');

  console.log('🎉 All SecretVault tests passed successfully!');
}

runTests();
