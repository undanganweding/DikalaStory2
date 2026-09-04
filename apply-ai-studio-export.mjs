#!/usr/bin/env node
/**
 * apply-ai-studio-export.mjs
 * ==========================
 * Inner Node.js sync tool — used by sync-ai-studio.bat (in-project delegate).
 * The canonical full sync (with validation + git) is handled by the root
 * PowerShell engine: sync_ai_studio_manager.ps1
 *
 * This script handles:
 *  - Accept ZIP file or extracted folder as source
 *  - Auto-detect newest ZIP from Downloads / project root / D:\Web\
 *  - SHA256-based diff (upgraded from SHA1) — content-aware, timestamp-immune
 *  - Copy only safe source files (src/, server/, root configs)
 *  - Protected file rules aligned with the canonical PS1 engine
 *  - AI Infrastructure awareness: server/ai_infrastructure/** always synced
 *  - DB migration protection: server/db.ts and server/firebase_admin.ts preserved
 *  - Merge NEW dependencies from export package.json (scripts block preserved)
 *  - Optional: npm install, git commit + push
 *
 * Usage:
 *   node apply-ai-studio-export.mjs [<file.zip | folder>] [--preview]
 *                                   [--install] [--commit] [--message "msg"]
 */

import fs   from 'fs';
import path from 'path';
import os   from 'os';
import { createHash }  from 'crypto';
import { execSync }    from 'child_process';

// -----------------------------------------------------------------------
// ALLOWED SOURCE PATTERNS
// Files from the export that are eligible to be copied.
// -----------------------------------------------------------------------
const ALLOWED_PREFIXES = [
  'src/',
  'server/',
];

const ALLOWED_ROOT_FILES = new Set([
  'index.html',
  'vite.config.ts',
  'vite.config.js',
  'tsconfig.json',
  'metadata.json',
  'README.md',
  'CHANGELOG.md',
  'tailwind.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
  'postcss.config.cjs',
]);

// -----------------------------------------------------------------------
// PROTECTED FILES — NEVER overwritten from export source
// Must stay in sync with sync_ai_studio_manager.ps1 PROTECTED lists.
// -----------------------------------------------------------------------
const PROTECTED_EXACT = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.env.example',
  '.gitignore',
  'vercel.json',
  'api/index.ts',
  'firebase-applet-config.json',
  'package.json',
  'package-lock.json',
  'bun.lock',
  'push.bat',
  'sync-ai-studio.bat',
  'server.ts',
  // ---- DATABASE MIGRATION PROTECTION ----
  // These files hold the Firestore+JSON fallback architecture.
  // USE_FIRESTORE toggle and the full adapter layer must NOT be reverted.
  'server/db.ts',
  'server/firebase_admin.ts',
]);

const PROTECTED_PREFIXES = [
  'data/',       // firestore_store.json, credentials, API keys
  '.git/',
  '.vercel/',
  'node_modules/',
  'dist/',
  'build/',
  '.firebase/',
];

// -----------------------------------------------------------------------
// AI INFRASTRUCTURE — always synced, bypasses protection rules
// server/ai_infrastructure/** contains Phase 4–5.4B gateway, router,
// optimizer, memory, and decision intelligence modules.
// -----------------------------------------------------------------------
const AI_INFRA_PREFIX = 'server/ai_infrastructure/';

function isProtected(relFile) {
  const f = relFile.replace(/\\/g, '/').toLowerCase();

  // AI infra always gets through
  if (f.startsWith(AI_INFRA_PREFIX)) return false;

  if (PROTECTED_EXACT.has(f)) return true;
  for (const p of PROTECTED_PREFIXES) {
    if (f.startsWith(p)) return true;
  }
  return false;
}

function isAllowed(relFile) {
  if (isProtected(relFile)) return false;

  const f = relFile.replace(/\\/g, '/');

  // AI infra is always allowed
  if (f.startsWith(AI_INFRA_PREFIX)) return true;

  for (const prefix of ALLOWED_PREFIXES) {
    if (f.startsWith(prefix)) return true;
  }

  // Root-level allowed files
  if (!f.includes('/') && ALLOWED_ROOT_FILES.has(f)) return true;

  return false;
}

