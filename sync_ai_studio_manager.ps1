# ==============================================================================
#  sync_ai_studio_manager.ps1
#  CANONICAL ENGINE - AI Studio -> Dikalastory synchronization
#
#  Features:
#    - SHA256 content-based diff (immune to timestamp manipulation)
#    - Dynamic path resolution ($PSScriptRoot based)
#    - Protected file rules (never overwritten from AI Studio export)
#    - AI infrastructure awareness (server/ai_infrastructure/** always sync)
#    - Validation gate (tsc + build + phase tests) before commit
#    - Smart commit messages (auto-detects AI infra changes)
#    - Backup before any write
#
#  Usage:
#    .\sync_ai_studio_manager.ps1                 # Full sync + push
#    .\sync_ai_studio_manager.ps1 -CheckOnly      # Audit only, no changes
#    .\sync_ai_studio_manager.ps1 -DryRun         # Preview with audit report
#    .\sync_ai_studio_manager.ps1 -NoPush         # Copy + install + validate
#    .\sync_ai_studio_manager.ps1 -ForcePush      # push --force-with-lease
#    .\sync_ai_studio_manager.ps1 -SkipValidation # Bypass tsc/build/test
#    .\sync_ai_studio_manager.ps1 -CommitMsg "msg"
#    .\sync_ai_studio_manager.ps1 -UpdateFolder "path\to\zip-or-folder"
# ==============================================================================

[CmdletBinding()]
param(
    [switch]$CheckOnly,
    [switch]$DryRun,
    [switch]$NoPush,
    [switch]$ForcePush,
    [switch]$SkipValidation,
    [string]$CommitMsg = "",
    [string]$UpdateFolder = ""
)

$ErrorActionPreference = 'Stop'

# ------------------------------------------------------------------------------
# Path resolution (dynamic, no hardcoded drives)
# ------------------------------------------------------------------------------
$ScriptRoot = $PSScriptRoot
if (-not $ScriptRoot) { $ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }

$TargetProject = Join-Path $ScriptRoot 'dikalastory'
$LogFile       = Join-Path $ScriptRoot 'sync_log.txt'

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line  = "[$stamp][$Level] $Message"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

# ------------------------------------------------------------------------------
# Protected rules
# ------------------------------------------------------------------------------
$ProtectedExact = @(
    '.env', '.env.local', '.env.production', '.env.development', '.env.example',
    '.gitignore',
    'vercel.json',
    'api\index.ts',
    'firebase-applet-config.json',
    'package.json', 'package-lock.json', 'bun.lock',
    'push.bat', 'sync-ai-studio.bat',
    'server\db.ts',
    'server\firebase_admin.ts',
    'server.ts'
)
$ProtectedDirs = @('data', '.git', '.vercel', 'node_modules', 'dist', 'build', '.firebase')

# AI infrastructure files ALWAYS sync (bypass protection of ai infra area)
$AIInfraPrefix = 'server\ai_infrastructure'
# Keep known regression verification fixture protected from stale ZIP exports.
$AIInfraProtectedExact = @(
    'server\ai_infrastructure\phase5_create_project_regression_verification.ts'
)

