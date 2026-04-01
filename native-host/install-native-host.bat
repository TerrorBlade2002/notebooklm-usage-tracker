@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================
REM NotebookLM Usage Tracker - Native Messaging Host Installer
REM SELF-CONTAINED: No admin required, installs per-user only.
REM Uses HKCU + LOCALAPPDATA so it works as a user logon script.
REM Idempotent: safe to run multiple times.
REM ============================================================

set "INSTALL_DIR=%LOCALAPPDATA%\NLMTracker"
set "HOST_NAME=com.astraglobal.nlm_tracker"
set "REG_KEY=HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\%HOST_NAME%"
set "SCRIPT_DIR=%~dp0"
set "HOST_BAT=%INSTALL_DIR%\get_username.bat"
set "HOST_JSON=%INSTALL_DIR%\%HOST_NAME%.json"
set "TMP_PS1=%TEMP%\nlm_native_host_%RANDOM%%RANDOM%.ps1"
set "EXTENSION_ID=%~1"

echo ============================================================
echo  NotebookLM Usage Tracker - Native Host Installer
echo  Installing for user: %USERNAME%
echo  No admin rights required. Registry target: HKCU
echo ============================================================
echo.

if "%EXTENSION_ID%"=="" (
    set /p EXTENSION_ID=Enter Chrome extension ID: 
)

if "%EXTENSION_ID%"=="" (
    echo [FAIL] Extension ID is required.
    echo        Load the unpacked extension in chrome://extensions and copy the ID.
    exit /b 1
)

echo [1/4] Creating install directory...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if errorlevel 1 (
    echo [FAIL] Could not create install directory: %INSTALL_DIR%
    exit /b 1
)

echo [2/4] Writing get_username.bat...
> "%HOST_BAT%" echo @echo off
>> "%HOST_BAT%" echo REM Native messaging host for NotebookLM Usage Tracker
>> "%HOST_BAT%" echo REM Returns Windows username via Chrome native messaging protocol
>> "%HOST_BAT%" echo powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$u=$env:USERNAME;$j='{\"username\":\"'+$u+'\"}';$b=[Text.Encoding]::UTF8.GetBytes($j);$l=[BitConverter]::GetBytes([int32]$b.Length);$o=[Console]::OpenStandardOutput();$o.Write($l,0,4);$o.Write($b,0,$b.Length);$o.Flush();$o.Close()"
if errorlevel 1 (
    echo [FAIL] Could not write %HOST_BAT%
    exit /b 1
)

echo [3/4] Generating native host manifest...
> "%TMP_PS1%" echo $ErrorActionPreference = 'Stop'
>> "%TMP_PS1%" echo $installDir = '%INSTALL_DIR%'
>> "%TMP_PS1%" echo $hostName = '%HOST_NAME%'
>> "%TMP_PS1%" echo $hostBat = Join-Path $installDir 'get_username.bat'
>> "%TMP_PS1%" echo $extensionId = '%EXTENSION_ID%'
>> "%TMP_PS1%" echo $nativeManifest = [ordered]@{
>> "%TMP_PS1%" echo ^  name = $hostName
>> "%TMP_PS1%" echo ^  description = 'NotebookLM Usage Tracker native host'
>> "%TMP_PS1%" echo ^  path = $hostBat
>> "%TMP_PS1%" echo ^  type = 'stdio'
>> "%TMP_PS1%" echo ^  allowed_origins = @("chrome-extension://$extensionId/")
>> "%TMP_PS1%" echo }
>> "%TMP_PS1%" echo $outPath = Join-Path $installDir ($hostName + '.json')
>> "%TMP_PS1%" echo $nativeManifest ^| ConvertTo-Json -Depth 4 ^| Set-Content -Path $outPath -Encoding UTF8
>> "%TMP_PS1%" echo Write-Output $extensionId

for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%TMP_PS1%"`) do set "EXTENSION_ID=%%I"
set "PS_EXIT=%ERRORLEVEL%"
del "%TMP_PS1%" 2^>nul
if not "%PS_EXIT%"=="0" (
    echo [FAIL] Could not generate native host manifest.
    exit /b 1
)

echo      Using extension ID: %EXTENSION_ID%

echo [4/4] Registering native messaging host in HKCU...
reg add "%REG_KEY%" /ve /t REG_SZ /d "%HOST_JSON%" /f >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Could not write registry key: %REG_KEY%
    exit /b 1
)

echo.
echo Verifying installation...
set "FAIL=0"

if exist "%HOST_BAT%" (
    echo  [OK] %HOST_BAT%
) else (
    echo  [FAIL] Missing: %HOST_BAT%
    set "FAIL=1"
)

if exist "%HOST_JSON%" (
    echo  [OK] %HOST_JSON%
) else (
    echo  [FAIL] Missing: %HOST_JSON%
    set "FAIL=1"
)

reg query "%REG_KEY%" /ve >nul 2>&1
if %errorlevel%==0 (
    echo  [OK] Registry key set under HKCU
) else (
    echo  [FAIL] Registry key missing: %REG_KEY%
    set "FAIL=1"
)

echo.
if "%FAIL%"=="0" (
    echo ============================================================
    echo  Installation SUCCESSFUL for user: %USERNAME%
    echo  Install dir:  %INSTALL_DIR%
    echo  Manifest:     %HOST_JSON%
    echo  Registry key: %REG_KEY%
    echo  Extension ID: %EXTENSION_ID%
    echo ============================================================
    exit /b 0
) else (
    echo ============================================================
    echo  Installation had ERRORS - check output above
    echo ============================================================
    exit /b 1
)
