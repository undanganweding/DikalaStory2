import { credentialResolver } from './credential_resolver';
import { credentialService } from './credential_service';
import { healthService } from './health_service';
import { db } from '../db';

async function runResolverTests() {
  console.log('Running CredentialResolver Simulation Tests...');

  if (!process.env.AI_SECRET_MASTER_KEY) {
    process.env.AI_SECRET_MASTER_KEY = 'test-master-secret-key-resolver-12345';
  }

  // Clean up or seed test data
  const existingCreds = await credentialService.listCredentials();
  for (const c of existingCreds) {
    if (c.id.startsWith('test_gemini_')) {
      await credentialService.removeCredential(c.id);
    }
  }

  // Setup Scenario: 5 Gemini credentials
  // Key A: healthy, priority 1
  const credA = await credentialService.addCredential({
    providerId: 'google',
    name: 'Key A',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'AIzaSyKeyAPlaintext1234567890',
  });

  // Key B: healthy, priority 2
  const credB = await credentialService.addCredential({
    providerId: 'google',
    name: 'Key B',
    status: 'active',
    priority: 2,
    weight: 10,
    secret: 'AIzaSyKeyBPlaintext1234567890',
  });

  // Key C: cooldown (put in cooldown via health service)
  const credC = await credentialService.addCredential({
    providerId: 'google',
    name: 'Key C',
    status: 'active',
    priority: 1, // high priority on paper, but in cooldown
    weight: 10,
    secret: 'AIzaSyKeyCPlaintext1234567890',
  });
  await healthService.recordFailure(credC.id, '429 Rate Limit Exceeded', 429);

  // Key D: invalid_auth
  const credD = await credentialService.addCredential({
    providerId: 'google',
    name: 'Key D',
    status: 'invalid_auth',
    priority: 1,
    weight: 10,
    secret: 'AIzaSyKeyDPlaintext1234567890',
  });

  // Key E: healthy, priority 3
  const credE = await credentialService.addCredential({
    providerId: 'google',
    name: 'Key E',
    status: 'active',
    priority: 3,
    weight: 10,
    secret: 'AIzaSyKeyEPlaintext1234567890',
  });

  console.log('Seeded 5 credentials (A, B, C-cooldown, D-invalid, E).');

  // Test resolution
  const resolved = await credentialResolver.resolveCredential({
    providerId: 'google',
    modelId: 'gemini-3.1-flash-lite',
    taskType: 'story_understanding',
  });

  console.log('Resolved Credential:', {
    credentialId: resolved.credentialId,
    providerId: resolved.providerId,
    maskedApiKey: resolved.apiKey.substring(0, 4) + '...' + resolved.apiKey.substring(resolved.apiKey.length - 4),
    healthStatus: resolved.healthStatus,
  });

  // Expected: Key A should be selected because C is in cooldown, D is invalid_auth, and A has higher priority than B and E.
  if (resolved.credentialId !== credA.id) {
    throw new Error(`Test Failed: Expected Key A (${credA.id}), but got ${resolved.credentialId}`);
  }

  console.log('✅ Test Passed: Resolver successfully skipped cooldown (C) and invalid (D) keys, selecting highest priority healthy key (A).');

  // Cleanup test creds
  await credentialService.removeCredential(credA.id);
  await credentialService.removeCredential(credB.id);
  await credentialService.removeCredential(credC.id);
  await credentialService.removeCredential(credD.id);
  await credentialService.removeCredential(credE.id);

  console.log('🎉 All CredentialResolver simulation tests completed successfully!');
}

runResolverTests().catch(err => {
  console.error('❌ Resolver Test Error:', err);
  process.exit(1);
});
