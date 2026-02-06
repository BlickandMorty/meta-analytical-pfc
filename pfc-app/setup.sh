#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# PFC — Meta-Analytical Reasoning Engine — Setup Script (macOS/Linux)
# ═══════════════════════════════════════════════════════════════════
#
# Usage:
#   chmod +x setup.sh && ./setup.sh
#
# What this does:
#   1. Checks for Node.js (installs guidance if missing)
#   2. Installs npm dependencies
#   3. Checks for Ollama (installs if missing, for Local Mode)
#   4. Pulls a default model (llama3.1:8b)
#   5. Starts the dev server
#
# ═══════════════════════════════════════════════════════════════════

set -e

# ── Colors ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

print_header() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  PFC — Meta-Analytical Reasoning Engine${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
}

print_step() {
  echo -e "${BLUE}[$1/5]${NC} ${BOLD}$2${NC}"
}

print_ok() {
  echo -e "  ${GREEN}✓${NC} $1"
}

print_warn() {
  echo -e "  ${YELLOW}⚠${NC} $1"
}

print_err() {
  echo -e "  ${RED}✗${NC} $1"
}

# ── Detect OS ─────────────────────────────────────────────────────
detect_os() {
  case "$(uname -s)" in
    Darwin*) OS="macos" ;;
    Linux*)  OS="linux" ;;
    *)       OS="unknown" ;;
  esac
  ARCH="$(uname -m)"
}

# ── Step 1: Check Node.js ────────────────────────────────────────
check_node() {
  print_step 1 "Checking Node.js..."

  if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_ok "Node.js ${NODE_VERSION} found"

    # Check minimum version (18+)
    MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
    if [ "$MAJOR" -lt 18 ]; then
      print_warn "Node.js 18+ recommended. You have ${NODE_VERSION}."
      print_warn "Visit https://nodejs.org to upgrade."
    fi
  else
    print_err "Node.js not found."
    echo ""
    echo "  Install Node.js 18+ from one of these options:"
    echo ""
    if [ "$OS" = "macos" ]; then
      echo "    Option 1 (Homebrew):  brew install node"
      echo "    Option 2 (Installer): https://nodejs.org"
      echo "    Option 3 (nvm):       curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
    else
      echo "    Option 1 (nvm):       curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
      echo "    Option 2 (Package):   sudo apt install nodejs npm   (Debian/Ubuntu)"
      echo "                          sudo dnf install nodejs npm   (Fedora)"
      echo "    Option 3 (Installer): https://nodejs.org"
    fi
    echo ""
    echo "  After installing Node.js, re-run this script."
    exit 1
  fi
}

# ── Step 2: Install Dependencies ─────────────────────────────────
install_deps() {
  print_step 2 "Installing npm dependencies..."

  if [ -d "node_modules" ] && [ -f "node_modules/.package-lock.json" ]; then
    print_ok "node_modules exists, running npm install to sync..."
  fi

  npm install --loglevel=error 2>&1 | while IFS= read -r line; do
    echo "  $line"
  done

  if [ $? -eq 0 ] || [ -d "node_modules" ]; then
    print_ok "Dependencies installed"
  else
    print_err "npm install failed. Check the output above."
    exit 1
  fi
}

# ── Step 3: Check/Install Ollama ─────────────────────────────────
setup_ollama() {
  print_step 3 "Checking Ollama (for Local Mode)..."

  if command -v ollama &> /dev/null; then
    OLLAMA_VERSION=$(ollama --version 2>/dev/null || echo "installed")
    print_ok "Ollama found (${OLLAMA_VERSION})"
    return 0
  fi

  echo ""
  echo -e "  ${YELLOW}Ollama is not installed.${NC}"
  echo "  Ollama is required for Local Mode (running LLMs on your machine)."
  echo "  You can skip this if you only want Simulation or API mode."
  echo ""
  read -p "  Install Ollama now? [Y/n] " -n 1 -r
  echo ""

  if [[ $REPLY =~ ^[Nn]$ ]]; then
    print_warn "Skipping Ollama installation."
    print_warn "You can install it later from https://ollama.ai"
    SKIP_OLLAMA=true
    return 0
  fi

  echo "  Downloading Ollama..."
  if [ "$OS" = "macos" ]; then
    if command -v brew &> /dev/null; then
      brew install ollama 2>&1 | while IFS= read -r line; do echo "  $line"; done
    else
      echo "  Downloading Ollama for macOS..."
      curl -fsSL https://ollama.ai/install.sh | sh 2>&1 | while IFS= read -r line; do echo "  $line"; done
    fi
  else
    curl -fsSL https://ollama.ai/install.sh | sh 2>&1 | while IFS= read -r line; do echo "  $line"; done
  fi

  if command -v ollama &> /dev/null; then
    print_ok "Ollama installed successfully"
  else
    print_warn "Ollama installation may have failed. You can install manually from https://ollama.ai"
    SKIP_OLLAMA=true
  fi
}

