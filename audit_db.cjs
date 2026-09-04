const fs = require('fs');
const path = require('path');

async function run() {
  console.log('=== EMERGENCY DB AUDIT ===\n');

  // 1. Check environments
  console.log('--- Environment Variables ---');
  console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID || 'undefined');
  console.log('GOOGLE_CLOUD_PROJECT:', process.env.GOOGLE_CLOUD_PROJECT || 'undefined');
  console.log('GCLOUD_PROJECT:', process.env.GCLOUD_PROJECT || 'undefined');
  console.log('FORCE_LOCAL_DB:', process.env.FORCE_LOCAL_DB || 'undefined');
  console.log('isFirestoreConfigured:', !!(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_PROJECT_ID));

  // 2. Read local store JSON
  const localStorePath = path.join(__dirname, 'data', 'firestore_store.json');
  const localBakPath = path.join(__dirname, 'data', 'firestore_store.json.bak');

  console.log('\n--- Local Storage (JSON) ---');
  [localStorePath, localBakPath].forEach(filePath => {
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        const creds = data.ai_credentials || {};
        console.log(`File: ${path.basename(filePath)}`);
        console.log(`  Credential Count: ${Object.keys(creds).length}`);
        for (const [id, c] of Object.entries(creds)) {
          console.log(`    - ID: ${id}`);
          console.log(`      Name: ${c.name}`);
          console.log(`      Provider: ${c.providerId}`);
          console.log(`      Status: ${c.status}`);
          console.log(`      Created: ${c.createdAt}`);
          console.log(`      Has Secret: ${!!c.encryptedSecret || !!c.secret}`);
        }
      } catch (err) {
        console.log(`  Error parsing ${path.basename(filePath)}:`, err.message);
      }
    } else {
      console.log(`File does not exist: ${path.basename(filePath)}`);
    }
  });

  // 3. Inspect Firestore (real cloud storage)
  console.log('\n--- Firestore (Cloud DB) ---');
  try {
    const { db } = require('./server/db');
    const isLocal = process.env.FORCE_LOCAL_DB === 'true';
    if (!isLocal) {
      console.log('Reading from live DB (Firestore)...');
      const creds = await db.getCredentials();
      console.log(`  Live Credential Count: ${creds.length}`);
      creds.forEach(c => {
        console.log(`    - ID: ${c.id}`);
        console.log(`      Name: ${c.name}`);
        console.log(`      Provider: ${c.providerId}`);
        console.log(`      Status: ${c.status}`);
        console.log(`      Created: ${c.createdAt}`);
        console.log(`      Has Secret: ${!!c.encryptedSecret || !!c.secret}`);
      });
    } else {
      console.log('Skipping live DB check because FORCE_LOCAL_DB is true');
    }
  } catch (err) {
    console.log('  Failed to read from Firestore:', err.message);
  }
}

run().catch(err => console.error('Audit Error:', err));
