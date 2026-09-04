const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const sourceFiles = [
  './data/firestore_store.json',
  './data/firestore_store.json.bak',
  './data/firestore_store.json.apikeysanitizebak'
];

function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  return {
    size: content.length,
    sha256: crypto.createHash('sha256').update(content).digest('hex')
  };
}

console.log('=== INITIAL SOURCE FILE HASHES ===');
const initialHashes = {};
for (const f of sourceFiles) {
  const meta = getFileHash(f);
  initialHashes[f] = meta;
  console.log(f + ' -> Size: ' + (meta ? meta.size : 'N/A') + ' | SHA256: ' + (meta ? meta.sha256 : 'N/A'));
}

const candidateIDs = [
  'proj_1788273397361_00cn4c',
  'proj_1788265334910_pp698g',
  'proj_1788114675178_9uas6v'
];

// Helper to load store JSON safely
function loadStore(f) {
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf-8'));
}

const stores = {
  main: loadStore(sourceFiles[0]),
  bak: loadStore(sourceFiles[1]),
  sanitize: loadStore(sourceFiles[2])
};

const collectionsList = [
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
  'stage_telemetry'
];

function getCollectionItems(storeObj, colName) {
  if (!storeObj || !storeObj[colName]) return [];
  const val = storeObj[colName];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') return Object.values(val);
  return [];
}

// Extraction logic
function extractCandidatesFromStore(storeObj, storeName) {
  const extracted = {
    storeName,
    projects: [],
    project_foundation: [],
    characters: [],
    locations: [],
    objects: [],
    scenes: [],
    shots: [],
    video_prompts: [],
    story_architectures: [],
    continuity_states: [],
    continuity_snapshots: [],
    logs: [],
    telemetry: []
  };

  if (!storeObj) return extracted;

  const projects = getCollectionItems(storeObj, 'projects');
  const matchedProjects = projects.filter(p => candidateIDs.includes(p.id));
  extracted.projects = matchedProjects;

  const matchedPids = new Set(matchedProjects.map(p => p.id));

  // Extract related sub-records
  for (const col of collectionsList) {
    if (col === 'projects') continue;
    const items = getCollectionItems(storeObj, col);
    const related = items.filter(item => {
      if (item.project_id && matchedPids.has(item.project_id)) return true;
      if (col === 'project_foundation' && item.id && matchedPids.has(item.id)) return true;
      return false;
    });

    if (col === 'pipeline_logs' || col === 'logs') {
      extracted.logs.push(...related);
    } else if (col === 'stage_telemetry' || col === 'telemetry') {
      extracted.telemetry.push(...related);
    } else if (extracted[col]) {
      extracted[col].push(...related);
    }
  }

  return extracted;
}

const mainExtracted = extractCandidatesFromStore(stores.main, 'firestore_store.json');
const bakExtracted = extractCandidatesFromStore(stores.bak, 'firestore_store.json.bak');
const sanitizeExtracted = extractCandidatesFromStore(stores.sanitize, 'firestore_store.json.apikeysanitizebak');

console.log('\n=== CANDIDATES FOUND IN SNAPSHOTS ===');
console.log('Main Store (firestore_store.json):', mainExtracted.projects.map(p => p.id));
console.log('Bak Store (firestore_store.json.bak):', bakExtracted.projects.map(p => p.id));
console.log('Sanitize Store (.apikeysanitizebak):', sanitizeExtracted.projects.map(p => p.id));

// Combine candidate records from appropriate sources
// Candidates 1 & 2 come from main store (and bak store)
// Candidate 3 comes from sanitize store (.apikeysanitizebak)

