# ═══════════════════════════════════════════════════════════════════
# PFC — Meta-Analytical Reasoning Engine — Setup Script (Windows PowerShell)
# ═══════════════════════════════════════════════════════════════════
#
# Usage:
#   Right-click → Run with PowerShell
#   OR: powershell -ExecutionPolicy Bypass -File setup.ps1
#
# What this does:
#   1. Checks for Node.js 18+ (installs guidance if missing)
#   2. Checks for native build tools (needed by better-sqlite3)
#   3. Installs npm dependencies (workspace-aware)
#   4. Creates .env from .env.example if missing
#   5. Initializes the SQLite database
#   6. Checks for Ollama (downloads installer if missing, for Local Mode)
#   7. Pulls a default model
#   8. Starts the dev server
#
# ═══════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

$TotalSteps = 8

# ── Colors ────────────────────────────────────────────────────────
function Write-Header {
    Write-Host ""
    Write-Host "===========================================================" -ForegroundColor Cyan
    Write-Host "  PFC — Meta-Analytical Reasoning Engine" -ForegroundColor White
    Write-Host "===========================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step($num, $msg) {
    Write-Host "[$num/$TotalSteps] " -ForegroundColor Blue -NoNewline
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

# ── Resolve project root (works from root or pfc-app/) ───────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ParentJson = Join-Path (Split-Path -Parent $ScriptDir) "package.json"

if ((Test-Path $ParentJson) -and (Select-String -Path $ParentJson -Pattern '"workspaces"' -Quiet)) {
    $ProjectRoot = Split-Path -Parent $ScriptDir
    $AppDir = $ScriptDir
} else {
    $ProjectRoot = $ScriptDir
    $AppDir = $ScriptDir
}

# ── Step 1: Check Node.js ────────────────────────────────────────
function Test-NodeJs {
    Write-Step 1 "Checking Node.js..."

    try {
        $nodeVersion = & node -v 2>$null
        if ($nodeVersion) {
            Write-Ok "Node.js $nodeVersion found"

            $major = [int]($nodeVersion -replace 'v','').Split('.')[0]
            if ($major -lt 18) {
                Write-Err "Node.js 18+ required. You have $nodeVersion."
                Write-Host "  Visit https://nodejs.org to upgrade."
                return $false
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

# ── Step 2: Check native build tools ─────────────────────────────
function Test-BuildTools {
    Write-Step 2 "Checking native build tools (for better-sqlite3)..."

    $missingTools = @()

    try {
        $null = & python --version 2>$null
        Write-Ok "Python found"
    } catch {
        try {
            $null = & python3 --version 2>$null
            Write-Ok "Python found"
        } catch {
            $missingTools += "python"
        }
    }

    # Check for Visual Studio Build Tools or Visual Studio
    $vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vsWhere) {
        $vsInstall = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
        if ($vsInstall) {
            Write-Ok "Visual Studio C++ Build Tools found"
        } else {
            $missingTools += "VS Build Tools"
        }
    } else {
        # Check for standalone build tools
        try {
            $null = & cl.exe 2>$null
            Write-Ok "C++ compiler found"
        } catch {
            $missingTools += "VS Build Tools"
        }
    }

    if ($missingTools.Count -gt 0) {
        Write-Warn "Missing build tools: $($missingTools -join ', ')"
        Write-Host ""
        Write-Host "  better-sqlite3 requires native compilation."
        Write-Host "  Install with: npm install --global windows-build-tools"
        Write-Host "  Or install Visual Studio Build Tools from:"
        Write-Host "    https://visualstudio.microsoft.com/visual-cpp-build-tools/"
        Write-Host ""
        $response = Read-Host "  Continue anyway? [y/N]"
        if ($response -ne 'y' -and $response -ne 'Y') {
            Write-Host "  Install the missing tools first, then re-run this script."
            exit 1
        }
    } else {
        Write-Ok "All build tools present"
    }
}

# ── Step 3: Install Dependencies ─────────────────────────────────
function Install-Dependencies {
    Write-Step 3 "Installing npm dependencies..."

    # Install from workspace root so hoisted dependencies (d3, etc.) resolve correctly
    Write-Host "  Installing from workspace root: $ProjectRoot"
    Push-Location $ProjectRoot

    & npm install --loglevel=error 2>&1 | ForEach-Object { Write-Host "  $_" }

    if ((Test-Path (Join-Path $AppDir "node_modules")) -or (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
        Write-Ok "Dependencies installed"
    } else {
        Write-Err "npm install failed. Check the output above."
        Pop-Location
        exit 1
    }

    # Verify better-sqlite3 compiled
    $sqlite3Path1 = Join-Path $ProjectRoot "node_modules\better-sqlite3\build\Release\better_sqlite3.node"
    $sqlite3Path2 = Join-Path $AppDir "node_modules\better-sqlite3\build\Release\better_sqlite3.node"
    if ((Test-Path $sqlite3Path1) -or (Test-Path $sqlite3Path2)) {
        Write-Ok "better-sqlite3 native module compiled"
    } else {
        Write-Warn "better-sqlite3 may not have compiled. The app needs this for its database."
        Write-Warn "Try: cd $ProjectRoot && npm rebuild better-sqlite3"
    }

    Pop-Location
}

# ── Step 4: Environment File ─────────────────────────────────────
function Setup-Env {
    Write-Step 4 "Setting up environment file..."

    $envExample = Join-Path $ProjectRoot ".env.example"
    $envFile = Join-Path $ProjectRoot ".env"

    if (Test-Path $envFile) {
        Write-Ok ".env already exists"
    } elseif (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Ok "Created .env from .env.example"
        Write-Warn "Edit .env to add your API keys (optional - you can also set them in the Settings UI)"
    } else {
        Write-Warn "No .env.example found, skipping"
    }
}

# ── Step 5: Database Initialization ──────────────────────────────
function Init-Database {
    Write-Step 5 "Checking database..."

    $dbPath = Join-Path $AppDir "pfc.db"

    if (Test-Path $dbPath) {
        Write-Ok "SQLite database exists (pfc.db)"
    } else {
        Write-Ok "Database will be auto-created on first launch (pfc.db)"
        Write-Ok "Using SQLite with WAL mode for best performance"
    }
}

# ── Step 6: Check/Install Ollama ─────────────────────────────────
function Setup-Ollama {
    Write-Step 6 "Checking Ollama (for Local Mode)..."

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
        Write-Warn "  ollama pull llama3.2:8b"
    } catch {
        Write-Warn "Could not download Ollama. Install manually from https://ollama.ai"
        $script:SkipOllama = $true
    }
}

# ── Step 7: Pull Default Model ───────────────────────────────────
function Pull-Model {
    Write-Step 7 "Setting up default model..."

    if ($script:SkipOllama) {
        Write-Warn "Skipping model pull (Ollama not installed)"
        return
    }

    try {
        $null = & ollama --version 2>$null
    } catch {
        Write-Warn "Ollama not found in PATH, skipping model pull"
        Write-Warn "After installing Ollama, run: ollama pull llama3.2:8b"
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
            Write-Warn "Could not start Ollama. Start it manually, then run: ollama pull llama3.2:8b"
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
            $response = Read-Host "  Pull another model as well? [y/N]"
            if ($response -ne 'y' -and $response -ne 'Y') {
                Write-Ok "Using existing models"
                return
            }
        }
    } catch {}

    Write-Host ""
    Write-Host "  Select a model to pull:"
    Write-Host ""
    Write-Host "    1) llama3.2:8b    (~4.9 GB, recommended, best overall)"
    Write-Host "    2) llama3.1:8b    (~4.7 GB, solid general-purpose)"
    Write-Host "    3) qwen2.5:7b     (~4.4 GB, multilingual)"
    Write-Host "    4) mistral:7b     (~4.1 GB, fast)"
    Write-Host "    5) phi3:mini      (~2.3 GB, lightweight)"
    Write-Host "    6) Skip for now"
    Write-Host ""
    $choice = Read-Host "  Choose [1-6]"

    switch ($choice) {
        "1" { $model = "llama3.2:8b" }
        "2" { $model = "llama3.1:8b" }
        "3" { $model = "qwen2.5:7b" }
        "4" { $model = "mistral:7b" }
        "5" { $model = "phi3:mini" }
        default {
            Write-Warn "Skipping model pull. Run 'ollama pull <model>' later."
            return
        }
    }

    Write-Host "  Pulling $model... (this may take a few minutes)"
    & ollama pull $model 2>&1 | ForEach-Object { Write-Host "  $_" }
    Write-Ok "$model ready"
}

# ── Step 8: Start the App ────────────────────────────────────────
function Start-App {
    Write-Step 8 "Starting PFC..."
    Write-Host ""
    Write-Host "  Setup complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Inference modes available:"
    Write-Host "    - Simulation  No setup needed (default)"
    Write-Host "    - API         Set your OpenAI/Anthropic key in Settings"
    Write-Host "    - Local       Requires Ollama running with a model"
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

    Set-Location $AppDir
    & npm run dev
}

# ── Main ──────────────────────────────────────────────────────────
Write-Header

Write-Host "  System: Windows ($env:PROCESSOR_ARCHITECTURE)"
Write-Host "  Root:   $ProjectRoot"
Write-Host "  App:    $AppDir"
Write-Host ""

if (-not (Test-NodeJs)) { exit 1 }
Write-Host ""
Test-BuildTools
Write-Host ""
Install-Dependencies
Write-Host ""
Setup-Env
Write-Host ""
Init-Database
Write-Host ""
Setup-Ollama
Write-Host ""
Pull-Model
Write-Host ""
Start-App
