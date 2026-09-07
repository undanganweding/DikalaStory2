[CmdletBinding()]
param(
    [string]$ProjectDir = '',
    [string]$ZipPath = '',
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression.FileSystem

# CONFIG: edit these defaults when moving script outside project.
if ([string]::IsNullOrWhiteSpace($ProjectDir)) { $ProjectDir = $PSScriptRoot }
if ([string]::IsNullOrWhiteSpace($ZipPath)) { $ZipPath = Join-Path $ProjectDir 'ai-studio-latest.zip.zip' }

# Only local state below stays outside ZIP source of truth.
$ProtectedExact = @('.env', '.env.local', 'update-from-ai-studio.bat', 'sync-ai-studio.ps1', 'ai-studio-latest.zip.zip')
$ProtectedDirs = @('.git', 'node_modules', 'dist', 'build')

function Normalize-Rel([string]$Path) { return $Path.Replace('/', '\').TrimStart('\') }
function Get-Rel([string]$Base, [string]$Path) {
    return Normalize-Rel $Path.Substring($Base.TrimEnd('\').Length + 1)
}
function Test-Protected([string]$RelativePath) {
    $rel = Normalize-Rel $RelativePath
    $lower = $rel.ToLowerInvariant()
    foreach ($item in $ProtectedExact) { if ($lower -eq $item.ToLowerInvariant()) { return $true } }
    foreach ($dir in $ProtectedDirs) {
        $d = $dir.ToLowerInvariant()
        if ($lower -eq $d -or $lower.StartsWith("$d\")) { return $true }
    }
    return $false
}
function Get-Files([string]$Root) {
    if (-not (Test-Path -LiteralPath $Root -PathType Container)) { return @() }
    return @(Get-ChildItem -LiteralPath $Root -Recurse -File -Force | ForEach-Object { Get-Rel $Root $_.FullName })
}
function Copy-Backup([string]$Source, [string]$Backup, [string]$RelativePath) {
    $target = Join-Path $Backup $RelativePath
    $parent = Split-Path $target -Parent
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    Copy-Item -LiteralPath (Join-Path $Source $RelativePath) -Destination $target -Force
}

$ProjectDir = [Environment]::ExpandEnvironmentVariables($ProjectDir.Trim().Trim('"'))
$ZipPath = [Environment]::ExpandEnvironmentVariables($ZipPath.Trim().Trim('"'))
$ProjectDir = [IO.Path]::GetFullPath($ProjectDir)
$ZipPath = [IO.Path]::GetFullPath($ZipPath)
Write-Host "PROJECT_DIR: $ProjectDir"
Write-Host "AI_STUDIO_ZIP: $ZipPath"

if (-not (Test-Path -LiteralPath $ProjectDir -PathType Container)) { throw "Project folder not found: $ProjectDir" }
if (-not (Test-Path -LiteralPath (Join-Path $ProjectDir '.git') -PathType Container)) { throw "Protected .git folder not found: $(Join-Path $ProjectDir '.git')" }
if (-not (Test-Path -LiteralPath $ZipPath -PathType Leaf)) { throw "ZIP not found: $ZipPath" }
try { $zip = [IO.Compression.ZipFile]::OpenRead($ZipPath); $zip.Dispose() } catch { throw "ZIP cannot be opened: $ZipPath`n$($_.Exception.Message)" }

$work = Join-Path ([IO.Path]::GetTempPath()) ('ai-studio-sync-' + [guid]::NewGuid().ToString('N'))
$extract = Join-Path $work 'extract'
$backup = Join-Path $work 'protected-backup'
New-Item -ItemType Directory -Force -Path $extract, $backup | Out-Null
$success = $false
try {
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $extract -Force
    $roots = @(Get-ChildItem -LiteralPath $extract -Directory -Force)
    $source = $extract
    if ($roots.Count -eq 1 -and (Test-Path (Join-Path $roots[0].FullName 'package.json') -or Test-Path (Join-Path $roots[0].FullName 'index.html'))) { $source = $roots[0].FullName }
    $sourceFiles = Get-Files $source
    if ($sourceFiles.Count -eq 0) { throw 'ZIP contains no files.' }

    $localFiles = Get-Files $ProjectDir
    $protectedLocal = @($localFiles | Where-Object { Test-Protected $_ })
    foreach ($rel in @('.env', '.env.local')) {
        if ($localFiles -contains $rel) { Copy-Backup $ProjectDir $backup $rel }
    }
    Write-Host "Backup .env files: $(@('.env', '.env.local') | Where-Object { $localFiles -contains $_ } | Measure-Object).Count"

    if ($WhatIf) {
        Write-Host 'WHATIF: ZIP validated and project root detected. No files modified.'
        exit 0
    }

    $sourceSet = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($rel in $sourceFiles) { [void]$sourceSet.Add($rel) }

    $deleteCount = 0; $copyCount = 0
    foreach ($rel in $localFiles) {
        if (-not $sourceSet.Contains($rel) -and -not (Test-Protected $rel)) {
            Remove-Item -LiteralPath (Join-Path $ProjectDir $rel) -Force
            $deleteCount++
            Write-Host "DELETE $rel"
        }
    }
    foreach ($rel in $sourceFiles) {
        if (Test-Protected $rel) { Write-Host "KEEP   $rel"; continue }
        $src = Join-Path $source $rel; $dst = Join-Path $ProjectDir $rel
        $parent = Split-Path $dst -Parent
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
        Copy-Item -LiteralPath $src -Destination $dst -Force
        $copyCount++
        Write-Host "COPY   $rel"
    }
    foreach ($rel in @('.env', '.env.local')) {
        $saved = Join-Path $backup $rel
        if (Test-Path -LiteralPath $saved) {
            Copy-Item -LiteralPath $saved -Destination (Join-Path $ProjectDir $rel) -Force
            Write-Host "RESTORE $rel"
        }
    }
    Write-Host "Mirror complete. Copied: $copyCount; Deleted: $deleteCount; Protected: .git, .env, .env.local, node_modules, dist, build"
    $success = $true
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    if (Test-Path $backup) {
        foreach ($rel in (Get-Files $backup)) {
            $dst = Join-Path $ProjectDir $rel; New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
            Copy-Item -LiteralPath (Join-Path $backup $rel) -Destination $dst -Force
        }
        Write-Host 'Protected files restored from backup.'
    }
    Write-Host 'ERROR: Mirror aborted. .env backups restored.' -ForegroundColor Red
    exit 1
} finally {
    Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}

if ($success) {
    Write-Host ''
    Write-Host 'SYNC AI STUDIO SELESAI'
    Write-Host 'git status --short:'
    Push-Location $ProjectDir
    try { & git status --short } finally { Pop-Location }
    Write-Host ''
    Write-Host 'Review git status sebelum commit/push.'
}
exit 0