// Let's perform Referential Validation for each candidate
function validateCandidate(pid, sourceStoreObj, storeLabel) {
  const report = {
    project_id: pid,
    storeLabel,
    projectExists: false,
    title: 'N/A',
    created_at: 'N/A',
    updated_at: 'N/A',
    status: 'N/A',
    current_stage: 'N/A',
    script_length: 0,
    counts: {
      foundation: 0,
      character: 0,
      location: 0,
      object: 0,
      scene: 0,
      shot: 0,
      video_prompt: 0,
      story_architecture: 0,
      continuity: 0,
      log: 0,
      telemetry: 0
    },
    issues: [],
    referential_integrity: 'PASS'
  };

  const projects = getCollectionItems(sourceStoreObj, 'projects');
  const project = projects.find(p => p.id === pid);

  if (!project) {
    report.issues.push(`Project ${pid} not found in store ${storeLabel}`);
    report.referential_integrity = 'FAIL';
    return report;
  }

  report.projectExists = true;
  report.title = project.title || '[Untitled]';
  report.created_at = project.created_at || project.createdAt || 'N/A';
  report.updated_at = project.updated_at || project.updatedAt || 'N/A';
  report.status = project.status || 'N/A';
  report.current_stage = project.current_stage || project.stage || project.foundation_status || 'N/A';
  report.script_length = (project.raw_script || '').length;

  // Validate timestamps
  if (isNaN(Date.parse(report.created_at))) {
    report.issues.push(`Malformed created_at timestamp: ${report.created_at}`);
  }
  if (isNaN(Date.parse(report.updated_at))) {
    report.issues.push(`Malformed updated_at timestamp: ${report.updated_at}`);
  }

  // Check sub-collections
  const foundations = getCollectionItems(sourceStoreObj, 'project_foundation').filter(x => x.project_id === pid || x.id === pid);
  const characters = getCollectionItems(sourceStoreObj, 'characters').filter(x => x.project_id === pid);
  const locations = getCollectionItems(sourceStoreObj, 'locations').filter(x => x.project_id === pid);
  const objects = getCollectionItems(sourceStoreObj, 'objects').filter(x => x.project_id === pid);
  const scenes = getCollectionItems(sourceStoreObj, 'scenes').filter(x => x.project_id === pid);
  const shots = getCollectionItems(sourceStoreObj, 'shots').filter(x => x.project_id === pid);
  const videoPrompts = getCollectionItems(sourceStoreObj, 'video_prompts').filter(x => x.project_id === pid);
  const storyArchs = getCollectionItems(sourceStoreObj, 'story_architectures').filter(x => x.project_id === pid);
  const continuityStates = getCollectionItems(sourceStoreObj, 'continuity_states').filter(x => x.project_id === pid);
  const continuitySnaps = getCollectionItems(sourceStoreObj, 'continuity_snapshots').filter(x => x.project_id === pid);
  const logs = [
    ...getCollectionItems(sourceStoreObj, 'logs'),
    ...getCollectionItems(sourceStoreObj, 'pipeline_logs')
  ].filter(x => x.project_id === pid);
  const telemetry = [
    ...getCollectionItems(sourceStoreObj, 'telemetry'),
    ...getCollectionItems(sourceStoreObj, 'stage_telemetry')
  ].filter(x => x.project_id === pid);

  report.counts.foundation = foundations.length;
  report.counts.character = characters.length;
  report.counts.location = locations.length;
  report.counts.object = objects.length;
  report.counts.scene = scenes.length;
  report.counts.shot = shots.length;
  report.counts.video_prompt = videoPrompts.length;
  report.counts.story_architecture = storyArchs.length;
  report.counts.continuity = continuityStates.length + continuitySnaps.length;
  report.counts.log = logs.length;
  report.counts.telemetry = telemetry.length;

  // Referential Integrity Checks
  // 1. Foundation
  for (const f of foundations) {
    if (f.project_id && f.project_id !== pid) {
      report.issues.push(`Foundation ${f.id} project_id mismatch: ${f.project_id} vs ${pid}`);
    }
  }

  // 2. Characters & Locations & Objects
  for (const c of characters) {
    if (c.project_id !== pid) report.issues.push(`Character ${c.id} wrong project_id`);
    if (!c.name && !c.character_name) report.issues.push(`Character ${c.id} missing name`);
  }
  for (const l of locations) {
    if (l.project_id !== pid) report.issues.push(`Location ${l.id} wrong project_id`);
  }
  for (const o of objects) {
    if (o.project_id !== pid) report.issues.push(`Object ${o.id} wrong project_id`);
  }

  // 3. Scenes
  const sceneIds = new Set(scenes.map(s => s.id));
  for (const s of scenes) {
    if (s.project_id !== pid) report.issues.push(`Scene ${s.id} wrong project_id`);
  }

  // 4. Shots -> Scene / Project
  const shotIds = new Set(shots.map(sh => sh.id));
  for (const sh of shots) {
    if (sh.project_id !== pid) report.issues.push(`Shot ${sh.id} wrong project_id`);
    if (sh.scene_id && !sceneIds.has(sh.scene_id)) {
      report.issues.push(`Shot ${sh.id} references orphan scene_id ${sh.scene_id}`);
    }
  }

  // 5. Video Prompts -> Shot / Scene / Project
  for (const vp of videoPrompts) {
    if (vp.project_id !== pid) report.issues.push(`VideoPrompt ${vp.id} wrong project_id`);
    if (vp.shot_id && !shotIds.has(vp.shot_id)) {
      report.issues.push(`VideoPrompt ${vp.id} references orphan shot_id ${vp.shot_id}`);
    }
  }

  if (report.issues.length > 0) {
    report.referential_integrity = 'FAIL_ISSUES_FOUND';
  }

  return report;
}

