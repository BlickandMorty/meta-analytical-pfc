# Frontend Spec: AI-Powered Research, Writing & Notes App

> Build me the frontend of an AI-powered Research, Writing & Notes app.

This is a local-first productivity app that lets you:
- Take deep, structured notes in a block-based editor with vaults and journals
- Power your own local LLM (via Ollama) **or** connect to cloud APIs (OpenAI/Anthropic) to get deep, deliberate AI-assisted analysis
- Do deep research — manage a library of papers/sources, tag them, annotate, export citations
- Tweak the behavior of a local LLM in real-time (steering controls, temperature, focus depth, complexity bias) — full control
- **View** (read-only) the signals of an API LLM (confidence, entropy, dissonance) — you can see what the model is doing but can't steer it, since it's not your model

**API mode vs Local mode are fundamentally different experiences:**
- **Local mode:** Full steering lab — sliders for temperature, focus depth, complexity bias. You own the model, you control it.
- **API mode:** Read-only signal dashboard — see confidence/entropy/dissonance charts, but controls are grayed out. You're viewing, not editing.
- **Simulation mode:** Offline demo with templated responses, no API keys needed.

---

## Pages & Navigation

**Top navigation** is a floating pill-button bar (glass-morphism bubbles, centered at top of screen). Each bubble is a route:

### 1. Home / Chat (`/`)
The AI conversation interface and landing page.

- IDE-style animated greeting with code-rain canvas background (matrix-style falling characters)
- Message list with **dual-view per response**:
  - "Research" view — raw, detailed analytical output
  - "Layman" view — simplified plain-language summary
  - Toggle between them per message
- Streaming text with **reasoning accordion** — collapsible section showing the AI's thinking process
- Multimodal text input at bottom
- **Synthesis card** — summarized findings with confidence % badge
- **Code artifact portal** — right-side drawer that shows code suggestions/artifacts:
  - 3 modes: Preview / Code / Edit
  - Copy to clipboard
  - "Send to Notes" dropdown to create a note block from it
- Recent chats grid on home page

### 2. Notes (`/notes`)
Block-based knowledge management system.

- **Floating right-panel sidebar** with: page list, favorites, pinned notes, search, create new
- **Two view modes:**
  - **Notes Mode** — markdown block editor with per-block editing and auto-save
  - **Canvas Mode** — spatial whiteboard for arranging notes visually
- **Block format ribbon** — toolbar with bold, italic, code, headings, quotes, lists
- **Vault system** — organize notes by workspace/project, vault picker dropdown in toolbar
- **Journals** — auto-created daily journal entries
- **Concept extraction** — AI pulls key concepts from your notes automatically
- **Concept correlation panel** — visualize relationships between concepts across different notes
- **Inline AI chat** — per-note AI assistant for asking questions about that note
- **Zen mode** — distraction-free writing (hides all chrome)
- **Toolbar buttons:** Favorite, Pin, View mode toggle, Edit/Read mode, Zen mode, Vault picker, Sidebar toggle
- **Keyboard shortcuts:** Cmd+\ for sidebar toggle

### 3. Research Library (`/research-library`)
Paper and source management.

- Add papers with: title, authors, year, journal, DOI, URL, tags, abstract
- Search & filter by keywords and tags
- Inline notes on each paper (editable)
- Tag management system
- Citation tracking

### 4. Analytics (`/analytics`)
Dashboard hub with **8 sub-tabs** displayed as pill-bubble sub-navigation:

| Sub-tab | Route | Purpose | Mode |
|---------|-------|---------|------|
| **Research Copilot** | `/research-copilot` | Methodology guidance, technique scaffolding | All modes |
| **Cortex Archive** | `/cortex-archive` | Saved brain-state snapshots as a card grid | All modes |
| **Steering Lab** | `/steering-lab` | Live parameter sliders (temp, focus depth, complexity) | **Local mode only** — grayed out in API mode |
| **Pipeline** | `/pipeline` | Real-time 10-stage analysis visualization with status/progress per stage | All modes |
| **Signals** | `/diagnostics` | Confidence, entropy, dissonance line charts over time | All modes (view-only in API) |
| **Visualizer** | `/visualizer` | Interactive D3 charts: parallel coords, heat maps, smoothing, trendlines | All modes |
| **Evaluate** | `/evaluate` | Truth assessment / claim validity tool | Full suite only |
| **Concepts** | `/concept-atlas` | Concept hierarchy tree, concept weight visualization | All modes |

