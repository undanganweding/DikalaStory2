import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { cert, initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'nupress-bc617';
const DATABASE_ID = 'sinema';
const APP_NAME = 'backup-utility-nupress-sinema';

function getSHA256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function serializeFirestoreData(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val?.toDate === 'function') {
    return val.toDate().toISOString();
  }
  if (typeof val?.latitude === 'number' && typeof val?.longitude === 'number') {
    return { _type: 'GeoPoint', latitude: val.latitude, longitude: val.longitude };
  }
  if (typeof val?.path === 'string' && val?.id && val?.firestore) {
    return { _type: 'DocumentReference', path: val.path };
  }
  if (Array.isArray(val)) {
    return val.map(serializeFirestoreData);
  }
  if (typeof val === 'object') {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = serializeFirestoreData(v);
    }
    return res;
  }
  return val;
}

async function runBackupUtility() {
  console.log('================================================================');
  console.log('    READ-ONLY FIRESTORE LIVE BACKUP UTILITY (STRICT SAFETY)    ');
  console.log('================================================================');
  console.log(`Target Project ID  : ${PROJECT_ID}`);
  console.log(`Target Database ID : ${DATABASE_ID}`);
  console.log(`Mode               : STRICT READ-ONLY (NO WRITE/UPDATE/DELETE)`);
  console.log(`Timestamp          : ${new Date().toISOString()}`);
  console.log('----------------------------------------------------------------\n');

  // Initialize Firebase Admin for nupress-bc617 / sinema database
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  let app;
  const existingApps = getApps();
  const foundApp = existingApps.find(a => a.name === APP_NAME);

  if (foundApp) {
    app = foundApp;
  } else if (clientEmail && privateKey) {
    app = initializeApp(
      {
        credential: cert({
          projectId: PROJECT_ID,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      },
      APP_NAME
    );
  } else {
    app = initializeApp({ projectId: PROJECT_ID }, APP_NAME);
  }

  const db = getFirestore(app, DATABASE_ID);

  // STEP 1: CONNECTIVITY PROBE
  console.log('[PROBE] Initiating connectivity probe on collection "projects" limit(1)...');
  let probePassed = false;
  let probeDocCount = 0;

  try {
    const probeSnapshot = await db.collection('projects').limit(1).get();
    probeDocCount = probeSnapshot.size;
    probePassed = true;
    console.log(`[PROBE SUCCESS] Successfully connected to "${PROJECT_ID}" / database "${DATABASE_ID}".`);
    console.log(`[PROBE SUCCESS] Probe retrieved ${probeDocCount} document(s) from collection "projects".`);
  } catch (err: any) {
    console.error(`[PROBE FAILED] Unable to connect or read from "${PROJECT_ID}" / database "${DATABASE_ID}".`);
    console.error(`Error Code   : ${err?.code ?? err?.status ?? 'UNKNOWN'}`);
    console.error(`Error Message: ${err?.message ?? String(err)}`);
    if (err?.details) {
      console.error(`Error Details: ${JSON.stringify(err.details)}`);
    }
    console.log('\n[HALTED] Connectivity probe failed. Aborting backup process without making any changes.');
    process.exit(1);
  }

  // STEP 2: FULL COLLECTION EXPORT (PROBE PASSED)
  console.log('\n[EXPORT] Probe PASS! Commencing full export of all collections...');

  const knownCollections = [
    'projects',
    'project_foundation',
    'characters',
    'locations',
    'objects',
    'scenes',
    'shots',
    'video_prompts',
    'story_architectures',
    'continuity_states',
    'continuity_snapshots',
    'logs',
    'pipeline_logs',
    'telemetry',
    'stage_telemetry',
    'ai_providers',
    'ai_credentials',
    'ai_models',
    'ai_usage',
    'ai_health',
    'ai_routing_policies'
  ];

  // Try to list all active collections dynamically via Admin SDK if available
  const allCollectionsSet = new Set<string>(knownCollections);
  try {
    const collectionsList = await db.listCollections();
    for (const col of collectionsList) {
      allCollectionsSet.add(col.id);
    }
  } catch (e: any) {
    console.log(`[NOTE] Dynamic listCollections() returned: ${e?.message ?? String(e)}. Falling back to comprehensive known collections list.`);
  }

  const targetCols = Array.from(allCollectionsSet);
  console.log(`Targeting ${targetCols.length} collection(s) for extraction.`);

  const exportDir = path.resolve(process.cwd(), 'data', 'live_backup_sinema', 'collections');
  fs.mkdirSync(exportDir, { recursive: true });

  const collectionExportSummary: Record<string, { record_count: number; file_size_bytes: number; sha256: string; file_path: string; error?: string }> = {};
  let totalRecordsExported = 0;

  for (const colName of targetCols) {
    try {
      const snap = await db.collection(colName).get();
      const docs: any[] = [];

      snap.forEach(doc => {
        docs.push({
          _id: doc.id,
          ...serializeFirestoreData(doc.data())
        });
      });

      const jsonStr = JSON.stringify(docs, null, 2);
      const sha256 = getSHA256(jsonStr);
      const fileName = `${colName}.json`;
      const filePath = path.join(exportDir, fileName);

      fs.writeFileSync(filePath, jsonStr, 'utf-8');

      const stat = fs.statSync(filePath);
      collectionExportSummary[colName] = {
        record_count: docs.length,
        file_size_bytes: stat.size,
        sha256,
        file_path: filePath
      };

      totalRecordsExported += docs.length;
      console.log(` - Extracted collection "${colName}": ${docs.length} record(s) -> ${stat.size} bytes (SHA256: ${sha256.substring(0, 12)}...)`);
    } catch (colErr: any) {
      console.error(` - [ERROR] Failed to export collection "${colName}": ${colErr?.message ?? String(colErr)}`);
      collectionExportSummary[colName] = {
        record_count: 0,
        file_size_bytes: 0,
        sha256: 'N/A',
        file_path: 'N/A',
        error: colErr?.message ?? String(colErr)
      };
    }
  }

  // STEP 3: GENERATE MANIFEST
  console.log('\n[MANIFEST] Generating backup manifest...');

  const manifestData: any = {
    backup_metadata: {
      utility: 'READ-ONLY Firestore Live Backup Utility',
      project_id: PROJECT_ID,
      database_id: DATABASE_ID,
      mode: 'READ_ONLY',
      timestamp: new Date().toISOString(),
      probe_status: 'PASS',
      probe_doc_count: probeDocCount,
      total_collections_processed: targetCols.length,
      total_records_exported: totalRecordsExported
    },
    collections: collectionExportSummary
  };

  const manifestJsonStr = JSON.stringify(manifestData, null, 2);
  const manifestSha256 = getSHA256(manifestJsonStr);
  manifestData.manifest_checksum_sha256 = manifestSha256;

  const manifestFilePath = path.resolve(process.cwd(), 'data', 'live_backup_sinema', 'manifest.json');
  fs.writeFileSync(manifestFilePath, JSON.stringify(manifestData, null, 2), 'utf-8');

  console.log('\n================================================================');
  console.log('                BACKUP UTILITY EXECUTION SUMMARY                ');
  console.log('================================================================');
  console.log(`Probe Status         : PASS`);
  console.log(`Project / DB         : ${PROJECT_ID} / ${DATABASE_ID}`);
  console.log(`Total Collections    : ${targetCols.length}`);
  console.log(`Total Records        : ${totalRecordsExported}`);
  console.log(`Manifest Path        : ${manifestFilePath}`);
  console.log(`Manifest SHA-256     : ${manifestSha256}`);
  console.log(`Collections Folder   : ${exportDir}`);
  console.log(`Safety Guarantee     : 0 Write / 0 Delete / 0 Update performed.`);
  console.log('================================================================\n');
}

runBackupUtility().catch(err => {
  console.error('[FATAL] Backup utility encountered unhandled exception:', err);
  process.exit(1);
});
