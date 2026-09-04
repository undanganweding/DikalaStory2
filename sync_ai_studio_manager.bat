@echo off
setlocal EnableDelayedExpansion
title AI Studio Sync — Dikalastory

rem =============================================================================
rem  sync_ai_studio_manager.bat
rem  CANONICAL LAUNCHER — delegates to sync_ai_studio_manager.ps1
rem
rem  Replaces: sync_ai_studio_final.bat, auto_sync_one_click.bat
rem  Engine  : sync_ai_studio_manager.ps1  (SHA256 diff, dynamic paths)
rem =============================================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "ENGINE=%ROOT%\sync_ai_studio_manager.ps1"

if not exist "%ENGINE%" (
    echo [ERROR] Engine script tidak ditemukan: %ENGINE%
    echo Pastikan sync_ai_studio_manager.ps1 ada di folder yang sama.
    pause
    exit /b 1
)

:menu
cls
echo.
echo =======================================================================
echo   AI STUDIO SYNC ^— DIKALASTORY
echo   Engine : sync_ai_studio_manager.ps1
echo   Root   : %ROOT%
echo =======================================================================
echo.
echo   [1]  CHECK ONLY     Audit diff saja, tidak ada file yang diubah
echo   [2]  DRY RUN        Preview lengkap dengan audit report
echo   [3]  SYNC ONLY      Copy + install + validate (tanpa push)
echo   [4]  FULL SYNC      Copy + install + validate + commit + push
echo   [5]  FULL SYNC (force push)  Sama seperti 4, push --force-with-lease
echo   [6]  SYNC + SKIP VALIDATION  Full sync tanpa tsc/build/test
echo   [7]  TENTUKAN PATH  Pilih folder/zip sumber secara manual
echo   [0]  KELUAR
echo.
set /p CHOICE="  Pilih [0-7]: "

if "%CHOICE%"=="0" goto :end
if "%CHOICE%"=="1" goto :check_only
if "%CHOICE%"=="2" goto :dry_run
if "%CHOICE%"=="3" goto :sync_only
if "%CHOICE%"=="4" goto :full_sync
if "%CHOICE%"=="5" goto :full_sync_force
if "%CHOICE%"=="6" goto :sync_skip_validation
if "%CHOICE%"=="7" goto :custom_path

echo   [!] Pilihan tidak valid.
timeout /t 1 /nobreak >nul
goto :menu

rem -----------------------------------------------------------------------
:check_only
echo.
echo   Menjalankan CHECK ONLY (audit, tanpa perubahan)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -CheckOnly
goto :done

rem -----------------------------------------------------------------------
:dry_run
echo.
echo   Menjalankan DRY RUN (preview penuh)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -DryRun
goto :done

rem -----------------------------------------------------------------------
:sync_only
echo.
echo   Menjalankan SYNC ONLY (copy + install + validate, tanpa push)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -NoPush
goto :done

rem -----------------------------------------------------------------------
:full_sync
echo.
echo   Menjalankan FULL SYNC (copy + install + validate + commit + push)...
echo.
set /p COMMIT_MSG="  Pesan commit (Enter = auto-generate): "
if "!COMMIT_MSG!"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -CommitMsg "!COMMIT_MSG!"
)
goto :done

rem -----------------------------------------------------------------------
:full_sync_force
echo.
echo   Menjalankan FULL SYNC dengan force-with-lease push...
echo.
set /p COMMIT_MSG="  Pesan commit (Enter = auto-generate): "
if "!COMMIT_MSG!"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -ForcePush
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -ForcePush -CommitMsg "!COMMIT_MSG!"
)
goto :done

rem -----------------------------------------------------------------------
:sync_skip_validation
echo.
echo   PERINGATAN: Validation (tsc + build + test) akan dilewati.
echo   Gunakan hanya jika kamu yakin tidak ada breaking change.
echo.
set /p CONFIRM="  Lanjut? (y/n): "
if /i not "!CONFIRM!"=="y" goto :menu
echo.
set /p COMMIT_MSG="  Pesan commit (Enter = auto-generate): "
if "!COMMIT_MSG!"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -SkipValidation
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -SkipValidation -CommitMsg "!COMMIT_MSG!"
)
goto :done

rem -----------------------------------------------------------------------
:custom_path
echo.
echo   Masukkan path folder hasil ekstrak ATAU file .zip dari AI Studio.
echo   Contoh folder : D:\Downloads\dikalastories-export
echo   Contoh zip    : D:\Downloads\dikalastories.zip
echo.
set /p CUSTOM_PATH="  Path: "
if "!CUSTOM_PATH!"=="" (
    echo   [!] Path tidak boleh kosong.
    timeout /t 2 /nobreak >nul
    goto :menu
)
if not exist "!CUSTOM_PATH!" (
    echo   [X] Path tidak ditemukan: !CUSTOM_PATH!
    timeout /t 2 /nobreak >nul
    goto :menu
)
echo.
echo   Pilih mode untuk path ini:
echo     [1] CHECK ONLY
echo     [2] DRY RUN
echo     [3] SYNC ONLY (tanpa push)
echo     [4] FULL SYNC (commit + push)
echo.
set /p MODE2="  Pilih [1-4]: "

if "%MODE2%"=="1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -UpdateFolder "!CUSTOM_PATH!" -CheckOnly
    goto :done
)
if "%MODE2%"=="2" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -UpdateFolder "!CUSTOM_PATH!" -DryRun
    goto :done
)
if "%MODE2%"=="3" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -UpdateFolder "!CUSTOM_PATH!" -NoPush
    goto :done
)
if "%MODE2%"=="4" (
    set /p COMMIT_MSG2="  Pesan commit (Enter = auto-generate): "
    if "!COMMIT_MSG2!"=="" (
        powershell -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -UpdateFolder "!CUSTOM_PATH!"
    ) else (
        powershell -NoProfile -ExecutionPolicy Bypass -File "%ENGINE%" -UpdateFolder "!CUSTOM_PATH!" -CommitMsg "!COMMIT_MSG2!"
    )
    goto :done
)
echo   [!] Pilihan tidak valid.
timeout /t 1 /nobreak >nul
goto :menu

rem -----------------------------------------------------------------------
:done
echo.
echo =======================================================================
echo   Selesai. Log tersimpan di: %ROOT%\sync_log.txt
echo =======================================================================
echo.
set /p AGAIN="  Kembali ke menu? (y/n): "
if /i "%AGAIN%"=="y" goto :menu

:end
endlocal
exit /b 0