### 5. Export (`/export`)
Data export page.

- **Formats:** JSON, CSV, Markdown, BibTeX, RIS
- **Data types:** All data, signals, papers, chat history, pipeline runs, thought graphs
- Download with metadata timestamp

### 6. Settings (`/settings`)
Configuration page.

- **Theme:** Light / Dark / OLED
- **Inference mode selector:** Simulation / API / Local
- **API key entry:** OpenAI, Anthropic (stored in browser)
- **Model picker:** Select which model to use per provider
- **Ollama connection status** + hardware monitoring (GPU, RAM)
- **Suite tier:** Notes (minimal) / Programming / Full (all analytics tabs)
- **Measurement toggle:** Enable/disable measurement features

### 7. Docs (`/docs`)
Documentation / help page.

### 8. Onboarding (`/onboarding`)
First-run setup flow.

- Boot sequence animation with module loading progress
- Device capability detection
- Suite tier selection (3 tiers)
- API key entry (optional — can skip for Simulation mode)

---

## Design System

### Glass Morphism
Every surface uses glass-morphism:
```css
backdrop-filter: blur(12px) saturate(1.4);
background: rgba(244, 189, 111, 0.08); /* semi-transparent */
```
- Blur range: 12px (subtle) to 120px (heavy, for modals)
- Saturate: 1.3 to 1.4

### Brand Color Palette
| Token | Hex | Usage |
|-------|-----|-------|
| `pfc-violet` | `#C4956A` | Primary brand accent — warm brown/gold |
| `pfc-ember` | `#E07850` | Alert, active states — burnt orange |
| `pfc-green` | `#34D399` | Success — emerald |
| `pfc-cyan` | `#22D3EE` | Info — cyan |
| `pfc-red` | `#F87171` | Error — salmon red |
| `pfc-yellow` | `#FBBF24` | Warning — amber |

### Animation & Easing
- **Primary easing (Cupertino):** `cubic-bezier(0.32, 0.72, 0, 1)` — used for all nav transitions, modals, page transitions
- **Spring presets (Framer Motion):**
  - `snappy`: stiffness 500, damping 35 (quick, bouncy)
  - `gentle`: stiffness 300, damping 25 (slower, smooth)
  - `standard`: stiffness 400, damping 30 (balanced)
- AnimatePresence for mount/unmount transitions
- Content stagger animation on page load

### Core UI Components
| Component | Description |
|-----------|-------------|
| **GlassBubbleButton** | Reusable pill-shaped button with glass effect. Used for ALL interactive buttons across the app. |
| **PageShell** | Page wrapper with icon + title header, content stagger animation |
| **GlassSection** | Content grouping container with glass background |
| **AppShell** | Root wrapper handling localStorage hydration + grain texture overlay |
| **TopNav** | Fixed floating pill-button navbar, centered at top |

### Typography
- **Display/Headings:** Geist font family
- **Body:** System font stack
- **Code:** `ui-monospace, SFMono-Regular`
- **Scale:** 3rem h1, 2.25rem h2, 1.125rem h3

### Themes
| Theme | Background |
|-------|-----------|
| **Light** | Warm beige/cream |
| **Dark** | Deep charcoal/brown |
| **OLED** | Pure black (zero burn-in) |

### Responsive Breakpoints
- Desktop: 1024px+ (full features)
- Tablet: 640px-1024px (simplified layout)
- Mobile: <640px (portal goes fullscreen, simplified nav)

---

## State Management

**Zustand** store with 12 slices, all persisted to `localStorage` with `pfc-*` prefix:

