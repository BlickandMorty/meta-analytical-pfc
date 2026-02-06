# ═══════════════════════════════════════════════════════════════════
# PFC — Meta-Analytical Reasoning Engine — Setup Script (Windows PowerShell)
# ═══════════════════════════════════════════════════════════════════
#
# Usage:
#   Right-click → Run with PowerShell
#   OR: powershell -ExecutionPolicy Bypass -File setup.ps1
#
# What this does:
#   1. Checks for Node.js (installs guidance if missing)
#   2. Installs npm dependencies
#   3. Checks for Ollama (downloads installer if missing, for Local Mode)
#   4. Pulls a default model (llama3.1:8b)
#   5. Starts the dev server
#
# ═══════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

# ── Colors ────────────────────────────────────────────────────────
function Write-Header {
    Write-Host ""
    Write-Host "===========================================================" -ForegroundColor Cyan
    Write-Host "  PFC — Meta-Analytical Reasoning Engine" -ForegroundColor White
    Write-Host "===========================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step($num, $msg) {
    Write-Host "[$num/5] " -ForegroundColor Blue -NoNewline
    Write-Host "$msg" -ForegroundColor White
}

function Write-Ok($msg) {
    Write-Host "  ✓ " -ForegroundColor Green -NoNewline
    Write-Host "$msg"
}

function Write-Warn($msg) {
    Write-Host "  ⚠ " -ForegroundColor Yellow -NoNewline
    Write-Host "$msg"
}

function Write-Err($msg) {
    Write-Host "  ✗ " -ForegroundColor Red -NoNewline
    Write-Host "$msg"
}

$SkipOllama = $false

# ── Step 1: Check Node.js ────────────────────────────────────────
function Test-NodeJs {
    Write-Step 1 "Checking Node.js..."

    try {
        $nodeVersion = & node -v 2>$null
        if ($nodeVersion) {
            Write-Ok "Node.js $nodeVersion found"

            $major = [int]($nodeVersion -replace 'v','').Split('.')[0]
            if ($major -lt 18) {
                Write-Warn "Node.js 18+ recommended. You have $nodeVersion."
                Write-Warn "Visit https://nodejs.org to upgrade."
            }
            return $true
        }
    } catch {}

    Write-Err "Node.js not found."
    Write-Host ""
    Write-Host "  Install Node.js 18+ from one of these options:"
    Write-Host ""
    Write-Host "    Option 1 (Installer): https://nodejs.org"
    Write-Host "    Option 2 (winget):    winget install OpenJS.NodeJS.LTS"
    Write-Host "    Option 3 (Chocolatey): choco install nodejs-lts"
    Write-Host ""
    Write-Host "  After installing Node.js, close and re-open PowerShell, then re-run this script."
    return $false
}

# ── Step 2: Install Dependencies ─────────────────────────────────
function Install-Dependencies {
    Write-Step 2 "Installing npm dependencies..."

    if (Test-Path "node_modules") {
        Write-Ok "node_modules exists, running npm install to sync..."
    }

    & npm install --loglevel=error 2>&1 | ForEach-Object { Write-Host "  $_" }

    if (Test-Path "node_modules") {
        Write-Ok "Dependencies installed"
    } else {
        Write-Err "npm install failed. Check the output above."
        exit 1
    }
}

# ── Step 3: Check/Install Ollama ─────────────────────────────────
function Setup-Ollama {
    Write-Step 3 "Checking Ollama (for Local Mode)..."

    try {
        $ollamaVersion = & ollama --version 2>$null
        if ($ollamaVersion) {
            Write-Ok "Ollama found ($ollamaVersion)"
            return
        }
    } catch {}

    Write-Host ""
    Write-Host "  Ollama is not installed." -ForegroundColor Yellow
    Write-Host "  Ollama is required for Local Mode (running LLMs on your machine)."
    Write-Host "  You can skip this if you only want Simulation or API mode."
    Write-Host ""

    $response = Read-Host "  Install Ollama now? [Y/n]"
    if ($response -eq 'n' -or $response -eq 'N') {
        Write-Warn "Skipping Ollama installation."
        Write-Warn "You can install it later from https://ollama.ai"
        $script:SkipOllama = $true
        return
    }

    Write-Host "  Downloading Ollama installer..."
    $installerPath = "$env:TEMP\OllamaSetup.exe"

    try {
        Invoke-WebRequest -Uri "https://ollama.ai/download/OllamaSetup.exe" -OutFile $installerPath -UseBasicParsing
        Write-Ok "Downloaded Ollama installer"
        Write-Host ""
        Write-Host "  Running Ollama installer..."
        Write-Host "  Follow the installer prompts to complete installation."
        Write-Host ""
        Start-Process -FilePath $installerPath -Wait
        Write-Ok "Ollama installer finished"
        Write-Host ""
        Write-Warn "You may need to restart PowerShell for 'ollama' to be available."
        Write-Warn "If the model pull step fails, restart PowerShell and run:"
        Write-Warn "  ollama pull llama3.1:8b"
    } catch {
        Write-Warn "Could not download Ollama. Install manually from https://ollama.ai"
        $script:SkipOllama = $true
    }
}

