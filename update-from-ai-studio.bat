@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
set "AI_STUDIO_ZIP=%PROJECT_DIR%\ai-studio-latest.zip.zip"
set "SYNC_PS1=%PROJECT_DIR%\sync-ai-studio.ps1"

if not exist "%SYNC_PS1%" (
  echo ERROR: Missing helper: "%SYNC_PS1%"
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SYNC_PS1%" -ProjectDir "%PROJECT_DIR%" -ZipPath "%AI_STUDIO_ZIP%"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo Sync gagal. Commit/push dibatalkan. Exit code: %EXIT_CODE%
  echo.
  pause
  exit /b %EXIT_CODE%
)

echo.
echo ===== GIT STATUS =====
git -C "%PROJECT_DIR%" status --short
 echo.
set /p "PUSH_CONFIRM=Commit dan push ke GitHub sekarang? (Y/N): "
if /I not "%PUSH_CONFIRM%"=="Y" (
  echo Push dibatalkan. Perubahan tetap lokal.
  echo.
  pause
  exit /b 0
)

set "COMMIT_MESSAGE=sync: update from AI Studio"
set /p "CUSTOM_MESSAGE=Pesan commit (Enter = %COMMIT_MESSAGE%): "
if not "%CUSTOM_MESSAGE%"=="" set "COMMIT_MESSAGE=%CUSTOM_MESSAGE%"

git -C "%PROJECT_DIR%" add -A
if errorlevel 1 (
  echo ERROR: git add gagal.
  pause
  exit /b 1
)
git -C "%PROJECT_DIR%" commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 (
  echo ERROR: git commit gagal atau tidak ada perubahan.
  pause
  exit /b 1
)
git -C "%PROJECT_DIR%" push origin main
if errorlevel 1 (
  echo ERROR: git push gagal.
  pause
  exit /b 1
)

echo.
echo GITHUB PUSH SELESAI.
echo.
pause
exit /b 0