# ── Step 4: Pull Default Model ───────────────────────────────────
pull_model() {
  print_step 4 "Setting up default model..."

  if [ "$SKIP_OLLAMA" = true ]; then
    print_warn "Skipping model pull (Ollama not installed)"
    return 0
  fi

  if ! command -v ollama &> /dev/null; then
    print_warn "Ollama not found, skipping model pull"
    return 0
  fi

  # Start Ollama if not running
  if ! curl -s http://localhost:11434/api/tags &> /dev/null; then
    echo "  Starting Ollama service..."
    ollama serve &> /dev/null &
    OLLAMA_PID=$!
    sleep 3

    if ! curl -s http://localhost:11434/api/tags &> /dev/null; then
      print_warn "Could not start Ollama. Start it manually with: ollama serve"
      return 0
    fi
    print_ok "Ollama service started"
  else
    print_ok "Ollama is already running"
  fi

  # Check if a model is already available
  MODELS=$(curl -s http://localhost:11434/api/tags 2>/dev/null | grep -o '"name":"[^"]*"' | head -5)
  if [ -n "$MODELS" ]; then
    print_ok "Models already available:"
    echo "$MODELS" | sed 's/"name":"//g; s/"//g' | while IFS= read -r model; do
      echo "      $model"
    done
    echo ""
    read -p "  Pull llama3.1:8b as well? (recommended, ~4.7 GB) [y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      print_ok "Using existing models"
      return 0
    fi
  fi

  echo ""
  echo "  Select a model to pull:"
  echo ""
  echo "    1) llama3.1:8b    (~4.7 GB, recommended, best overall)"
  echo "    2) qwen2.5:7b     (~4.4 GB, multilingual)"
  echo "    3) mistral:7b     (~4.1 GB, fast)"
  echo "    4) phi3:mini      (~2.3 GB, lightweight)"
  echo "    5) Skip for now"
  echo ""
  read -p "  Choose [1-5]: " -n 1 -r
  echo ""

  case $REPLY in
    1) MODEL="llama3.1:8b" ;;
    2) MODEL="qwen2.5:7b" ;;
    3) MODEL="mistral:7b" ;;
    4) MODEL="phi3:mini" ;;
    5|*)
      print_warn "Skipping model pull. Run 'ollama pull <model>' later."
      return 0
      ;;
  esac

  echo "  Pulling ${MODEL}... (this may take a few minutes)"
  ollama pull "$MODEL" 2>&1 | while IFS= read -r line; do
    echo "  $line"
  done

  if [ $? -eq 0 ]; then
    print_ok "${MODEL} ready"
  else
    print_warn "Model pull may have failed. Try: ollama pull ${MODEL}"
  fi
}

# ── Step 5: Start the App ────────────────────────────────────────
start_app() {
  print_step 5 "Starting PFC..."
  echo ""
  echo -e "  ${GREEN}${BOLD}Setup complete!${NC}"
  echo ""
  echo "  Starting the development server..."
  echo "  Open ${CYAN}http://localhost:3000${NC} in your browser."
  echo ""
  echo -e "  ${YELLOW}Press Ctrl+C to stop the server.${NC}"
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""

  npm run dev
}

# ── Main ──────────────────────────────────────────────────────────

SKIP_OLLAMA=false

print_header
detect_os

echo -e "  System: ${BOLD}${OS}${NC} (${ARCH})"
echo ""

check_node
echo ""
install_deps
echo ""
setup_ollama
echo ""
pull_model
echo ""
start_app
