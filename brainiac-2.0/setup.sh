#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# PFC — Meta-Analytical Reasoning Engine — Setup Script (macOS/Linux)
# ═══════════════════════════════════════════════════════════════════
#
# Usage:
#   chmod +x setup.sh && ./setup.sh
#
# What this does:
#   1. Checks for Node.js 18+ (installs guidance if missing)
#   2. Checks for native build tools (needed by better-sqlite3)
#   3. Installs npm dependencies (workspace-aware)
#   4. Creates .env from .env.example if missing
#   5. Initializes the SQLite database
#   6. Checks for Ollama (installs if missing, for Local Mode)
#   7. Pulls a default model
#   8. Starts the dev server
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

TOTAL_STEPS=8

print_header() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  PFC — Meta-Analytical Reasoning Engine${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
}

print_step() {
  echo -e "${BLUE}[$1/${TOTAL_STEPS}]${NC} ${BOLD}$2${NC}"
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

# ── Resolve project root (works from root or pfc-app/) ───────────
resolve_paths() {
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  # If setup.sh lives inside pfc-app/, the workspace root is one level up
  if [ -f "${SCRIPT_DIR}/../package.json" ] && grep -q '"workspaces"' "${SCRIPT_DIR}/../package.json" 2>/dev/null; then
    PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
    APP_DIR="${SCRIPT_DIR}"
  else
    # Fallback: assume we're already at the right level
    PROJECT_ROOT="${SCRIPT_DIR}"
    APP_DIR="${SCRIPT_DIR}"
  fi
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
      print_warn "Node.js 18+ required. You have ${NODE_VERSION}."
      print_warn "Visit https://nodejs.org to upgrade."
      exit 1
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

# ── Step 2: Check native build tools ─────────────────────────────
check_build_tools() {
  print_step 2 "Checking native build tools (for better-sqlite3)..."

  MISSING_TOOLS=()

  if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    MISSING_TOOLS+=("python3")
  else
    print_ok "Python found"
  fi

  if ! command -v make &> /dev/null; then
    MISSING_TOOLS+=("make")
  else
    print_ok "make found"
  fi

  if [ "$OS" = "macos" ]; then
    if ! xcode-select -p &> /dev/null; then
      MISSING_TOOLS+=("xcode-select")
    else
      print_ok "Xcode Command Line Tools found"
    fi
  else
    if ! command -v g++ &> /dev/null && ! command -v c++ &> /dev/null; then
      MISSING_TOOLS+=("g++")
    else
      print_ok "C++ compiler found"
    fi
  fi

  if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
    print_warn "Missing build tools: ${MISSING_TOOLS[*]}"
    echo ""
    if [ "$OS" = "macos" ]; then
      echo "  Install with: xcode-select --install"
    else
      echo "  Install with: sudo apt install build-essential python3  (Debian/Ubuntu)"
      echo "            or: sudo dnf groupinstall 'Development Tools'  (Fedora)"
    fi
    echo ""
    echo "  better-sqlite3 requires native compilation."
    echo "  npm install may fail without these tools."
    echo ""
    read -p "  Continue anyway? [y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "  Install the missing tools first, then re-run this script."
      exit 1
    fi
  else
    print_ok "All build tools present"
  fi
}

# ── Step 3: Install Dependencies ─────────────────────────────────
install_deps() {
  print_step 3 "Installing npm dependencies..."

  # Install from workspace root so hoisted dependencies (d3, etc.) resolve correctly
  echo "  Installing from workspace root: ${PROJECT_ROOT}"
  cd "$PROJECT_ROOT"

  npm install --loglevel=error 2>&1 | while IFS= read -r line; do
    echo "  $line"
  done

  if [ -d "${APP_DIR}/node_modules" ] || [ -d "${PROJECT_ROOT}/node_modules" ]; then
    print_ok "Dependencies installed"
  else
    print_err "npm install failed. Check the output above."
    exit 1
  fi

  # Verify better-sqlite3 compiled
  if [ -f "${PROJECT_ROOT}/node_modules/better-sqlite3/build/Release/better_sqlite3.node" ] || \
     [ -f "${APP_DIR}/node_modules/better-sqlite3/build/Release/better_sqlite3.node" ]; then
    print_ok "better-sqlite3 native module compiled"
  else
    print_warn "better-sqlite3 may not have compiled. The app needs this for its database."
    print_warn "Try: cd ${PROJECT_ROOT} && npm rebuild better-sqlite3"
  fi

  cd "$APP_DIR"
}

# ── Step 4: Environment File ─────────────────────────────────────
setup_env() {
  print_step 4 "Setting up environment file..."

  ENV_EXAMPLE="${PROJECT_ROOT}/.env.example"
  ENV_FILE="${PROJECT_ROOT}/.env"

  if [ -f "$ENV_FILE" ]; then
    print_ok ".env already exists"
  elif [ -f "$ENV_EXAMPLE" ]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    print_ok "Created .env from .env.example"
    print_warn "Edit .env to add your API keys (optional — you can also set them in the Settings UI)"
  else
    print_warn "No .env.example found, skipping"
  fi
}

# ── Step 5: Database Initialization ──────────────────────────────
init_database() {
  print_step 5 "Checking database..."

  DB_PATH="${APP_DIR}/pfc.db"

  if [ -f "$DB_PATH" ]; then
    print_ok "SQLite database exists (pfc.db)"
  else
    print_ok "Database will be auto-created on first launch (pfc.db)"
    print_ok "Using SQLite with WAL mode for best performance"
  fi
}

# ── Step 6: Check/Install Ollama ─────────────────────────────────
setup_ollama() {
  print_step 6 "Checking Ollama (for Local Mode)..."

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

# ── Step 7: Pull Default Model ───────────────────────────────────
pull_model() {
  print_step 7 "Setting up default model..."

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
    read -p "  Pull another model as well? [y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      print_ok "Using existing models"
      return 0
    fi
  fi

  echo ""
  echo "  Select a model to pull:"
  echo ""
  echo "    1) llama3.2:8b    (~4.9 GB, recommended, best overall)"
  echo "    2) llama3.1:8b    (~4.7 GB, solid general-purpose)"
  echo "    3) qwen2.5:7b     (~4.4 GB, multilingual)"
  echo "    4) mistral:7b     (~4.1 GB, fast)"
  echo "    5) phi3:mini      (~2.3 GB, lightweight)"
  echo "    6) Skip for now"
  echo ""
  read -p "  Choose [1-6]: " -n 1 -r
  echo ""

  case $REPLY in
    1) MODEL="llama3.2:8b" ;;
    2) MODEL="llama3.1:8b" ;;
    3) MODEL="qwen2.5:7b" ;;
    4) MODEL="mistral:7b" ;;
    5) MODEL="phi3:mini" ;;
    6|*)
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

# ── Step 8: Start the App ────────────────────────────────────────
start_app() {
  print_step 8 "Starting PFC..."
  echo ""
  echo -e "  ${GREEN}${BOLD}Setup complete!${NC}"
  echo ""
  echo "  Inference modes available:"
  echo "    • Simulation — No setup needed (default)"
  echo "    • API        — Set your OpenAI/Anthropic key in Settings"
  echo "    • Local      — Requires Ollama running with a model"
  echo ""
  echo "  Starting the development server..."
  echo "  Open ${CYAN}http://localhost:3000${NC} in your browser."
  echo ""
  echo -e "  ${YELLOW}Press Ctrl+C to stop the server.${NC}"
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""

  cd "$APP_DIR"
  npm run dev
}

# ── Main ──────────────────────────────────────────────────────────

SKIP_OLLAMA=false

print_header
detect_os
resolve_paths

echo -e "  System: ${BOLD}${OS}${NC} (${ARCH})"
echo -e "  Root:   ${PROJECT_ROOT}"
echo -e "  App:    ${APP_DIR}"
echo ""

check_node
echo ""
check_build_tools
echo ""
install_deps
echo ""
setup_env
echo ""
init_database
echo ""
setup_ollama
echo ""
pull_model
echo ""
start_app