# ── Step 4: Pull Default Model ───────────────────────────────────
function Pull-Model {
    Write-Step 4 "Setting up default model..."

    if ($script:SkipOllama) {
        Write-Warn "Skipping model pull (Ollama not installed)"
        return
    }

    try {
        $null = & ollama --version 2>$null
    } catch {
        Write-Warn "Ollama not found in PATH, skipping model pull"
        Write-Warn "After installing Ollama, run: ollama pull llama3.1:8b"
        return
    }

    # Check if Ollama is running
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 3 2>$null
        Write-Ok "Ollama is running"
    } catch {
        Write-Host "  Starting Ollama service..."
        Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
        Start-Sleep -Seconds 3

        try {
            $null = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 3 2>$null
            Write-Ok "Ollama service started"
        } catch {
            Write-Warn "Could not start Ollama. Start it manually, then run: ollama pull llama3.1:8b"
            return
        }
    }

    # Check existing models
    try {
        $tagsResponse = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 5
        $tagsData = $tagsResponse.Content | ConvertFrom-Json
        $existingModels = $tagsData.models

        if ($existingModels -and $existingModels.Count -gt 0) {
            Write-Ok "Models already available:"
            foreach ($m in $existingModels) {
                Write-Host "      $($m.name)"
            }
            Write-Host ""
            $response = Read-Host "  Pull llama3.1:8b as well? (recommended, ~4.7 GB) [y/N]"
            if ($response -ne 'y' -and $response -ne 'Y') {
                Write-Ok "Using existing models"
                return
            }
        }
    } catch {}

    Write-Host ""
    Write-Host "  Select a model to pull:"
    Write-Host ""
    Write-Host "    1) llama3.1:8b    (~4.7 GB, recommended, best overall)"
    Write-Host "    2) qwen2.5:7b     (~4.4 GB, multilingual)"
    Write-Host "    3) mistral:7b     (~4.1 GB, fast)"
    Write-Host "    4) phi3:mini      (~2.3 GB, lightweight)"
    Write-Host "    5) Skip for now"
    Write-Host ""
    $choice = Read-Host "  Choose [1-5]"

    switch ($choice) {
        "1" { $model = "llama3.1:8b" }
        "2" { $model = "qwen2.5:7b" }
        "3" { $model = "mistral:7b" }
        "4" { $model = "phi3:mini" }
        default {
            Write-Warn "Skipping model pull. Run 'ollama pull <model>' later."
            return
        }
    }

    Write-Host "  Pulling $model... (this may take a few minutes)"
    & ollama pull $model 2>&1 | ForEach-Object { Write-Host "  $_" }
    Write-Ok "$model ready"
}

# ── Step 5: Start the App ────────────────────────────────────────
function Start-App {
    Write-Step 5 "Starting PFC..."
    Write-Host ""
    Write-Host "  Setup complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Starting the development server..."
    Write-Host "  Open " -NoNewline
    Write-Host "http://localhost:3000" -ForegroundColor Cyan -NoNewline
    Write-Host " in your browser."
    Write-Host ""
    Write-Host "  Press Ctrl+C to stop the server." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "===========================================================" -ForegroundColor Cyan
    Write-Host ""

    & npm run dev
}

# ── Main ──────────────────────────────────────────────────────────
Write-Header

Write-Host "  System: Windows ($env:PROCESSOR_ARCHITECTURE)"
Write-Host ""

if (-not (Test-NodeJs)) { exit 1 }
Write-Host ""
Install-Dependencies
Write-Host ""
Setup-Ollama
Write-Host ""
Pull-Model
Write-Host ""
Start-App
