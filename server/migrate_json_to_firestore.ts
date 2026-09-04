/**
 * MIGRATION SCRIPT: firestore_store.json -> Firestore database "sinema"
 *
 * Sumber data: data/firestore_store.json.apikeysanitizebak (backup valid 306KB)
 * Tujuan: Firestore database "sinema" di project nupress-bc617
 *
 * Format penulisan mengikuti PERSIS pola yang dipakai server/db.ts:
 *   - projects, project_foundation, characters, locations, objects,
 *     scenes, shots, video_prompts, story_architectures  -> dokumen dengan ID asli
 *   - logs, telemetry                                    -> subcollection projects/{id}/logs & /telemetry (auto-id)
 *   - continuity_states                                  -> dokumen berisi ARRAY (bukan map)
 *
 * Usage:
 *   .\node_modules\.bin\tsx.cmd -r dotenv/config server/migrate_json_to_firestore.ts
 */

import fs from 'fs';
import path from 'path';
import { getFirestore, isFirestoreConfigured, getDatabaseId } from './firebase_admin';
import { sanitizeForFirestore } from './db';

const SOURCE_FILE = path.join(process.cwd(), 'data', 'firestore_store.json.apikeysanitizebak');

interface LegacyState {
  projects: Record<string, any>;
  project_foundation: Record<string, any>;
  characters: Record<string, any>;
  locations: Record<string, any>;
  objects: Record<string, any>;
  scenes: Record<string, any>;
  shots: Record<string, any>;
  video_prompts: Record<string, any>;
  logs: Record<string, any[]>;
  telemetry: Record<string, any[]>;
  story_architectures: Record<string, any>;
  continuity_states: Record<string, any[]>;
  continuity_snapshots: Record<string, any>;
}

function emptyState(): LegacyState {
  return {
    projects: {}, project_foundation: {}, characters: {}, locations: {},
    objects: {}, scenes: {}, shots: {}, video_prompts: {},
    logs: {}, telemetry: {}, story_architectures: {},
    continuity_states: {}, continuity_snapshots: {},
  };
}

function loadLegacyState(): LegacyState {
  if (!fs.existsSync(SOURCE_FILE)) {
    throw new Error(`Source file not found: ${SOURCE_FILE}`);
  }
  const raw = fs.readFileSync(SOURCE_FILE, 'utf-8');
  const parsed = JSON.parse(raw);
  return { ...emptyState(), ...parsed };
}

async function main(): Promise<void> {
  console.log('=== MIGRATION: JSON -> FIRESTORE (sinema) ===');
  if (!isFirestoreConfigured()) {
    throw new Error('Firestore not configured. Check .env');
  }
  console.log(`databaseId=${getDatabaseId()}`);
  const fsdb = getFirestore();
  const state = loadLegacyState();

  const counts: Record<string, number> = {};

  // --- 1) Simple document collections (id -> doc) ---
  const docCollections: Array<keyof LegacyState> = [
    'projects', 'project_foundation', 'characters', 'locations',
    'objects', 'scenes', 'shots', 'video_prompts', 'story_architectures',
  ];
  for (const coll of docCollections) {
    const entries = Object.entries(state[coll] as Record<string, any>);
    counts[coll] = entries.length;
    for (const [id, data] of entries) {
      await fsdb.collection(coll).doc(id).set(sanitizeForFirestore(data), { merge: true });
    }
    console.log(`[OK] ${coll}: ${entries.length} docs`);
  }

  // --- 2) logs & telemetry -> subcollection projects/{projectId}/logs|telemetry ---
  for (const [coll, kind] of [['logs', 'logs'], ['telemetry', 'telemetry']] as const) {
    let total = 0;
    for (const [projectId, items] of Object.entries(state[coll] as Record<string, any[]>)) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const payload = kind === 'logs' ? { ...item, project_id: projectId } : item;
        await fsdb.collection(`projects/${projectId}/${kind}`).add(sanitizeForFirestore(payload));
        total++;
      }
    }
    counts[coll] = total;
    console.log(`[OK] ${coll}: ${total} entries -> projects/{id}/${kind}`);
  }

  // --- 3) continuity_states -> single doc containing an ARRAY ---
  // NOTE: Firestore does NOT allow an array as a document root. If the array is
  // empty (or would be empty), skip writing so the app regenerates it from
  // characters at read time (same as db.ts getCharacterContinuityStates).
  let csTotal = 0;
  for (const [projectId, states] of Object.entries(state.continuity_states)) {
    if (!Array.isArray(states)) continue;
    if (states.length === 0) {
      console.log(`[SKIP] continuity_states: ${projectId} (empty array, skip)`);
      continue;
    }
    await fsdb.collection('continuity_states').doc(projectId).set(sanitizeForFirestore(states));
    csTotal++;
    console.log(`[OK] continuity_states: ${projectId} (${states.length} states)`);
  }
  counts['continuity_states'] = csTotal;

  // --- 4) continuity_snapshots -> doc per key ---
  for (const [key, snapshot] of Object.entries(state.continuity_snapshots)) {
    await fsdb.collection('continuity_snapshots').doc(key).set(sanitizeForFirestore(snapshot));
  }
  counts['continuity_snapshots'] = Object.keys(state.continuity_snapshots).length;
  console.log(`[OK] continuity_snapshots: ${counts['continuity_snapshots']} docs`);

  console.log('=== MIGRATION SUMMARY ===');
  for (const [coll, n] of Object.entries(counts)) {
    console.log(`  ${coll}: ${n}`);
  }
  console.log('=== MIGRATION DONE ===');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Migration failed:', err?.message ?? err);
  process.exit(1);
});
