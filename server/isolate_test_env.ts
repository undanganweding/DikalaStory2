// Force local JSON store and disable live Firestore to prevent network quota limits (e.g. 8 RESOURCE_EXHAUSTED) during test execution.
process.env.FORCE_LOCAL_DB = 'true';
process.env.MOCK_SUPABASE = 'true';
if (!process.env.SUPABASE_URL) process.env.SUPABASE_URL = 'https://sandbox.supabase.co';
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = 'sandbox-service-key';
if (!process.env.AI_SECRET_MASTER_KEY) process.env.AI_SECRET_MASTER_KEY = 'sinema-isolated-test-master-key-32-bytes!!';
delete process.env.FIREBASE_PROJECT_ID;
delete process.env.GOOGLE_CLOUD_PROJECT;
delete process.env.GCLOUD_PROJECT;
delete process.env.FIRESTORE_PROJECT_ID;
delete process.env.FIREBASE_CLIENT_EMAIL;
delete process.env.FIREBASE_PRIVATE_KEY;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

console.log('[ISOLATION] Test environment successfully isolated. FORCE_LOCAL_DB=true.');