// -----------------------------------------------------------------------
// SHA256 hash (upgraded from SHA1 — content-aware, collision-resistant)
// -----------------------------------------------------------------------
function hashFile(filePath) {
  try {
    return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------
// Directory walker
// -----------------------------------------------------------------------
function walk(dir, base, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel  = path.relative(base, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      const skip = ['node_modules', 'dist', 'build', '.git', '.firebase',
                    '.vercel', 'coverage', '.next', '.vite', 'tmp', 'temp'];
      if (skip.includes(entry.name)) continue;
      walk(full, base, acc);
    } else {
      acc.push(rel);
    }
  }
  return acc;
}

// -----------------------------------------------------------------------
// package.json dependency merge
// Scripts block is always preserved from the project (not overwritten).
// -----------------------------------------------------------------------
function mergeDependencies(exportDir, projectDir) {
  const expPkg  = path.join(exportDir,  'package.json');
  const projPkg = path.join(projectDir, 'package.json');
  if (!fs.existsSync(expPkg) || !fs.existsSync(projPkg)) return null;

  const exp  = JSON.parse(fs.readFileSync(expPkg,  'utf-8'));
  const proj = JSON.parse(fs.readFileSync(projPkg, 'utf-8'));

  const added = { dependencies: [], devDependencies: [] };
  let changed  = false;

  for (const section of ['dependencies', 'devDependencies']) {
    if (!exp[section]) continue;
    for (const [name, ver] of Object.entries(exp[section])) {
      if (!proj[section]) proj[section] = {};
      const existing = proj[section][name];
      if (!existing) {
        proj[section][name] = ver;
        added[section].push(`${name}@${ver}`);
        changed = true;
      } else if (existing !== ver) {
        proj[section][name] = ver;
        added[section].push(`${name}@${ver} (was ${existing})`);
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(projPkg, JSON.stringify(proj, null, 2) + '\n', 'utf-8');
  }
  return { changed, added };
}

// -----------------------------------------------------------------------
// Auto-detect newest ZIP
// -----------------------------------------------------------------------
function findNewestZip(projectRoot) {
  const searchDirs = [
    path.join(os.homedir(), 'Downloads'),
    projectRoot,
    path.dirname(projectRoot),   // root of sync github folder
    'D:\\Web',
    path.join(projectRoot, 'ai-studio-export'),
  ];

  const candidates = [];
  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    let entries = [];
    try { entries = fs.readdirSync(dir); } catch { continue; }
    for (const name of entries) {
      if (!name.toLowerCase().endsWith('.zip')) continue;
      const full = path.join(dir, name);
      try {
        const st = fs.statSync(full);
        candidates.push({ full, mtime: st.mtimeMs });
      } catch {}
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0].full;
}

// -----------------------------------------------------------------------
// ZIP extraction (via PowerShell Expand-Archive — no extra deps)
// -----------------------------------------------------------------------
function extractZip(zipPath) {
  const tmp    = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-studio-'));
  const zipAbs = path.resolve(zipPath);
  console.log(`  [ZIP] Extracting ${path.basename(zipPath)} -> ${tmp}`);

  try {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipAbs}' -DestinationPath '${tmp}' -Force"`,
      { stdio: 'pipe' }
    );
  } catch (e) {
    console.error(`  [X] ZIP extraction failed: ${e.message}`);
    process.exit(1);
  }

  // Unwrap single wrapper folder if present
  const entries = fs.readdirSync(tmp);
  for (const e of entries) {
    const sub = path.join(tmp, e);
    if (fs.statSync(sub).isDirectory() &&
        (fs.existsSync(path.join(sub, 'src')) ||
         fs.existsSync(path.join(sub, 'server')) ||
         fs.existsSync(path.join(sub, 'package.json')))) {
      return sub;
    }
  }
  return tmp;
}

// -----------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------
function main() {
  const args       = process.argv.slice(2);
  let   srcArg     = args.find(a => !a.startsWith('--'));
  const preview    = args.includes('--preview');
  const wantInstall = args.includes('--install');
  const wantCommit  = args.includes('--commit');
  const msgIdx      = args.indexOf('--message');
  const commitMsg   = msgIdx > -1 ? args[msgIdx + 1] : 'sync: AI Studio export update';

  const root = process.cwd();  // Expected to be run from inside dikalastory/

  // Resolve source
  if (!srcArg) {
    const zip = findNewestZip(root);
    if (zip) {
      console.log(`  [AUTO] No path given. Using newest ZIP:`);
      console.log(`         ${zip} (${new Date(fs.statSync(zip).mtimeMs).toLocaleString()})`);
      srcArg = zip;
    } else {
      console.error('  [X] No source path provided and no ZIP found.');
      console.error('      Usage: node apply-ai-studio-export.mjs "<zip|folder>" [--preview]');
      process.exit(1);
    }
  }

  let src = path.resolve(srcArg);

  // Extract ZIP if needed
  let tmpDir = null;
  if (fs.existsSync(src) && fs.statSync(src).isFile() && src.toLowerCase().endsWith('.zip')) {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-studio-'));
    src    = extractZip(src);
  }

  if (!fs.existsSync(src)) {
    console.error(`  [X] Source not found: ${src}`);
    process.exit(1);
  }

  // Scan and filter
  const allFiles = walk(src, src);
  const copyable = allFiles.filter(isAllowed);

  console.log('='.repeat(66));
  console.log('  apply-ai-studio-export.mjs');
  console.log('='.repeat(66));
  console.log(`  Source : ${src}`);
  console.log(`  Target : ${root}`);
  console.log(`  Mode   : ${preview ? 'PREVIEW' : 'COPY'}`);
  console.log(`  Diff   : SHA256 (content-based)`);
  console.log('');

  const toNew    = [];
  const toChange = [];
  const same     = [];

  for (const f of copyable) {
    const srcPath = path.join(src,  f);
    const dstPath = path.join(root, f);
    if (!fs.existsSync(dstPath)) {
      toNew.push({ f, srcPath, dstPath });
    } else {
      const h1 = hashFile(srcPath);
      const h2 = hashFile(dstPath);
      if (h1 !== h2) toChange.push({ f, srcPath, dstPath });
      else           same.push(f);
    }
  }

  const total = toNew.length + toChange.length;
  console.log(`  Detected: ${toNew.length} new, ${toChange.length} changed, ${same.length} identical\n`);

  if (total === 0) {
    console.log('  Project is already in sync.');
  } else {
    for (const { f } of toNew)    console.log(`  [NEW]    ${f}`);
    for (const { f } of toChange) {
      const isAI = f.toLowerCase().startsWith('server/ai_infrastructure/');
      console.log(`  [${isAI ? 'AI-INFRA' : 'CHANGE '}] ${f}`);
    }
  }

  // Protected file audit
  const protectedInSrc = allFiles.filter(f => isProtected(f));
  if (protectedInSrc.length) {
    console.log('\n  Protected files in source (preserved in target):');
    for (const f of protectedInSrc) console.log(`  [PROTECTED] ${f}`);
  }

  if (preview) {
    console.log('\n  >> PREVIEW mode — nothing written.\n');
    return;
  }

  if (total > 0) {
    console.log('\n  >> Copying files...');
    for (const { srcPath, dstPath } of [...toNew, ...toChange]) {
      fs.mkdirSync(path.dirname(dstPath), { recursive: true });
      fs.copyFileSync(srcPath, dstPath);
    }
    console.log(`  >> Copied: ${total} file(s).`);
  }

  // Merge dependencies
  const mergeResult = mergeDependencies(src, root);
  if (mergeResult?.changed) {
    console.log('\n  >> package.json — new/updated dependencies:');
    for (const [sec, list] of Object.entries(mergeResult.added)) {
      if (list.length) console.log(`     ${sec}: ${list.join(', ')}`);
    }
    console.log('     (scripts block preserved)');
  } else if (mergeResult) {
    console.log('\n  >> package.json: no new dependencies.');
  }

  // Cleanup temp
  if (tmpDir) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }

  // npm install
  if (wantInstall) {
    console.log('\n  >> Running npm install...');
    try {
      execSync('npm.cmd install', { stdio: 'inherit', cwd: root });
    } catch {
      console.warn('  >> npm install had issues (non-fatal). Continuing...');
    }
  }

  // git commit + push
  if (wantCommit) {
    console.log(`\n  >> Git: add → commit "${commitMsg}" → push...`);
    try {
      execSync('git add -A',                         { stdio: 'inherit', cwd: root });
      execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { stdio: 'inherit', cwd: root });
      execSync('git push origin main',               { stdio: 'inherit', cwd: root });
      console.log('  >> Push successful. Vercel will auto-deploy.');
    } catch {
      console.warn('  >> git commit/push failed — check output above.');
    }
  }

  console.log('\n' + '='.repeat(66));
  console.log('  Done.');
  if (!wantInstall || !wantCommit) {
    console.log('  Next steps (if not done):');
    if (!wantInstall) console.log('    npm.cmd install');
    if (!wantCommit)  console.log('    git add -A && git commit -m "..." && git push origin main');
    console.log('  Or use the root sync_ai_studio_manager.bat for full workflow.');
  }
  console.log('='.repeat(66));
}

main();
