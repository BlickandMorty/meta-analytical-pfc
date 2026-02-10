@echo off
REM ═══════════════════════════════════════════════════════════════════
REM PFC — Meta-Analytical Reasoning Engine — Setup Script (Windows CMD)
REM ═══════════════════════════════════════════════════════════════════
REM
REM Usage: Double-click this file, or run from Command Prompt
REM
REM If you have PowerShell available, use setup.ps1 instead for
REM a better experience (model selection, colored output, etc.)
REM
REM What this does:
REM   1. Checks for Node.js 18+
REM   2. Installs npm dependencies (workspace-aware)
REM   3. Creates .env from .env.example if missing
REM   4. Checks for Ollama (for Local Mode)
REM   5. Offers to pull a default model
REM   6. Starts the dev server
REM
REM ═══════════════════════════════════════════════════════════════════

setlocal enabledelayedexpansion

echo.
echo ===========================================================
echo   PFC — Meta-Analytical Reasoning Engine
echo ===========================================================
echo.

REM ── Resolve project root (works from root or pfc-app/) ────────
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM Check if parent has a workspace package.json
set "PARENT_DIR=%SCRIPT_DIR%\.."
if exist "%PARENT_DIR%\package.json" (
    findstr /C:"workspaces" "%PARENT_DIR%\package.json" >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
        pushd "%PARENT_DIR%"
        set "PROJECT_ROOT=!CD!"
        popd
        set "APP_DIR=%SCRIPT_DIR%"
    ) else (
        set "PROJECT_ROOT=%SCRIPT_DIR%"
        set "APP_DIR=%SCRIPT_DIR%"
    )
) else (
    set "PROJECT_ROOT=%SCRIPT_DIR%"
    set "APP_DIR=%SCRIPT_DIR%"
)

echo   Root: %PROJECT_ROOT%
echo   App:  %APP_DIR%
echo.

REM ── Step 1: Check Node.js ──────────────────────────────────────
echo [1/6] Checking Node.js...

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo   X Node.js not found.
    echo.
    echo   Install Node.js 18+ from: https://nodejs.org
    echo   Or run: winget install OpenJS.NodeJS.LTS
    echo.
    echo   After installing, close this window and re-run setup.bat
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo   OK Node.js %NODE_VERSION% found

REM ── Step 2: Install Dependencies ───────────────────────────────
echo.
echo [2/6] Installing npm dependencies...
echo   Installing from workspace root: %PROJECT_ROOT%

pushd "%PROJECT_ROOT%"
call npm install --loglevel=error
if %ERRORLEVEL% NEQ 0 (
    echo   X npm install failed. Check the output above.
    popd
    pause
    exit /b 1
)
popd
echo   OK Dependencies installed

REM ── Step 3: Environment File ───────────────────────────────────
echo.
echo [3/6] Setting up environment file...

if exist "%PROJECT_ROOT%\.env" (
    echo   OK .env already exists
) else if exist "%PROJECT_ROOT%\.env.example" (
    copy "%PROJECT_ROOT%\.env.example" "%PROJECT_ROOT%\.env" >nul
    echo   OK Created .env from .env.example
    echo   !  Edit .env to add your API keys (optional - you can set them in Settings UI)
) else (
    echo   !  No .env.example found, skipping
)

REM ── Step 4: Check Ollama ───────────────────────────────────────
echo.
echo [4/6] Checking Ollama (for Local Mode)...

where ollama >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo   ! Ollama is not installed.
    echo   ! Ollama is needed for Local Mode (running LLMs on your machine).
    echo   ! Download from: https://ollama.ai
    echo   ! You can skip this if you only want Simulation or API mode.
    echo.
    set /p INSTALL_OLLAMA="  Open Ollama download page? [Y/n] "
    if /i "!INSTALL_OLLAMA!"=="n" (
        echo   Skipping Ollama. Install later from https://ollama.ai
        goto :SKIPMODEL
    )
    start https://ollama.ai/download
    echo   Opening download page... Install Ollama, then re-run this script
    echo   to pull a model.
    goto :SKIPMODEL
)

for /f "tokens=*" %%i in ('ollama --version 2^>nul') do set OLLAMA_VERSION=%%i
echo   OK Ollama found (%OLLAMA_VERSION%)

REM ── Step 5: Pull Default Model ────────────────────────────────
echo.
echo [5/6] Setting up default model...
echo.
echo   Select a model to pull:
echo.
echo     1) llama3.2:8b    (~4.9 GB, recommended)
echo     2) llama3.1:8b    (~4.7 GB, solid general-purpose)
echo     3) qwen2.5:7b     (~4.4 GB, multilingual)
echo     4) mistral:7b     (~4.1 GB, fast)
echo     5) phi3:mini      (~2.3 GB, lightweight)
echo     6) Skip for now
echo.
set /p MODEL_CHOICE="  Choose [1-6]: "

if "%MODEL_CHOICE%"=="1" set MODEL=llama3.2:8b
if "%MODEL_CHOICE%"=="2" set MODEL=llama3.1:8b
if "%MODEL_CHOICE%"=="3" set MODEL=qwen2.5:7b
if "%MODEL_CHOICE%"=="4" set MODEL=mistral:7b
if "%MODEL_CHOICE%"=="5" set MODEL=phi3:mini
if "%MODEL_CHOICE%"=="6" goto :SKIPMODEL
if "%MODEL%"=="" goto :SKIPMODEL

echo   Pulling %MODEL%... (this may take a few minutes)
ollama pull %MODEL%
echo   OK %MODEL% ready
goto :STARTAPP

:SKIPMODEL
echo   Skipping model pull.

:STARTAPP
REM ── Step 6: Start the App ──────────────────────────────────────
echo.
echo [6/6] Starting PFC...
echo.
echo   Setup complete!
echo.
echo   Inference modes available:
echo     - Simulation   No setup needed (default)
echo     - API          Set your OpenAI/Anthropic key in Settings
echo     - Local        Requires Ollama running with a model
echo.
echo   Starting the development server...
echo   Open http://localhost:3000 in your browser.
echo.
echo   Press Ctrl+C to stop the server.
echo.
echo ===========================================================
echo.

pushd "%APP_DIR%"
call npm run dev
