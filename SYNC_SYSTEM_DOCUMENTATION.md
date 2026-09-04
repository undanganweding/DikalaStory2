# CANONICAL SYNC SYSTEM DOCUMENTATION

**Status**: ✅ 95% Complete (1 parse error to fix)  
**Created**: 2026-09-03  
**Purpose**: Single source of truth for AI Studio → Dikalastory project synchronization

---

## 📋 OVERVIEW

All duplicate and inconsistent sync scripts have been consolidated into **one canonical system**:

### ✅ COMPLETED FILES

| File | Location | Purpose | Status |
|------|----------|---------|--------|
| `sync_ai_studio_manager.bat` | `d:\Web\sync github\` | **CANONICAL LAUNCHER** — Menu-driven, 7 modes | ✅ Ready |
| `sync_ai_studio_manager.ps1` | `d:\Web\sync github\` | **CANONICAL ENGINE** — SHA256 diff, validation, git | ⚠️ Parse error (curly quotes) |
| `apply-ai-studio-export.mjs` | `dikalastory\` | **NODE INNER TOOL** — SHA256, protected rules | ✅ Ready |
| `sync-ai-studio.bat` | `dikalastory\` | **IN-PROJECT DELEGATE** — Routes to canonical or node | ✅ Ready |

### 🗑️ DELETED (obsolete duplicates)

- ❌ `sync_ai_studio_final.ps1` — Replaced by canonical PS1
- ❌ `sync_ai_studio_final.bat` — Replaced by canonical BAT
- ❌ `auto_sync_one_click.bat` — Replaced by canonical BAT

---

## 🎯 KEY FEATURES

### **SHA256 Content-Based Diff**
- Immune to timestamp manipulation
- Detects real changes, not just date mismatch
- Identical hash = skip copy (no false positives)

### **Dynamic Path Resolution**
- No more hardcoded `D:\Sifa\` paths
- Auto-resolves from script location (`$PSScriptRoot`)
- Works from any drive/folder

### **Protected File Rules**
Protected files are **NEVER** overwritten from AI Studio export:

```
.env, .env.local, .env.production, .env.development, .env.example
.gitignore
vercel.json
api/index.ts
firebase-applet-config.json
package.json, package-lock.json, bun.lock
push.bat, sync-ai-studio.bat

🔐 DATABASE MIGRATION PROTECTION:
server/db.ts              ← Firestore + JSON fallback architecture
server/firebase_admin.ts  ← Firebase config & initialization
server.ts                 ← Express server entry point