console.log('\n=== REFERENTIAL VALIDATION REPORTS ===');
const valHasanA = validateCandidate('proj_1788273397361_00cn4c', stores.main, 'firestore_store.json');
const valHasanB = validateCandidate('proj_1788265334910_pp698g', stores.main, 'firestore_store.json');
const valLahirCahaya = validateCandidate('proj_1788114675178_9uas6v', stores.sanitize, 'firestore_store.json.apikeysanitizebak');

console.log('1. Hasan Munadi A (proj_1788273397361_00cn4c):', JSON.stringify(valHasanA, null, 2));
console.log('2. Hasan Munadi B (proj_1788265334910_pp698g):', JSON.stringify(valHasanB, null, 2));
console.log('3. Lahirnya Cahaya (proj_1788114675178_9uas6v):', JSON.stringify(valLahirCahaya, null, 2));

// Hasan Munadi Duplicate Analysis
console.log('\n=== HASAN MUNADI DUPLICATE ANALYSIS ===');
const pA = getCollectionItems(stores.main, 'projects').find(p => p.id === 'proj_1788273397361_00cn4c');
const pB = getCollectionItems(stores.main, 'projects').find(p => p.id === 'proj_1788265334910_pp698g');

const compareFields = {
  title: pA.title === pB.title,
  raw_script: pA.raw_script === pB.raw_script,
  created_at: { A: pA.created_at, B: pB.created_at },
  updated_at: { A: pA.updated_at, B: pB.updated_at },
  status: { A: pA.status, B: pB.status },
  current_stage: { A: pA.current_stage, B: pB.current_stage },
  countsA: valHasanA.counts,
  countsB: valHasanB.counts
};

console.log('Comparison breakdown:', JSON.stringify(compareFields, null, 2));

// Detailed sub-record comparison for Hasan Munadi A vs B
const charsA = getCollectionItems(stores.main, 'characters').filter(x => x.project_id === 'proj_1788273397361_00cn4c');
const charsB = getCollectionItems(stores.main, 'characters').filter(x => x.project_id === 'proj_1788265334910_pp698g');
const locsA = getCollectionItems(stores.main, 'locations').filter(x => x.project_id === 'proj_1788273397361_00cn4c');
const locsB = getCollectionItems(stores.main, 'locations').filter(x => x.project_id === 'proj_1788265334910_pp698g');
const foundA = getCollectionItems(stores.main, 'project_foundation').filter(x => x.project_id === 'proj_1788273397361_00cn4c' || x.id === 'proj_1788273397361_00cn4c');
const foundB = getCollectionItems(stores.main, 'project_foundation').filter(x => x.project_id === 'proj_1788265334910_pp698g' || x.id === 'proj_1788265334910_pp698g');

