@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem One-click GitHub re-authentication, commit, push, and Vercel production deploy.
rem Target GitHub account/repository: undanganweding/DikalaStory2
rem Target Vercel project/team: dikalastory / tukustores-projects

set "ROOT=%~dp0"
set "EXPECTED_OWNER=undanganweding"
set "EXPECTED_REPO=DikalaStory2"
set "EXPECTED_REMOTE=https://github.com/undanganweding/DikalaStory2.git"
set "VERCEL_PROJECT=dikalastory"
set "VERCEL_TEAM=tukustores-projects"
set "VERCEL_CMD=%APPDATA%\npm\vercel.cmd"

cd /d "%ROOT%"
if not exist ".git" goto :error_repo

rem Install required CLI tools automatically when package managers are available.
where git >nul 2>&1 || goto :error_git
where gh >nul 2>&1
if errorlevel 1 (
  echo [SETUP] GitHub CLI tidak ditemukan. Mencoba install via winget...
  where winget >nul 2>&1 || goto :error_gh
  winget install --id GitHub.cli --exact --source winget --accept-source-agreements --accept-package-agreements
  if errorlevel 1 goto :error_gh_install
  set "PATH=%PATH%;%ProgramFiles%\GitHub CLI"
)
if not exist "%VERCEL_CMD%" (
  echo [SETUP] Vercel CLI tidak ditemukan. Mencoba install via npm...
  where npm.cmd >nul 2>&1 || goto :error_vercel
  call npm.cmd install --global vercel
  if errorlevel 1 goto :error_vercel_install
)

for /f "delims=" %%R in ('git remote get-url origin 2^>nul') do set "CURRENT_REMOTE=%%R"
if /I not "!CURRENT_REMOTE!"=="%EXPECTED_REMOTE%" (
  echo [ERROR] Remote tidak sesuai target.
  echo Expected: %EXPECTED_REMOTE%
  echo Actual:   !CURRENT_REMOTE!
  echo.
  echo Periksa remote repository sebelum lanjut. Tidak ada commit, push, atau deploy.
  pause
  exit /b 1
)

echo.
echo Target GitHub: %EXPECTED_OWNER%/%EXPECTED_REPO%
echo Target Vercel: %VERCEL_PROJECT% ^(%VERCEL_TEAM%^) production

echo.
echo AUTH CHECK: logout GitHub CLI dan Vercel CLI.
gh auth logout -h github.com -u %EXPECTED_OWNER% -y >nul 2>&1
call "%VERCEL_CMD%" logout >nul 2>&1

 echo.
echo LOGIN GitHub. Selesaikan browser/device login sebagai akun %EXPECTED_OWNER%.
gh auth login -h github.com -p https -w
if errorlevel 1 goto :error_auth

for /f "delims=" %%U in ('gh api user --jq .login 2^>nul') do set "GH_USER=%%U"
if /I not "!GH_USER!"=="%EXPECTED_OWNER%" (
  echo [ERROR] Akun GitHub aktif bukan akun target: !GH_USER!
  exit /b 1
)
echo [OK] GitHub account verified: !GH_USER!

 echo.
echo LOGIN Vercel. Selesaikan login sebagai team %VERCEL_TEAM%.
call "%VERCEL_CMD%" login
if errorlevel 1 goto :error_auth

 echo.
echo Periksa perubahan sebelum staging.
git status --short
set /p "CONFIRM=Ketik COMMIT untuk lanjut, atau lainnya untuk batal: "
if /I not "%CONFIRM%"=="COMMIT" goto :cancel

set /p "MESSAGE=Pesan commit: "
if not defined MESSAGE set "MESSAGE=update project"

git add -A
if errorlevel 1 goto :error_git

echo.
echo File staged:
git diff --cached --name-status

git diff --cached --name-only | findstr /I /R "^\.env ^data/ credentials_secrets\.json" >nul
if not errorlevel 1 (
  echo [ERROR] Secret/runtime path staged. Commit dibatalkan.
  git reset >nul
  exit /b 1
)

git diff --cached --check
if errorlevel 1 goto :error_diff

git commit -m "%MESSAGE%"
if errorlevel 1 goto :error_git

git push origin main
if errorlevel 1 goto :error_git

 echo.
echo Deploy production Vercel.
call "%VERCEL_CMD%" link --project "%VERCEL_PROJECT%" --scope "%VERCEL_TEAM%" --yes
if errorlevel 1 goto :error_vercel
call "%VERCEL_CMD%" deploy --prod --yes --scope "%VERCEL_TEAM%"
if errorlevel 1 goto :error_vercel

echo.
echo [OK] GitHub commit/push dan Vercel production deploy selesai.
pause
exit /b 0

:cancel
echo [CANCELLED] Tidak ada commit, push, atau deploy.
pause
exit /b 2
:error_repo
echo [ERROR] .git tidak ditemukan: %ROOT%
pause
exit /b 1
:error_git
echo [ERROR] Git command gagal.
pause
exit /b 1
:error_gh
echo [ERROR] GitHub CLI ^(gh^) tidak ditemukan dan winget tidak tersedia.
pause
exit /b 1
:error_gh_install
echo [ERROR] Install GitHub CLI gagal. Buka ulang terminal lalu jalankan file ini lagi.
pause
exit /b 1
:error_vercel
echo [ERROR] npm tidak ditemukan. Install Node.js terlebih dahulu.
pause
exit /b 1
:error_vercel_install
echo [ERROR] Install Vercel CLI gagal.
pause
exit /b 1
:error_auth
echo [ERROR] Authentication gagal atau akun tidak sesuai.
pause
exit /b 1
:error_diff
echo [ERROR] git diff --cached --check gagal.
git reset >nul
pause
exit /b 1
