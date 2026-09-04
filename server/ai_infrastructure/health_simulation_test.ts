import { credentialService } from './credential_service';
import { healthService } from './health_service';

async function runHealthSimulation() {
  console.log('Running Health Simulation Test (Credential A: 10 Successes vs Credential B: 5 Failures 503)...');

  if (!process.env.AI_SECRET_MASTER_KEY) {
    process.env.AI_SECRET_MASTER_KEY = 'test-master-secret-key-health-sim-12345';
  }

  // Create Credential A and Credential B
  const credA = await credentialService.addCredential({
    providerId: 'google',
    name: 'Cred A (Stable)',
    status: 'active',
    priority: 1,
    weight: 10,
    secret: 'AIzaSyCredAPlaintextKey1234567890',
  });

  const credB = await credentialService.addCredential({
    providerId: 'google',
    name: 'Cred B (Unstable 503)',
    status: 'active',
    priority: 2,
    weight: 10,
    secret: 'AIzaSyCredBPlaintextKey1234567890',
  });

  // Credential A: 10 successes
  for (let i = 0; i < 10; i++) {
    await healthService.recordSuccess(credA.id);
  }

  const healthA = await healthService.getHealth(credA.id);
  console.log('Credential A Health after 10 successes:', healthA);

  if (healthA.status !== 'healthy') {
    throw new Error(`Test Failed: Credential A should be healthy, got ${healthA.status}`);
  }

  // Credential B: 5 failures with 503 Service Unavailable
  for (let i = 0; i < 5; i++) {
    await healthService.recordFailure(credB.id, 'Service Unavailable 503 Overloaded', 503);
  }

  const healthB = await healthService.getHealth(credB.id);
  console.log('Credential B Health after 5 failures (503):', healthB);

  const isAvailableB = await healthService.isAvailable(credB.id);
  console.log('Is Credential B available?', isAvailableB);

  if (isAvailableB) {
    throw new Error('Test Failed: Credential B in cooldown/down should not be available');
  }

  if (!healthB.cooldownUntil || healthB.cooldownUntil <= Date.now()) {
    throw new Error('Test Failed: Credential B should have an active cooldownUntil timestamp');
  }

  console.log('✅ Health Simulation Test Passed: Credential A remained healthy (10 successes), Credential B entered cooldown/down (5 x 503 failures).');

  // Cleanup
  await credentialService.removeCredential(credA.id);
  await credentialService.removeCredential(credB.id);

  console.log('🎉 Health Simulation Test Completed Successfully!');
}

runHealthSimulation().catch(err => {
  console.error('❌ Health Simulation Error:', err);
  process.exit(1);
});
