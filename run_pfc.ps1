# Unified launcher: choose mode, start dashboard, open browser, run PFC

$ErrorActionPreference = "Stop"

# Ensure we run from repo root
Set-Location -Path $PSScriptRoot

# Activate virtual environment
$venvActivate = Join-Path $PSScriptRoot ".venv\\Scripts\\Activate.ps1"
if (-not (Test-Path $venvActivate)) {
  Write-Host "Virtual env not found. Run: scripts\\setup_windows.ps1"
  exit 1
}
. $venvActivate

Write-Host "Launcher: run_pfc.ps1 (v5)"

# Choose mode
$mode = Read-Host "Choose mode (local/hybrid) [local]"
if (-not $mode) { $mode = "local" }
$mode = $mode.ToLower().Trim()

if ($mode -ne "local" -and $mode -ne "hybrid") {
  Write-Host "Unknown mode. Use local or hybrid."
  exit 1
}

if ($mode -eq "hybrid" -and -not $env:ANTHROPIC_API_KEY) {
  Write-Host "ANTHROPIC_API_KEY not set. Set it or choose local."
  exit 1
}

# Set inference mode for this session
$env:PFC_INFERENCE_MODE = $mode
$env:PYTHONDONTWRITEBYTECODE = "1"

# Start dashboard in new terminal
$dashCmd = "& `"$venvActivate`"; python run_dashboard.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $dashCmd -WorkingDirectory $PSScriptRoot

# Wait for dashboard port, then open browser
$timeoutSec = 20
$oldProgress = $ProgressPreference
$ProgressPreference = "SilentlyContinue"
for ($i = 0; $i -lt $timeoutSec; $i++) {
  try {
    $ready = Test-NetConnection -ComputerName "127.0.0.1" -Port 8000 -InformationLevel Quiet -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
    if ($ready) { break }
  } catch {
    # Ignore transient errors while server boots
  }
  Start-Sleep -Seconds 1
}
$ProgressPreference = $oldProgress
Start-Process "http://localhost:8000"

# Run PFC in this terminal
python -B run_pfc.py
