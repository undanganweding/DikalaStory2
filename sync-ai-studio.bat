@echo off
setlocal EnableDelayedExpansion
title AI Studio Sync — Dikalastory

rem =============================================================================
rem  sync-ai-studio.bat  (IN-PROJECT DELEGATE)
rem  Located inside the dikalastory/ project folder.
rem
rem  Primary path  : Delegates to root canonical engine (sync_ai_studio_manager)
rem  Fallback path : Runs apply-ai-studio-export.mjs directly via Node.js
rem                  (for preview / quick copy without full validation)
rem =============================================================================

rem Resolve paths
set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

rem Root sync folder is one level up
for %%I in ("%PROJECT_DIR%\..") do set "ROOT_DIR=%%~fI"
set "CANONICAL_BAT=%ROOT_DIR%\sync_ai_studio_manager.bat"
set "CANONICAL_PS1=%ROOT_DIR%\sync_ai_studio_manager.ps1"
set "MJS_TOOL=%PROJECT_DIR%\apply-ai-studio-export.mjs"

cls
echo.
echo =======================================================================
echo   AI STUDIO SYNC ^— DIKALASTORY  (in-project launcher)
echo =======================================================================
echo.

rem -----------------------------------------------------------------------
rem Check if canonical root engine exists — prefer it
rem -----------------------------------------------------------------------
if exist "%CANONICAL_PS1%" (
    echo   Canonical engine ditemukan: %CANONICAL_PS1%
    echo.
    echo   [1]  Buka CANONICAL LAUNCHER (menu lengkap dengan validasi + push)
    echo   [2]  PREVIEW via Node.js  (quick diff, tanpa copy)
    echo   [3]  COPY via Node.js     (copy saja, tanpa validate/commit)
    echo   [0]  Keluar
    echo.
    set /p CHOICE="  Pilih [0-3]: "

    if "!CHOICE!"=="0" goto :end
    if "!CHOICE!"=="1" goto :use_canonical
    if "!CHOICE!"=="2" goto :node_preview
    if "!CHOICE!"=="3" goto :node_copy

    echo   [!] Pilihan tidak valid.
    pause
    goto :end
) else (
    rem Canonical engine not present — standalone Node.js mode
    echo   Canonical engine tidak ditemukan di: %ROOT_DIR%
    echo   Menjalankan mode standalone via Node.js...
    echo.
    echo   [1]  PREVIEW  (audit diff saja)
    echo   [2]  COPY     (copy file yang berubah)
    echo   [3]  FULL     (copy + install + commit + push)
    echo   [0]  Keluar
    echo.
    set /p CHOICE="  Pilih [0-3]: "

    if "!CHOICE!"=="0" goto :end
    if "!CHOICE!"=="1" goto :node_preview_standalone
    if "!CHOICE!"=="2" goto :node_copy_standalone
    if "!CHOICE!"=="3" goto :node_full_standalone
    goto :end
)

rem -----------------------------------------------------------------------
:use_canonical
echo.
echo   Membuka canonical launcher...
call "%CANONICAL_BAT%"
goto :end

rem -----------------------------------------------------------------------
:node_preview
echo.
set /p SRC_PATH="  Path ZIP/folder (Enter = auto-detect): "
if "!SRC_PATH!"=="" (
    node "%MJS_TOOL%" --preview
) else (
    node "%MJS_TOOL%" "!SRC_PATH!" --preview
)
goto :done

rem -----------------------------------------------------------------------
:node_copy
echo.
set /p SRC_PATH="  Path ZIP/folder (Enter = auto-detect): "
if "!SRC_PATH!"=="" (
    node "%MJS_TOOL%"
) else (
    node "%MJS_TOOL%" "!SRC_PATH!"
)
goto :done

rem -----------------------------------------------------------------------
:node_preview_standalone
echo.
set /p SRC_PATH="  Path ZIP/folder (Enter = auto-detect): "
if "!SRC_PATH!"=="" (
    node "%MJS_TOOL%" --preview
) else (
    node "%MJS_TOOL%" "!SRC_PATH!" --preview
)
goto :done

rem -----------------------------------------------------------------------
:node_copy_standalone
echo.
set /p SRC_PATH="  Path ZIP/folder (Enter = auto-detect): "
if "!SRC_PATH!"=="" (
    node "%MJS_TOOL%"
) else (
    node "%MJS_TOOL%" "!SRC_PATH!"
)
echo.
set /p CONTINUE="  Lanjut npm install + commit + push? (y/n): "
if /i "!CONTINUE!"=="y" (
    set /p CMSG="  Pesan commit (Enter = default): "
    if "!CMSG!"=="" set "CMSG=sync: AI Studio export update"
    pushd "%PROJECT_DIR%"
    npm.cmd install
    git add -A
    git commit -m "!CMSG!"
    git push origin main
    popd
)
goto :done

rem -----------------------------------------------------------------------
:node_full_standalone
echo.
set /p SRC_PATH="  Path ZIP/folder (Enter = auto-detect): "
set /p CMSG="  Pesan commit (Enter = default): "
if "!CMSG!"=="" set "CMSG=sync: AI Studio export update"
if "!SRC_PATH!"=="" (
    node "%MJS_TOOL%" --install --commit --message "!CMSG!"
) else (
    node "%MJS_TOOL%" "!SRC_PATH!" --install --commit --message "!CMSG!"
)
goto :done

rem -----------------------------------------------------------------------
:done
echo.
echo =======================================================================
echo   Selesai.
echo =======================================================================
echo.
pause
goto :end

:end
endlocal
exit /b 0
