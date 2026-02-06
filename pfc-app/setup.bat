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
REM ═══════════════════════════════════════════════════════════════════

echo.
echo ===========================================================
echo   PFC — Meta-Analytical Reasoning Engine
echo ===========================================================
echo.

REM ── Step 1: Check Node.js ──────────────────────────────────────
echo [1/5] Checking Node.js...

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
echo [2/5] Installing npm dependencies...

call npm install --loglevel=error
if %ERRORLEVEL% NEQ 0 (
    echo   X npm install failed. Check the output above.
    pause
    exit /b 1
)
echo   OK Dependencies installed

REM ── Step 3: Check Ollama ───────────────────────────────────────
echo.
echo [3/5] Checking Ollama (for Local Mode)...

where ollama >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo   ! Ollama is not installed.
    echo   ! Ollama is needed for Local Mode (running LLMs on your machine).
    echo   ! Download from: https://ollama.ai
    echo   ! You can skip this if you only want Simulation or API mode.
    echo.
    set /p INSTALL_OLLAMA="  Open Ollama download page? [Y/n] "
    if /i "%INSTALL_OLLAMA%"=="n" (
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

REM ── Step 4: Pull Default Model ────────────────────────────────
echo.
echo [4/5] Setting up default model...
echo.
echo   Select a model to pull:
echo.
echo     1) llama3.1:8b    (~4.7 GB, recommended)
echo     2) qwen2.5:7b     (~4.4 GB, multilingual)
echo     3) mistral:7b     (~4.1 GB, fast)
echo     4) phi3:mini      (~2.3 GB, lightweight)
echo     5) Skip for now
echo.
set /p MODEL_CHOICE="  Choose [1-5]: "

if "%MODEL_CHOICE%"=="1" set MODEL=llama3.1:8b
if "%MODEL_CHOICE%"=="2" set MODEL=qwen2.5:7b
if "%MODEL_CHOICE%"=="3" set MODEL=mistral:7b
if "%MODEL_CHOICE%"=="4" set MODEL=phi3:mini
if "%MODEL_CHOICE%"=="5" goto :SKIPMODEL
if "%MODEL%"=="" goto :SKIPMODEL

echo   Pulling %MODEL%... (this may take a few minutes)
ollama pull %MODEL%
echo   OK %MODEL% ready
goto :STARTAPP

:SKIPMODEL
echo   Skipping model pull.

:STARTAPP
REM ── Step 5: Start the App ──────────────────────────────────────
echo.
echo [5/5] Starting PFC...
echo.
echo   Setup complete!
echo.
echo   Starting the development server...
echo   Open http://localhost:3000 in your browser.
echo.
echo   Press Ctrl+C to stop the server.
echo.
echo ===========================================================
echo.

call npm run dev