console.log('Sub-record details Hasan A:', {
  foundation: foundA.map(f => ({ id: f.id, stage: f.current_stage || f.stage })),
  characters: charsA.map(c => ({ id: c.id, name: c.name || c.character_name })),
  locations: locsA.map(l => ({ id: l.id, name: l.name || l.location_name }))
});

console.log('Sub-record details Hasan B:', {
  foundation: foundB.map(f => ({ id: f.id, stage: f.current_stage || f.stage })),
  characters: charsB.map(c => ({ id: c.id, name: c.name || c.character_name })),
  locations: locsB.map(l => ({ id: l.id, name: l.name || l.location_name }))
});

/*
DETERMINATION:
- Hasan Munadi A (`proj_1788273397361_00cn4c`): Created at 2026-09-02T15:16:37.361Z. Stage 2. Has Foundation record, Character record ("Hasan Munadi"), Location record ("Lereng Gunung Ungaran").
- Hasan Munadi B (`proj_1788265334910_pp698g`): Created at 2026-09-02T13:02:14.910Z. Stage 1. Has 0 Foundation records, 0 Characters, 0 Locations.
- Both have identical 2,478-character raw_script and identical title.
- CONCLUSION: Option A — SAME PROJECT / LATER VERSION.
  Hasan Munadi A (`proj_1788273397361_00cn4c`) is the CANONICAL LATER VERSION (created ~2 hours after B, advanced to Stage 2 with extracted Foundation, Characters, and Locations).
  Hasan Munadi B (`proj_1788265334910_pp698g`) is an earlier, incomplete Stage 1 draft.
*/

// Snapshot Consistency Analysis
console.log('\n=== SNAPSHOT CONSISTENCY ANALYSIS ===');
// Check Hasan A across main and bak
const hasanA_main = getCollectionItems(stores.main, 'projects').find(p => p.id === 'proj_1788273397361_00cn4c');
const hasanA_bak = getCollectionItems(stores.bak, 'projects').find(p => p.id === 'proj_1788273397361_00cn4c');
const hasanA_san = getCollectionItems(stores.sanitize, 'projects').find(p => p.id === 'proj_1788273397361_00cn4c');

console.log('Hasan A in main vs bak vs sanitize:', {
  inMain: !!hasanA_main,
  inBak: !!hasanA_bak,
  inSanitize: !!hasanA_san,
  mainBakIdentical: JSON.stringify(hasanA_main) === JSON.stringify(hasanA_bak)
});

// Check Hasan B across main and bak
const hasanB_main = getCollectionItems(stores.main, 'projects').find(p => p.id === 'proj_1788265334910_pp698g');
const hasanB_bak = getCollectionItems(stores.bak, 'projects').find(p => p.id === 'proj_1788265334910_pp698g');
const hasanB_san = getCollectionItems(stores.sanitize, 'projects').find(p => p.id === 'proj_1788265334910_pp698g');

console.log('Hasan B in main vs bak vs sanitize:', {
  inMain: !!hasanB_main,
  inBak: !!hasanB_bak,
  inSanitize: !!hasanB_san,
  mainBakIdentical: JSON.stringify(hasanB_main) === JSON.stringify(hasanB_bak)
});

// Check Lahirnya Cahaya across main and sanitize
const lahir_main = getCollectionItems(stores.main, 'projects').find(p => p.id === 'proj_1788114675178_9uas6v');
const lahir_bak = getCollectionItems(stores.bak, 'projects').find(p => p.id === 'proj_1788114675178_9uas6v');
const lahir_san = getCollectionItems(stores.sanitize, 'projects').find(p => p.id === 'proj_1788114675178_9uas6v');

console.log('Lahirnya Cahaya in main vs bak vs sanitize:', {
  inMain: !!lahir_main,
  inBak: !!lahir_bak,
  inSanitize: !!lahir_san
});

