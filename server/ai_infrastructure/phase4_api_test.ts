// Force local JSON store and disable live Firestore to prevent network quota limits (e.g. 8 RESOURCE_EXHAUSTED) during test execution.
process.env.FORCE_LOCAL_DB = 'true';
delete process.env.FIREBASE_PROJECT_ID;
delete process.env.GOOGLE_CLOUD_PROJECT;
delete process.env.GCLOUD_PROJECT;
delete process.env.FIRESTORE_PROJECT_ID;
delete process.env.FIREBASE_CLIENT_EMAIL;
delete process.env.FIREBASE_PRIVATE_KEY;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

import { createApp } from '../app';
import request from 'supertest';
import { credentialService } from './credential_service';

async function runPhase4Tests() {
  console.log('Running Phase 4 Control Plane API Integration Tests...');

  if (!process.env.AI_SECRET_MASTER_KEY) {
    process.env.AI_SECRET_MASTER_KEY = 'test-master-secret-key-phase4-12345';
  }

  const app = createApp();

  // 1. Test GET /api/ai/providers
  const providersRes = await request(app).get('/api/ai/providers');
  if (providersRes.status !== 200 || !Array.isArray(providersRes.body)) {
    throw new Error(`GET /api/ai/providers failed: status ${providersRes.status}`);
  }
  console.log('✅ GET /api/ai/providers passed:', providersRes.body.length, 'providers');

  // 2. Test POST /api/ai/credentials (Add key)
  const addRes = await request(app)
    .post('/api/ai/credentials')
    .send({
      providerId: 'google',
      name: 'Test Control Center Key',
      secret: 'AIzaSyTestControlCenterApiKey1234567890',
      priority: 1,
    });

  if (addRes.status !== 201 || !addRes.body.id) {
    throw new Error(`POST /api/ai/credentials failed: status ${addRes.status}, body: ${JSON.stringify(addRes.body)}`);
  }
  const createdId = addRes.body.id;
  console.log('✅ POST /api/ai/credentials passed, created ID:', createdId);

  // 3. Test GET /api/ai/credentials (Verify sanitization - no encryptedSecret or plaintext secret)
  const credsRes = await request(app).get('/api/ai/credentials');
  if (credsRes.status !== 200 || !Array.isArray(credsRes.body)) {
    throw new Error(`GET /api/ai/credentials failed: status ${credsRes.status}`);
  }

  const found = credsRes.body.find((c: any) => c.id === createdId);
  if (!found) {
    throw new Error('Created credential not found in list');
  }
  if (found.encryptedSecret || found.secret || found.apiKey) {
    throw new Error('SECURITY VIOLATION: credential list exposed secret or encryptedSecret!');
  }
  console.log('✅ GET /api/ai/credentials passed & sanitized successfully (maskedKey:', found.maskedKey, ')');

  // 4. Test GET /api/ai/intelligence
  const intelRes = await request(app).get('/api/ai/intelligence');
  if (intelRes.status !== 200 || intelRes.body.totalCredentials === undefined) {
    throw new Error(`GET /api/ai/intelligence failed: status ${intelRes.status}`);
  }
  console.log('✅ GET /api/ai/intelligence passed:', intelRes.body);

  // 5. Test DELETE /api/ai/credentials/:id
  const delRes = await request(app).delete(`/api/ai/credentials/${createdId}`);
  if (delRes.status !== 200 || !delRes.body.success) {
    throw new Error(`DELETE /api/ai/credentials/:id failed: status ${delRes.status}`);
  }
  console.log('✅ DELETE /api/ai/credentials/:id passed');

  console.log('🎉 All Phase 4 Control Plane API Integration Tests Passed Successfully!');
}

runPhase4Tests().catch(err => {
  console.error('❌ Phase 4 API Test Error:', err);
  process.exit(1);
});
