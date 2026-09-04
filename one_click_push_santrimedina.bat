@echo off
setlocal EnableExtensions
set "ROOT=%~dp0"
set "PROJECT=%ROOT%dikalastory"
set "ENGINE=%ROOT%sync_ai_studio_manager.ps1"
set "REMOTE=https://github.com/santrimedina-spec/dikalastory.git"

if not exist "%PROJECT%\.git" goto :error_repo
if not exist "%ENGINE%" goto :error_engine

cd /d "%PROJECT%"
git remote set-url origin "%REMOTE%"
if errorlevel 1 goto :error_remote

git config credential.helper manager
for /f "tokens=*" %%A in ('git remote get-url origin') do echo Remote aktif: %%A
echo Akun target: santrimedina-spec
echo.
echo Credential GitHub lama akan dihapus agar login akun target muncul.
echo Setelah push, Git Credential Manager membuka login GitHub.
echo.
(echo protocol=https& echo host=github.com& echo.) | git credential reject

echo Masukkan path ZIP/folder AI Studio.
set /p "SOURCE=Path: "
if not defined SOURCE goto :error_source_empty
if not exist "%SOURCE%" goto :error_source_missing

echo.
set /p "MESSAGE=Pesan commit (Enter = auto-generate): "
if defined MESSAGE (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -UpdateFolder "%SOURCE%" -CommitMsg "%MESSAGE%"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -UpdateFolder "%SOURCE%"
)
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" echo [ERROR] Sync gagal. Tidak ada push berhasil.
if "%EXITCODE%"=="0" echo [OK] Commit dan push selesai ke santrimedina-spec/dikalastory.
pause
exit /b %EXITCODE%

:error_repo
echo [ERROR] Git repository tidak ditemukan: %PROJECT%
goto :stop_error
:error_engine
echo [ERROR] Engine tidak ditemukan: %ENGINE%
goto :stop_error
:error_remote
echo [ERROR] Gagal mengatur remote Git.
goto :stop_error
:error_source_empty
echo [ERROR] Path kosong.
goto :stop_error
:error_source_missing
echo [ERROR] Path tidak ditemukan: %SOURCE%
goto :stop_error
:stop_error
pause
exit /b 1