// Construct Migration Package
console.log('\n=== GENERATING MIGRATION PACKAGE ARTIFACT ===');

const packagePids = [
  'proj_1788273397361_00cn4c', // Hasan Munadi A (Canonical candidate)
  'proj_1788265334910_pp698g', // Hasan Munadi B (Preserved as historical candidate record, noted as superseded)
  'proj_1788114675178_9uas6v'  // Lahirnya Cahaya (Extracted from .apikeysanitizebak)
];

const packagePidsSet = new Set(packagePids);

const migrationPackage = {
  meta: {
    package_name: 'PRODUCTION_CANDIDATES_EXTRACTION_PHASE_3_2',
    generated_at: new Date().toISOString(),
    provenance_warning: 'LOCAL SNAPSHOT ≠ VERIFIED FIRESTORE PRODUCTION BACKUP. This package is an extracted candidate dataset from local dev snapshots for migration validation.',
    canonical_recommendation: {
      hasan_munadi_canonical: 'proj_1788273397361_00cn4c',
      hasan_munadi_obsolete_draft: 'proj_1788265334910_pp698g'
    },
    sources: {
      'proj_1788273397361_00cn4c': 'firestore_store.json',
      'proj_1788265334910_pp698g': 'firestore_store.json',
      'proj_1788114675178_9uas6v': 'firestore_store.json.apikeysanitizebak'
    }
  },
  data: {
    projects: [],
    project_foundation: [],
    characters: [],
    locations: [],
    objects: [],
    scenes: [],
    shots: [],
    video_prompts: [],
    story_architectures: [],
    continuity_states: [],
    continuity_snapshots: [],
    logs: [],
    telemetry: []
  }
};

// Add Projects
const projMain = getCollectionItems(stores.main, 'projects').filter(p => p.id === 'proj_1788273397361_00cn4c' || p.id === 'proj_1788265334910_pp698g');
const projSan = getCollectionItems(stores.sanitize, 'projects').filter(p => p.id === 'proj_1788114675178_9uas6v');
migrationPackage.data.projects = [...projMain, ...projSan];

// Add Sub-collections
for (const colName of Object.keys(migrationPackage.data)) {
  if (colName === 'projects') continue;

  // From main store (for Hasan A & B)
  const itemsMain = getCollectionItems(stores.main, colName);
  const matchedMain = itemsMain.filter(x => {
    if (x.project_id && (x.project_id === 'proj_1788273397361_00cn4c' || x.project_id === 'proj_1788265334910_pp698g')) return true;
    if (colName === 'project_foundation' && (x.id === 'proj_1788273397361_00cn4c' || x.id === 'proj_1788265334910_pp698g')) return true;
    return false;
  });

  // From sanitize store (for Lahirnya Cahaya)
  const itemsSan = getCollectionItems(stores.sanitize, colName);
  const matchedSan = itemsSan.filter(x => {
    if (x.project_id && x.project_id === 'proj_1788114675178_9uas6v') return true;
    if (colName === 'project_foundation' && x.id === 'proj_1788114675178_9uas6v') return true;
    return false;
  });

  migrationPackage.data[colName] = [...matchedMain, ...matchedSan];
}

// Ensure Production Purity (no ai_credentials, ai_health, ai_usage, test projects)
const packageStr = JSON.stringify(migrationPackage, null, 2);
const pkgFilePath = './data/migration_candidates_phase3_2.json';
fs.writeFileSync(pkgFilePath, packageStr);

const pkgBuffer = fs.readFileSync(pkgFilePath);
const pkgSha256 = crypto.createHash('sha256').update(pkgBuffer).digest('hex');

console.log('Migration Package Written To:', pkgFilePath);
console.log('Package Size:', pkgBuffer.length, 'bytes');
console.log('Package SHA-256:', pkgSha256);