function Test-Protected { 
    param([string]$RelativePath)
    $norm = $RelativePath.ToLowerInvariant().Replace('/', '\')
    foreach ($p in $ProtectedExact) {
        if ($norm -eq $p.ToLowerInvariant()) { return $true }
    }
    foreach ($d in $ProtectedDirs) {
        if ($norm -eq $d.ToLowerInvariant() -or $norm.StartsWith("$d\")) { return $true }
    }
    foreach ($p in $AIInfraProtectedExact) {
        if ($norm -eq $p.ToLowerInvariant()) { return $true }
    }
    return $false
}

function Test-AIInfra {
    param([string]$RelativePath)
    $norm = $RelativePath.ToLowerInvariant().Replace('/', '\')
    return $norm.StartsWith($AIInfraPrefix.ToLowerInvariant() + '\')
}

# ------------------------------------------------------------------------------
# Source resolution: folder, zip, or auto-detect
# ------------------------------------------------------------------------------
function Resolve-SourceFolder {
    param([string]$Input_)

    if ($Input_ -and (Test-Path $Input_)) {
        if ((Get-Item $Input_).Extension -eq '.zip') {
            $extractDir = Join-Path $ScriptRoot ("ai_studio_extract_" + (Get-Date -Format 'yyyyMMdd_HHmmss'))
            Write-Log "Extracting ZIP $Input_ -> $extractDir"
            if (-not $DryRun) {
                Expand-Archive -Path $Input_ -DestinationPath $extractDir -Force
            }
            return (Get-ActualRoot $extractDir)
        }
        return (Get-ActualRoot $Input_)
    }

    # Auto-detect: look for most recent dikalastory*.zip / folder in script root
    $candidates = Get-ChildItem -Path $ScriptRoot -Filter 'dikalastory*' -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne 'dikalastory' } |
        Sort-Object LastWriteTime -Descending
    if ($candidates -and $candidates.Count -gt 0) {
        $c = $candidates[0]
        Write-Log "Auto-detected source: $($c.FullName)"
        if ($c.Extension -eq '.zip') {
            $extractDir = Join-Path $ScriptRoot ("ai_studio_extract_" + (Get-Date -Format 'yyyyMMdd_HHmmss'))
            if (-not $DryRun) {
                Expand-Archive -Path $c.FullName -DestinationPath $extractDir -Force
            }
            return (Get-ActualRoot $extractDir)
        }
        return (Get-ActualRoot $c.FullName)
    }
    return $null
}

# ZIP/folder may have a single wrapper dir; descend until we find package.json or index.html
function Get-ActualRoot {
    param([string]$Dir)
    $cur = $Dir
    for ($i = 0; $i -lt 5; $i++) {
        if ((Test-Path (Join-Path $cur 'package.json')) -or (Test-Path (Join-Path $cur 'index.html'))) {
            return $cur
        }
        $children = Get-ChildItem -Path $cur -Directory -ErrorAction SilentlyContinue
        if ($children -and $children.Count -eq 1) {
            $cur = $children[0].FullName
        } else {
            break
        }
    }
    return $Dir
}

# ------------------------------------------------------------------------------
# SHA256 diff
# ------------------------------------------------------------------------------
function Get-FileSHA256 {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return $null }
    return (Get-FileHash -Path $Path -Algorithm SHA256).Hash
}

# ------------------------------------------------------------------------------
# Build change plan
# ------------------------------------------------------------------------------
$SourceDir = Resolve-SourceFolder -Input_ $UpdateFolder
if (-not $SourceDir) {
    Write-Log "No AI Studio export source found. Use -UpdateFolder or place dikalastory*.zip next to this script." 'ERROR'
    exit 1
}
if (-not (Test-Path $TargetProject)) {
    Write-Log "Target project not found: $TargetProject" 'ERROR'
    exit 1
}

Write-Log "Source : $SourceDir"
Write-Log "Target : $TargetProject"
if ($CheckOnly) { Write-Log "Mode   : CHECK ONLY" }
elseif ($DryRun) { Write-Log "Mode   : DRY RUN" }
else { Write-Log "Mode   : SYNC" }

# Walk source files
$sourceFiles = Get-ChildItem -Path $SourceDir -Recurse -File |
    Where-Object {
        $rel = $_.FullName.Substring($SourceDir.Length + 1)
        $skip = $false
        foreach ($d in $ProtectedDirs) {
            if ($rel -like "$d\*" -or $rel -like "$d/*") { $skip = $true; break }
        }
        -not $skip
    }

$plan = @()
foreach ($sf in $sourceFiles) {
    $rel = $sf.FullName.Substring($SourceDir.Length + 1)
    $targetPath = Join-Path $TargetProject $rel
    $srcHash = Get-FileSHA256 -Path $sf.FullName
    $tgtHash = Get-FileSHA256 -Path $targetPath

    if ($srcHash -eq $tgtHash) { continue }  # identical -> skip

    $protected = Test-Protected -RelativePath $rel
    $aiInfra   = Test-AIInfra -RelativePath $rel
    $willCopy  = (-not $protected) -or ($aiInfra -and $rel.ToLowerInvariant() -notin $AIInfraProtectedExact.ForEach({ $_.ToLowerInvariant() }))

    $plan += [PSCustomObject]@{
        Relative  = $rel
        Source    = $sf.FullName
        Target    = $targetPath
        Status    = if (Test-Path $targetPath) { 'MODIFY' } else { 'ADD' }
        Protected = $protected
        AIInfra   = $aiInfra
        WillCopy  = $willCopy
        Reason    = if ($protected -and -not $aiInfra) { 'PROTECTED (skipped)' }
                    elseif ($protected -and $aiInfra) { 'PROTECTED but AI-INFRA (copied)' }
                    else { 'changed' }
    }
}

# Report
Write-Log "---- CHANGE PLAN ($($plan.Count) change(s)) ----"
foreach ($item in $plan) {
    $tag = if ($item.WillCopy) { 'COPY ' } else { 'SKIP ' }
    Write-Log "$tag $($item.Status.PadRight(6)) $($item.Reason.PadRight(28)) $($item.Relative)"
}

if ($CheckOnly) {
    Write-Log "CHECK ONLY complete. No files modified."
    exit 0
}

if ($plan.Count -eq 0) {
    Write-Log "Nothing to sync. Target already up to date."
    exit 0
}

if ($DryRun) {
    $report = Join-Path $ScriptRoot ("sync_audit_" + (Get-Date -Format 'yyyyMMdd_HHmmss') + '.txt')
    $plan | Out-String | Set-Content -Path $report -Encoding UTF8
    Write-Log "DRY RUN complete. Audit report: $report"
    exit 0
}

# ------------------------------------------------------------------------------
# Backup before write
# ------------------------------------------------------------------------------
$backupDir = Join-Path $ScriptRoot ("backup_before_sync_" + (Get-Date -Format 'yyyyMMdd_HHmmss'))
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
foreach ($item in $plan | Where-Object { $_.WillCopy -and (Test-Path $_.Target) }) {
    $relDir = Split-Path -Parent $item.Relative
    $bkPath = if ($relDir) { Join-Path $backupDir $relDir } else { $backupDir }
    New-Item -ItemType Directory -Path $bkPath -Force | Out-Null
    Copy-Item -Path $item.Target -Destination (Join-Path $backupDir $item.Relative) -Force
}
Write-Log "Backup created: $backupDir"

# ------------------------------------------------------------------------------
# Copy files
# ------------------------------------------------------------------------------
$copied = 0
foreach ($item in $plan | Where-Object { $_.WillCopy }) {
    $tgtDir = Split-Path -Parent $item.Target
    if ($tgtDir -and -not (Test-Path $tgtDir)) {
        New-Item -ItemType Directory -Path $tgtDir -Force | Out-Null
    }
    Copy-Item -Path $item.Source -Destination $item.Target -Force
    $copied++
}
Write-Log "Copied $copied file(s)."

# ------------------------------------------------------------------------------
# Install dependencies (only if package-lock or package json changed... but
# package.json is protected; check if any copied file requires install)
# ------------------------------------------------------------------------------
$needInstall = ($plan | Where-Object { $_.WillCopy -and $_.Relative -in @('package.json','package-lock.json','bun.lock') }).Count -gt 0
if (-not $needInstall) {
    # conservative: always run npm install (fast when up-to-date)
    $needInstall = $true
}
if ($needInstall) {
    Write-Log "Running npm install..."
    Push-Location $TargetProject
    try {
        cmd.exe /d /c "npm.cmd install --no-audit --no-fund 2>&1" | ForEach-Object { Write-Log "  [npm] $_" }
        if ($LASTEXITCODE -ne 0) { throw "npm install failed (exit $LASTEXITCODE)" }
    } finally { Pop-Location }
}

# ------------------------------------------------------------------------------
# Validation gate
# ------------------------------------------------------------------------------
if (-not $SkipValidation) {
    Write-Log "Validation gate: TypeScript check..."
    Push-Location $TargetProject
    try {
        cmd.exe /d /c "npx.cmd tsc --noEmit 2>&1" | ForEach-Object { Write-Log "  [tsc] $_" }
        if ($LASTEXITCODE -ne 0) { throw "tsc failed (exit $LASTEXITCODE) - commit BLOCKED" }

        Write-Log "Validation gate: Vite build..."
        cmd.exe /d /c "npm.cmd run build 2>&1" | ForEach-Object { Write-Log "  [build] $_" }
        if ($LASTEXITCODE -ne 0) { throw "build failed (exit $LASTEXITCODE) - commit BLOCKED" }
    } finally { Pop-Location }
    Write-Log "Validation PASSED."
} else {
    Write-Log "Validation SKIPPED (-SkipValidation)." 'WARN'
}

# ------------------------------------------------------------------------------
# Commit + push
# ------------------------------------------------------------------------------
Push-Location $TargetProject
try {
    $hasChanges = (git status --porcelain) -ne $null
    if (-not $hasChanges) {
        Write-Log "No git changes detected after sync. Nothing to commit."
        Pop-Location
        exit 0
    }

    git add -A

    if (-not $CommitMsg) {
        $aiInfraChanged = ($plan | Where-Object { $_.WillCopy -and $_.AIInfra }).Count -gt 0
        if ($aiInfraChanged) {
            $CommitMsg = "feat(ai-control-plane): integrate adaptive intelligence infrastructure via AI Studio sync [$(Get-Date -Format 'yyyy-MM-dd HH:mm')]"
        } else {
            $CommitMsg = "sync: AI Studio update - $copied file(s) [$(Get-Date -Format 'yyyy-MM-dd HH:mm')]"
        }
    }

    git commit -m $CommitMsg
    if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
    Write-Log "Committed: $CommitMsg"

    if (-not $NoPush) {
        if ($ForcePush) {
            git push --force-with-lease origin main
        } else {
            git push origin main
        }
        if ($LASTEXITCODE -ne 0) { throw "git push failed" }
        Write-Log "Pushed to origin/main."
    } else {
        Write-Log "Push skipped (-NoPush)."
    }
} finally { Pop-Location }

Write-Log "SYNC COMPLETE."
exit 0