| Slice | What it controls |
|-------|-----------------|
| `message` | Chat messages array, submit query action, streaming state |
| `pipeline` | 10-stage results, signal history (confidence, entropy, dissonance), active stage |
| `inference` | API key, provider (OpenAI/Anthropic/Ollama), model selection, inference mode |
| `controls` | Pipeline parameter overrides: focus depth, temperature, complexity bias |
| `cortex` | Brain state snapshots ("cortex archive") |
| `concepts` | Concept extraction results, concept weights, weight adjustments |
| `tier` | Suite tier (notes/programming/full), measurement toggle |
| `research` | Research papers, books, citations, tags |
| `portal` | Code artifact portal: stack navigation, display mode (preview/code/edit) |
| `ui` | UI state flags: thinking visible, synthesis view open, etc. |
| `notes` | Note pages, blocks, vaults, journals — full CRUD |
| `learning` | AI learning summaries, concept insights |

### Persistence
- All `pfc-*` keys in localStorage
- Hydrated on app mount in AppShell
- Notes are vault-scoped: `pfc-vault-{vaultId}-pages`, `pfc-vault-{vaultId}-blocks`
- Manual save on notes page unmount

---

## Streaming & Real-Time

**SSE (Server-Sent Events)** — not WebSocket:
- Endpoint: `POST /api/chat`
- Custom `useChatStream` hook handles streaming
- Event types: `content` (AI text), `reasoning` (thinking), `pipeline_stage` (stage completion), `signal_update` (confidence/entropy), `complete` (done)
- Supports pause/resume, artifact detection, reasoning separation

---

## Dual-Message System

Every AI response generates TWO outputs:
1. **rawAnalysis** — detailed, technical, research-grade analysis (shown in "Research" view)
2. **laymanSummary** — simplified, accessible summary (shown in "Layman" view)

Users toggle between views per message.

---

## 10-Stage Pipeline

The AI processes queries through 10 sequential stages:
1. Triage
2. Memory
3. Routing
4. Statistical
5. Causal
6. Meta-Analysis
7. Bayesian
8. Synthesis
9. Adversarial
10. Calibration

Each stage shows status (idle/active/complete/error) and progress (0-1) in the Pipeline analytics tab.

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat` | POST | Main pipeline — stream 10-stage analysis + synthesis |
| `/api/evaluate` | POST | Truth assessment |
| `/api/history` | GET | Load chat history |
| `/api/synthesis` | POST | Generate layman summary |
| `/api/test-connection` | GET | Test LLM provider connectivity |
| `/api/ollama-check` | GET | Check Ollama availability |
| `/api/ollama-status` | GET | Get Ollama hardware stats |
| `/api/notes-learn` | POST | AI learning from notes |

---

## Database

**SQLite** via Drizzle ORM (file: `pfc.db`, auto-created on first launch):
- `user` table
- `chat` table (per conversation)
- `message` table (with rawAnalysis + laymanSummary fields)
- `chatSignals` table (confidence, entropy, dissonance, healthScore)

---

## Suite Tiers (Feature Gating)

| Tier | What's available |
|------|-----------------|
| **Notes** | Chat, Notes, basic AI — no analytics |
| **Programming** | Chat, Notes, Research Library, some analytics |
| **Full** | Everything — all 8 analytics tabs, evaluate, steering lab |

Nav items that require a higher tier are visible but grayed out with a lock indicator.

---

## Key Technical Stack

- **Framework:** Next.js (App Router, not Pages Router)
- **React:** 19.x
- **State:** Zustand with subscribeWithSelector
- **Styling:** Tailwind CSS v4 + Radix UI primitives (shadcn pattern)
- **Animation:** Framer Motion
- **Charts:** D3.js
- **Icons:** Lucide React
- **Theme:** next-themes
- **DB:** Drizzle ORM + better-sqlite3
- **AI SDK:** Vercel AI SDK (@ai-sdk/openai, @ai-sdk/anthropic, @ai-sdk/openai-compatible)
- **Markdown:** react-markdown + remark-gfm
- **Toasts:** Sonner