// Verify Source File Hashes remain unchanged
console.log('\n=== VERIFY SOURCE FILE HASHES AFTER OPERATION ===');
let allSourceHashesMatch = true;
for (const f of sourceFiles) {
  const current = getFileHash(f);
  const initial = initialHashes[f];
  const match = initial && current && initial.sha256 === current.sha256 && initial.size === current.size;
  if (!match) allSourceHashesMatch = false;
  console.log(`${f} -> Initial: ${initial ? initial.sha256 : 'N/A'} | Current: ${current ? current.sha256 : 'N/A'} | MATCH: ${match}`);
}

console.log('\nAll Source File Hashes Identical:', allSourceHashesMatch);

// Final Summary
console.log('\n=== FINAL COMPLETENESS SUMMARY TABLE ===');
const summaryTable = [
  {
    project_id: 'proj_1788273397361_00cn4c',
    title: valHasanA.title,
    created_at: valHasanA.created_at,
    updated_at: valHasanA.updated_at,
    status: valHasanA.status,
    current_stage: valHasanA.current_stage,
    script_length: valHasanA.script_length,
    foundation_count: valHasanA.counts.foundation,
    character_count: valHasanA.counts.character,
    location_count: valHasanA.counts.location,
    object_count: valHasanA.counts.object,
    scene_count: valHasanA.counts.scene,
    shot_count: valHasanA.counts.shot,
    video_prompt_count: valHasanA.counts.video_prompt,
    story_architecture_count: valHasanA.counts.story_architecture,
    continuity_count: valHasanA.counts.continuity,
    log_count: valHasanA.counts.log,
    telemetry_count: valHasanA.counts.telemetry,
    referential_integrity: valHasanA.referential_integrity,
    snapshot_consistency: 'Identical in main & bak store. Absent in apikeysanitizebak.'
  },
  {
    project_id: 'proj_1788265334910_pp698g',
    title: valHasanB.title,
    created_at: valHasanB.created_at,
    updated_at: valHasanB.updated_at,
    status: valHasanB.status,
    current_stage: valHasanB.current_stage,
    script_length: valHasanB.script_length,
    foundation_count: valHasanB.counts.foundation,
    character_count: valHasanB.counts.character,
    location_count: valHasanB.counts.location,
    object_count: valHasanB.counts.object,
    scene_count: valHasanB.counts.scene,
    shot_count: valHasanB.counts.shot,
    video_prompt_count: valHasanB.counts.video_prompt,
    story_architecture_count: valHasanB.counts.story_architecture,
    continuity_count: valHasanB.counts.continuity,
    log_count: valHasanB.counts.log,
    telemetry_count: valHasanB.counts.telemetry,
    referential_integrity: valHasanB.referential_integrity,
    snapshot_consistency: 'Identical in main & bak store. Absent in apikeysanitizebak.'
  },
  {
    project_id: 'proj_1788114675178_9uas6v',
    title: valLahirCahaya.title,
    created_at: valLahirCahaya.created_at,
    updated_at: valLahirCahaya.updated_at,
    status: valLahirCahaya.status,
    current_stage: valLahirCahaya.current_stage,
    script_length: valLahirCahaya.script_length,
    foundation_count: valLahirCahaya.counts.foundation,
    character_count: valLahirCahaya.counts.character,
    location_count: valLahirCahaya.counts.location,
    object_count: valLahirCahaya.counts.object,
    scene_count: valLahirCahaya.counts.scene,
    shot_count: valLahirCahaya.counts.shot,
    video_prompt_count: valLahirCahaya.counts.video_prompt,
    story_architecture_count: valLahirCahaya.counts.story_architecture,
    continuity_count: valLahirCahaya.counts.continuity,
    log_count: valLahirCahaya.counts.log,
    telemetry_count: valLahirCahaya.counts.telemetry,
    referential_integrity: valLahirCahaya.referential_integrity,
    snapshot_consistency: 'Present in apikeysanitizebak (Stage 8). Absent in main & bak store.'
  }
];

console.log(JSON.stringify(summaryTable, null, 2));