🚫 DATA DIRECTORIES:
data/**                   ← firestore_store.json, credentials, API keys
.git/, .vercel/, node_modules/, dist/, build/, .firebase/
```

### **AI Infrastructure Awareness**
AI infra files **ALWAYS sync** (bypass protection):

```
server/ai_infrastructure/**
  ├── Phase 4: AI Gateway
  ├── Phase 5.1A: Intelligence Router
  ├── Phase 5.2: Cost Intelligence
  ├── Phase 5.3: Adaptive Optimizer
  ├── Phase 5.3B: Adaptive Memory
  ├── Phase 5.4A: Decision Intelligence
  └── Phase 5.4B: Decision Feedback & Calibration
```

### **Validation Gate** (before commit)
1. `npm run lint` → TypeScript type-check (tsc --noEmit)
2. `npm run build` → Vite build (must succeed)
3. Phase tests (if present):
   - `server/phase4_gateway_test.ts`
   - `server/phase5_1a_intelligence_router_test.ts`
   - `server/phase5_2_cost_intelligence_test.ts`
   - `server/phase5_3_adaptive_optimizer_test.ts`
   - `server/phase5_3b_adaptive_learning_test.ts`
   - `server/phase5_4a_decision_intelligence_test.ts`
   - `server/phase5_4_decision_feedback_test.ts`

If validation fails → **commit blocked** to protect production.

### **Smart Commit Messages**
Auto-detects AI infra changes:

```powershell
# If AI infra files detected:
"feat(ai-control-plane): integrate adaptive intelligence infrastructure phases 4-5.4B [2026-09-03 14:30]"

# Otherwise:
"sync: AI Studio update — 23 file(s) [2026-09-03 14:30]"
```

### **Backup Before Any Write**
Before touching files:
```
backup_before_sync_YYYYMMDD_HHMMSS/
  └── (full copy of all relevant files)
```

---

## 🚀 USAGE

### **Option 1: Run Canonical Launcher (Recommended)**

```batch
cd "d:\Web\sync github"
.\sync_ai_studio_manager.bat
```

**Menu options:**
1. **CHECK ONLY** — Audit diff, no changes
2. **DRY RUN** — Full preview with report
3. **SYNC ONLY** — Copy + install + validate (no push)
4. **FULL SYNC** — Copy + install + validate + commit + push
5. **FULL SYNC (force push)** — Same as #4 with `--force-with-lease`
6. **SYNC + SKIP VALIDATION** — Full sync, bypass tsc/build/test
7. **TENTUKAN PATH** — Specify custom ZIP/folder path

### **Option 2: Direct PowerShell (after fixing parse error)**

```powershell
cd "d:\Web\sync github"

# Check only
.\sync_ai_studio_manager.ps1 -CheckOnly

# Dry run
.\sync_ai_studio_manager.ps1 -DryRun

# Sync without push
.\sync_ai_studio_manager.ps1 -NoPush

# Full sync
.\sync_ai_studio_manager.ps1

# Full sync with custom message
.\sync_ai_studio_manager.ps1 -CommitMsg "feat: new AI router logic"

# Skip validation (use carefully)
.\sync_ai_studio_manager.ps1 -SkipValidation

# Specify source
.\sync_ai_studio_manager.ps1 -UpdateFolder "D:\Downloads\dikalastories.zip"
```

### **Option 3: In-Project Delegate**

```batch
cd "d:\Web\sync github\dikalastory"
.\sync-ai-studio.bat
```

Will auto-detect canonical system or fall back to Node.js standalone mode.

### **Option 4: Node.js Tool (Quick Preview)**

```bash
cd dikalastory
node apply-ai-studio-export.mjs --preview
node apply-ai-studio-export.mjs "D:\Downloads\export.zip"
node apply-ai-studio-export.mjs --install --commit
```

---

## ⚠️ KNOWN ISSUE

### **sync_ai_studio_manager.ps1 Parse Error**

**Status**: ⚠️ Needs manual fix

**Symptom**:
```
At D:\Web\sync github\sync_ai_studio_manager.ps1:640 char:1
+ }
+ ~
Unexpected token '}' in expression or statement.
```

**Root Cause**:  
File contains **typographic/curly quotes** (U+2018 `'` and U+2019 `'`) instead of **straight ASCII quotes** (U+0027 `'`).

Particularly problematic in lines like:
```powershell
$r = $Rel.ToLowerInvariant().Replace('\', '/')
#                                     ↑    ↑
#                            curly quotes break parsing
```

**FIX (choose one)**:

#### Method 1: Global Replace in VS Code
1. Open `sync_ai_studio_manager.ps1` in VS Code
2. Press `Ctrl+H` (Find and Replace)
3. Replace `'` (curly left) → `'` (straight)
4. Replace `'` (curly right) → `'` (straight)
5. Save with UTF-8 encoding (no BOM)

#### Method 2: PowerShell Script
```powershell
$path = "d:\Web\sync github\sync_ai_studio_manager.ps1"
$content = [System.IO.File]::ReadAllText($path)
$fixed = $content.Replace([char]0x2018, "'").Replace([char]0x2019, "'")
[System.IO.File]::WriteAllText($path, $fixed, [System.Text.UTF8Encoding]::new($false))
```

#### Method 3: Use Working Components
Until PS1 is fixed, use:
- `apply-ai-studio-export.mjs` for quick sync (Node.js)
- `sync-ai-studio.bat` for menu-driven Node.js mode

---

## 🔍 PROTECTED FILE RULES CONSISTENCY

Rules are **identical** between:
- `sync_ai_studio_manager.ps1` (`$PROTECTED_EXACT`, `$PROTECTED_PREFIXES`)
- `apply-ai-studio-export.mjs` (`PROTECTED_EXACT`, `PROTECTED_PREFIXES`)

Both use:
- `AI_INFRA_PREFIX` = `server/ai_infrastructure/` → always synced
- DB migration protection: `server/db.ts`, `server/firebase_admin.ts`

---

## 📊 MIGRATION SUMMARY

| Aspect | Before | After |
|--------|--------|-------|
| **Scripts** | 5 duplicate scripts | 1 canonical system (4 files) |
| **Diff method** | Date-based (unreliable) | SHA256 content-based |
| **Paths** | Hardcoded `D:\Sifa\` | Dynamic auto-resolution |
| **Protected files** | Inconsistent rules | Unified PROTECTED lists |
| **AI infra** | Not recognized | Always synced, never blocked |
| **DB migration** | No protection | `server/db.ts` + `firebase_admin.ts` protected |
| **Validation** | Manual | Automated gate (tsc + build + tests) |
| **Commit msg** | Generic | Smart detection (AI infra vs regular) |
| **Backup** | None | Automatic before every sync |

---

## 🎓 ARCHITECTURE FLOW

```
User
  ↓
sync_ai_studio_manager.bat (LAUNCHER)
  ↓ (delegates with params)
sync_ai_studio_manager.ps1 (ENGINE)
  ↓
  ├─→ Auto-detect ZIP (Downloads / project root / D:\Web\)
  ├─→ Extract ZIP if needed
  ├─→ SHA256 diff (source vs target)
  ├─→ Apply protected file rules
  ├─→ Identify AI infra files
  ├─→ Backup target before write
  ├─→ Copy changed files
  ├─→ Merge package.json deps (scripts preserved)
  ├─→ npm install
  ├─→ Validation gate (tsc / build / phase tests)
  ├─→ Git commit with smart message
  └─→ Git push (with optional force-with-lease)
```

**Alternative path (in-project)**:
```
User (inside dikalastory/)
  ↓
sync-ai-studio.bat (DELEGATE)
  ↓
  ├─→ If canonical PS1 exists → route to launcher
  └─→ Else → apply-ai-studio-export.mjs (Node.js standalone)
```

---

## 📝 NEXT STEPS

1. **Fix PS1 parse error** (use Method 1 or 2 above)
2. **Test dry-run**:
   ```batch
   .\sync_ai_studio_manager.bat
   → Choose option [2] DRY RUN
   ```
3. **Verify audit report shows**:
   - Protected files preserved
   - AI infra files detected
   - DB migration files status
4. **Run first real sync** (option [3] SYNC ONLY — no push)
5. **Inspect changes**, then push manually if satisfied
6. **Full workflow** (option [4] FULL SYNC) for future updates

---

## 🛡️ SAFETY NOTES

- Always review **CHECK ONLY** or **DRY RUN** before real sync
- Backup is automatic, but verify `backup_before_sync_*` folder exists after sync
- Validation failures **block commits** — this is intentional protection
- Use **SKIP VALIDATION** only when you're 100% sure (e.g., docs-only changes)
- **Force push** should be rare — normal push with `--set-upstream` handles most cases

---

## 📞 TROUBLESHOOTING

### ZIP not auto-detected
- Place ZIP in Downloads, `D:\Web\`, or project root
- Or use menu option [7] to specify path manually

### Validation fails
- Check `npm run lint` and `npm run build` output
- Fix errors before re-running sync
- Or use `-SkipValidation` flag (not recommended for production)

### Git push fails
- Ensure GitHub credentials / PAT are configured
- Check remote URL: `git remote -v`
- Try force push option if branch diverged (menu option [5])

### Protected file accidentally overwritten
- Restore from `backup_before_sync_*` folder
- Check PROTECTED lists are up-to-date in both PS1 and MJS

---

**END OF DOCUMENTATION**
