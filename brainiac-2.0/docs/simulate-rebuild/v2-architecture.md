# PFC v2 — Ideal Architecture Specification
## Date: 2026-02-14

---

## Design Philosophy

1. **The LLM prompt is the product.** Everything else is transport. The prompts in `lib/engine/llm/prompts.ts` and `steering/prompt-composer.ts` are world-class — the architecture should minimize the distance between user question and LLM reasoning.

2. **Use the framework or leave it.** If we keep Next.js App Router, we use server components, streaming, and middleware. If we don't need those features, we use Vite + React Router and save the complexity tax.

3. **One source of truth per concern.** One schema definition (Drizzle). One motion config (imported everywhere). One theme system (CSS variables via Tailwind). One set of branded types (enforced at DB boundary). One store per domain (not 13 slices in a flat namespace).

4. **Honest signals, not theatrical computation.** Confidence means something derived from LLM output, not regex on the query. Stages represent real work, not `sleep()` calls. If a metric is heuristic, name it as such.

5. **Extractable, not monolithic.** No file over 500 lines. No component with more than one primary responsibility. When a file grows past the threshold, extraction is a requirement, not a "nice to have."

---

## Project Structure

```
pfc-app/
  middleware.ts                    # Rate limiting, auth, CSP headers (edge runtime)
  next.config.ts                   # Minimal: serverExternalPackages only

  app/
    layout.tsx                     # SERVER: <html>, <body>, fonts, viewport, metadata
    global-error.tsx               # Self-contained error UI (own <html>/<body>)
    error.tsx                      # Root error boundary

    (shell)/                       # All pages needing AppShell + TopNav
      layout.tsx                   # CLIENT: AppShell, ThemeProvider, wallpapers, toast
      loading.tsx                  # Universal PixelBook spinner (replaces useSetupGuard)

      page.tsx                     # Chat landing (home)
      chat/[id]/
        page.tsx                   # SERVER: fetches messages, streams to client Chat
        loading.tsx                # Chat skeleton
      notes/
        page.tsx                   # Thin orchestrator → NotesWorkspace component
      library/
        page.tsx                   # Research paper management
      analytics/
        page.tsx                   # Tab hub: archive, steering, pipeline, signals, viz
      daemon/
        page.tsx                   # Background agent controls
      settings/
        page.tsx                   # Orchestrates section components

    onboarding/                    # Outside (shell): no nav, no wallpaper
      page.tsx

    api/                           # All API routes in one location
      chat/route.ts                # Main 10→3 stage pipeline (SSE)
      assistant/route.ts           # Mini-chat assistant (SSE)
      history/route.ts             # Chat history retrieval
      research/[action]/route.ts   # Research tools (search, review, ideas, novelty)
      notes/[action]/route.ts      # Merge: notes-ai + notes-learn + notes/sync
      system/[action]/route.ts     # Merge: daemon + ollama-check/status + test-connection

  components/
    layout/                        # App chrome
      app-shell.tsx                # ~200 lines (wallpaper via useWallpaper hook)
      page-shell.tsx               # ~150 lines
      page-transition.tsx          # ~70 lines
      top-nav.tsx                  # ~300 lines (CSS vars, no bubbleBg/bubbleColor)
      error-boundary.tsx           # ~52 lines

    chat/                          # Chat feature vertical
      chat-landing.tsx             # ~300 lines (greeting, features, recent, search)
      chat-conversation.tsx        # ~250 lines (messages + input orchestration)
      greeting-typewriter.tsx      # ~180 lines (idle escalation phases)
      chat-history-sheet.tsx       # ~200 lines (all-chats bottom sheet)
      message.tsx                  # ~350 lines (single message bubble)
      message-layman.tsx           # ~70 lines
      message-research.tsx         # ~140 lines
      messages-list.tsx            # ~200 lines (scrollable list, auto-scroll)
      thinking-accordion.tsx       # ~110 lines
      thinking-controls.tsx        # ~250 lines
      research-mode-bar.tsx        # ~150 lines
      truth-bot-card.tsx           # ~180 lines (uses GlassPanel)
      feature-buttons.tsx          # ~150 lines
      recent-chats.tsx             # ~200 lines
      multimodal-input.tsx         # ~350 lines (attachments, submit, stop)
      steering-feedback.tsx        # ~72 lines
      steering-indicator.tsx       # ~80 lines

    assistant/                     # Mini-chat feature vertical
      mini-chat-shell.tsx          # ~400 lines (container, drag, resize, tabs)
      mini-chat-tab.tsx            # ~350 lines (single chat thread)
      mini-chat-history.tsx        # ~200 lines
      mini-chat-notes.tsx          # ~200 lines
      mini-chat-research.tsx       # ~200 lines

    notes/                         # Notes feature vertical
      notes-workspace.tsx          # ~500 lines (active note editing)
      notes-landing.tsx            # ~200 lines (recent pages, vault selection)
      block-editor/
        editor.tsx                 # ~500 lines (block list, keyboard nav, undo/redo)
        block-renderer.tsx         # ~300 lines (render by type)
        slash-menu.tsx             # ~250 lines (command palette, fuzzy search)
        context-menu.tsx           # ~200 lines (right-click operations)
      notes-sidebar.tsx            # ~400 lines (CSS vars, no t() function)
      graph-view.tsx               # ~700 lines (D3 force graph — inherently complex)
      concept-panel.tsx            # ~300 lines (uses GlassPanel)
      note-ai-chat.tsx             # ~400 lines (uses GlassPanel)
      note-canvas.tsx              # ~1,540 lines (tldraw-inspired — irreducible)
      vault-picker.tsx             # ~300 lines (uses GlassPanel)

    viz/                           # Visualization components
      concept-hierarchy-panel.tsx  # ~300 lines
      concept-mini-map.tsx         # ~450 lines (canvas)
      portal-sidebar.tsx           # ~500 lines

    decorative/                    # Aesthetic (all lazy-loaded, prefers-reduced-motion)
      wallpapers/
        thematic.tsx               # ~365 lines
        sunny.tsx                  # ~430 lines
        sunset.tsx                 # ~455 lines
      star-field.tsx               # ~310 lines

    ui/                            # shadcn/ui primitives (unchanged — these are good)
      button.tsx, badge.tsx, card.tsx, input.tsx, switch.tsx,
      slider.tsx, tabs.tsx, tooltip.tsx, separator.tsx,
      collapsible.tsx, progress.tsx, alert-dialog.tsx,
      dropdown-menu.tsx, scroll-area.tsx,
      glass-panel.tsx, pill-tabs.tsx, chat-input.tsx

    shared/
      markdown.tsx                 # Single renderer with optional withAnchors prop
      toast-container.tsx          # Uses GlassPanel

  hooks/
    use-is-dark.ts                 # ~39 lines
    use-scroll-to-bottom.ts        # ~83 lines
    use-chat-stream.ts             # ~576 lines
    use-assistant-stream.ts        # ~260 lines
    use-typewriter.ts              # ~124 lines
    use-setup-guard.ts             # ~27 lines (or removed if loading.tsx replaces it)
    use-wallpaper.ts               # NEW: wallpaper selection logic from app-shell

  lib/
    engine/
      query-analysis.ts            # ~250 lines (analyzeQuery, follow-up detection, domain)
      pipeline.ts                  # ~400 lines (3-stage async generator + SSE events)
      signals.ts                   # ~200 lines (signal derivation FROM LLM output)
      fallback-generators.ts       # ~400 lines (template text when no LLM)
      reflection.ts                # ~200 lines (self-critique)
      arbitration.ts               # ~200 lines (multi-perspective, ideally multi-model)
      truthbot.ts                  # ~500 lines (truth assessment)
      llm/
        provider.ts                # ~60 lines (unchanged — clean factory)
        generate.ts                # ~200 lines (unchanged — stream/generate wrappers)
        prompts.ts                 # ~300 lines (THE CORE IP — protect this file)
        schemas.ts                 # ~100 lines (Zod schemas for structured output)
      steering/
        prompt-composer.ts         # ~200 lines (unchanged — excellent)
        engine.ts                  # ~300 lines (3-layer steering)
        memory.ts                  # ~200 lines (moved to SQLite persistence)
      soar/                        # SIMPLIFIED: conditional second-pass, not full loop
        engine.ts                  # ~200 lines (probe + optional reflection pass)
        detector.ts                # ~100 lines (deterministic, no Math.random())
      types.ts                     # ~200 lines (simplified, honest signal names)

    store/
      use-chat-store.ts            # Standalone store: messages, streaming, attachments
      use-notes-store.ts           # Standalone store: pages, blocks, vault, concepts, undo
      use-signal-store.ts          # Standalone store: pipeline, signals, controls, cortex
      use-ui-store.ts              # Standalone store: sidebar, modal, mini-chat visibility
      use-thread-store.ts          # Standalone store: thread CRUD, per-thread streaming
      events.ts                    # Cross-store typed event bus (unchanged — good)
      hydrate.ts                   # Centralized hydration (unchanged)

    db/
      schema.ts                    # SINGLE schema definition (Drizzle)
      migrations/                  # Drizzle Kit generated migrations
      queries.ts                   # Accept branded types: getChatById(chatId: ChatId)
      notes-queries.ts             # All multi-row ops wrapped in transactions
      index.ts                     # Singleton connection, migrate() on init

    branded.ts                     # Unchanged (phantom brands with factory functions)
    rate-limit.ts                  # Unchanged (sliding window)
    api-middleware.ts              # Simplified: only per-route config, auth in middleware.ts
    api-utils.ts                   # Unchanged (parseBodyWithLimit, createSSEWriter)

    motion/
      motion-config.ts             # THE source of truth — imported by EVERY animated component

  tests/
    unit/                          # Pure function tests
      api-utils.test.ts
      rate-limit.test.ts
      utils.test.ts
      storage-versioning.test.ts
    store/                         # Store tests
      chat-store.test.ts
      notes-store.test.ts
      signal-store.test.ts
      events.test.ts
    api/                           # Route handler tests
      api-routes.test.ts
      pipeline-stages.test.ts
    components/                    # React component tests
      multimodal-input.test.tsx
      messages-list.test.tsx
      chat-landing.test.tsx
    smoke/
      routes.test.ts
    chaos/
      playwright-chaos.mjs

  daemon/                          # SIMPLIFIED: Next.js cron route or setInterval
    tasks/                         # 5 task implementations (unchanged)
    scheduler.ts                   # Simplified: mutex-based serial execution
```

---

## State Architecture

**5 independent stores instead of 1 flat store with 13 slices.**

### useChatStore
```typescript
// Messages, streaming, inference config, attachments
State: {
  messages: ChatMessage[]
  isStreaming: boolean
  streamingText: string
  reasoningText: string
  isProcessing: boolean
  attachments: Attachment[]
  inferenceMode: InferenceMode
  provider: string
  model: string
  apiKey: string  // consider secure storage
  temperature: number
}
```

### useNotesStore
```typescript
// The entire notes domain — irreducible at ~30 state fields
// Extracted from the main store into its own create() call
// Includes: pages, blocks, books, vault, concepts, links, undo/redo
// Persistence: SQLite as source of truth, no localStorage dual-write
```

### useSignalStore
```typescript
// Pipeline stages, signals (derived from LLM output), controls
State: {
  activeStage: string
  stageProgress: number
  stageResults: StageResult[]
  signals: PipelineSignals        // NOW derived from LLM output
  signalHistory: SignalSnapshot[]
  controls: SteeringControls
  cortexSnapshots: CortexSnapshot[]
  concepts: ConceptEntry[]
  conceptWeights: Record<string, number>
}
```

### useUIStore
```typescript
// Truly UI-only: sidebar, modals, chat minimized, theme overrides
State: {
  sidebarOpen: boolean
  chatMinimized: boolean
  miniChatVisible: boolean
  showTruthBot: boolean
  showReasoningPanel: boolean
}
```

### useThreadStore
```typescript
// Thread system extracted from UI slice (was causing re-render pressure)
State: {
  threads: ChatThread[]
  activeThreadId: string
  threadStreamingText: Record<string, string>   // isolated re-renders
  threadIsStreaming: Record<string, boolean>
}
```

### Cross-Store Communication
- **Event bus** (keep `lib/store/events.ts`): `query:submitted`, `query:completed`, `chat:cleared`, `learning:page-created`
- **Toasts**: React Context (ephemeral UI, not app state)
- **Portal**: Component-local `useState` (simple stack, single consumer)

### Removed
- **Tier slice**: Hardcoded constants → plain module export
- **chatMode / researchChatMode**: Dead code → deleted
- **Cortex slice**: 4 actions, 1 state → merged into useSignalStore
- **SOAR slice**: 2 fields, 4 actions → merged into useSignalStore
- **Research slice**: Papers → React Query + SQLite (server-derived data)

---

## Component Hierarchy

```
<RootLayout>                          (SERVER: html, body, fonts)
  <ShellLayout>                       (CLIENT: AppShell, ThemeProvider)
    <Loading />                       (Suspense fallback: PixelBook)
    <Page>
      ├── ChatLanding                 (greeting, features, search, recent)
      │   ├── GreetingTypewriter      (idle escalation phases)
      │   ├── FeatureButtons          (upload, research, lit, hypothesis)
      │   └── RecentChats             (recent chat list)
      │
      ├── ChatConversation            (active chat)
      │   ├── MessagesList            (scrollable, auto-scroll)
      │   │   └── Message             (per-message: content, actions)
      │   │       ├── MessageLayman   (layman view)
      │   │       └── MessageResearch (research view)
      │   ├── ThinkingAccordion       (reasoning expandable)
      │   ├── ThinkingControls        (reroute/pause/stop)
      │   ├── MultimodalInput         (attachments, submit, stop)
      │   └── SteeringFeedback        (thumbs up/down)
      │
      ├── NotesWorkspace              (active note editing)
      │   ├── BlockEditor             (block list, keyboard nav)
      │   │   ├── BlockRenderer       (per-type rendering)
      │   │   ├── SlashMenu           (command palette)
      │   │   └── ContextMenu         (right-click ops)
      │   ├── NotesSidebar            (page tree, search)
      │   └── GraphView               (D3 force graph)
      │
      └── AnalyticsHub                (tab container)
          ├── ArchiveView
          ├── SteeringLabView
          ├── PipelineView
          ├── SignalsView
          └── VisualizerView

    <MiniChatShell>                   (floating panel, always available)
      ├── MiniChatTab                 (per-thread chat)
      ├── MiniChatHistory             (history tab)
      ├── MiniChatNotes               (notes tab)
      └── MiniChatResearch            (research tab)

    <ToastContainer>                  (uses GlassPanel)
    <TopNav>                          (CSS vars, no inline theme functions)
```

---

## Data Layer

### Single Schema Definition (Drizzle)
- `lib/db/schema.ts` is the ONLY schema source of truth
- Raw SQL DDL in `index.ts` replaced with `migrate()` call
- Drizzle Kit manages migration files in `lib/db/migrations/`
- All timestamps use `{ mode: 'timestamp' }` consistently

### Branded Types at DB Boundary
```typescript
// queries.ts
export function getChatById(chatId: ChatId): Promise<Chat | undefined>
export function createMessage(data: { chatId: ChatId; role: Role; content: string }): Promise<MessageId>
export function getMessagesByChatId(chatId: ChatId): Promise<Message[]>
```

### Three Persistence Tiers
1. **SQLite (Drizzle)**: All persistent data — chats, messages, notes, concepts, pipeline runs, cortex archive, steering memory, research papers
2. **localStorage (versioned)**: Only volatile preferences — theme, sidebar state, active vault ID, inference mode, SOAR toggles. Max 5-10 keys, each under 1KB
3. **Zustand (memory)**: Runtime state only — streaming text, UI toggles, active modals

### Transactions Everywhere
- Every multi-row write wrapped in `withTransaction()`
- `syncVaultToDb`: single transaction, batch upserts
- `saveMessage`: atomic insert + timestamp update

### No Dual-Write
- Notes go to SQLite only
- localStorage fallback removed
- If offline support needed: proper offline queue, not shadow copy

---

## API Design

### Route Structure (8 routes, down from 12)
```
POST /api/chat              SSE streaming pipeline
POST /api/assistant          SSE assistant widget
GET  /api/history            Chat history
POST /api/research/[action]  search, review, ideas, novelty, export
POST /api/notes/[action]     ai, learn, sync, migrate
GET  /api/system/[action]    ollama, test-connection, daemon-status
POST /api/system/[action]    daemon-start, daemon-stop
```

### Middleware Layer
```typescript
// middleware.ts (edge runtime)
export function middleware(req: NextRequest) {
  // 1. Rate limiting (same in-memory sliding window)
  // 2. Auth check (crypto.timingSafeEqual for token comparison)
  // 3. Request ID injection (X-Request-ID header)
  // 4. Security headers (CSP, X-Frame-Options)
}

export const config = {
  matcher: ['/api/:path*']
}
```

### Validation
- Zod schemas co-located with each route
- `parseBodyWithLimit` remains (streaming byte counting)
- `createSSEWriter` remains (double-close protection)

### Shared Utilities (single source of truth)
- `isAllowedOllamaUrl` in `lib/engine/llm/provider.ts` only
- `sseEvent` removed → use `writer.event()` consistently
- `normalizePages`/`normalizeBlocks` shared between notes actions

---

## Engine Architecture

### 3-Stage Pipeline (down from 10)

```
Stage 1: QUERY UNDERSTANDING (instant, no LLM)
  - analyzeQuery() — regex classification, entity extraction
  - Follow-up detection via conversation history in prompt
  - Steering directive composition

Stage 2: LLM REASONING (1-2 LLM calls)
  - Call 1: Raw analysis with structured output
    (existing excellent prompts, returns analysis + epistemic tags + self-critique)
  - Call 2 (optional, high-complexity):
    Truth assessment / adversarial review

Stage 3: SIGNAL DERIVATION (instant, post-LLM)
  - Parse [DATA]/[MODEL]/[UNCERTAIN]/[CONFLICT] tags
  - Derive confidence = f(DATA_count, UNCERTAIN_count)
  - Derive dissonance = f(CONFLICT_count, self-critique severity)
  - Extract concepts from analysis text
  - Generate truth assessment from derived signals
```

### SOAR Simplified
- Replace teacher-student-reward loop with conditional second pass
- If analysis has >2 [UNCERTAIN] or >1 [CONFLICT] tags:
  - "Review your analysis. Strengthen weak claims, resolve conflicts."
- Captures 80% of SOAR's value at 1/5th the token cost

### Arbitration Improved
- Instead of one model roleplaying 5 engines:
  - Option A: Multi-model calls (Claude + GPT-4o) with disagreement = real signal
  - Option B: Single prompt with 3-perspective section built into the analysis

### Daemon Simplified
- Next.js cron route with mutex for serial execution
- Same database connection as the app (no separate SQLite instance)
- Drop the standalone HTTP status server

---

## Testing Strategy

### What to Test (prioritized)
1. **Store invariants** — initialization, mutation safety, reset lifecycle, corrupted hydration
2. **API security perimeter** — every route with valid/invalid/malformed input
3. **Pipeline stage output** — each stage produces valid PipelineEvent shape
4. **Critical components** — multimodal-input, messages-list, chat-landing (3-5 render tests)
5. **localStorage migration** — versioned storage roundtrips, corruption handling
6. **Signal derivation** — tag parsing produces correct confidence/entropy from LLM output

### Coverage Targets
- Store tests: 90%+ of store actions
- API routes: 100% of routes covered (valid + error paths)
- Components: 3-5 critical path components
- Overall: 60% floor enforced in CI, aspirational 75%

### CI Pipeline
```yaml
steps:
  - tsc --noEmit          # Type check
  - eslint --max-warnings=0  # Lint (zero tolerance)
  - vitest run            # Unit + integration tests
  - next build            # Build verification
  # Weekly: playwright-chaos.mjs against preview deploy
```

---

## Migration Path

Ordered by **high impact + low risk first**.

| # | Change | Current → Ideal | Effort | Risk | Impact |
|---|--------|----------------|--------|------|--------|
| 1 | Wire tests into CI | build-only → tsc + eslint + vitest + build | 15 min | None | **Critical** — unenforced tests are decoration |
| 2 | Add Prettier | No formatter → default config + one-time format | 10 min | None | **High** — prevents style divergence |
| 3 | Move AppShell to (shell)/layout.tsx | Root client boundary → route-group client boundary | 1 hr | Low | **Foundational** — unlocks RSC, streaming, loading.tsx |
| 4 | Kill dead slices + dead code | tier, chatMode, researchChatMode → deleted | 30 min | None | **Medium** — reduces cognitive noise |
| 5 | Centralize motion constants | 18+ local constants → imports from motion-config.ts | 2 hr | Near-zero | **High** — coherent motion system |
| 6 | Wire branded types to DB queries | `string` params → `ChatId`, `UserId` params | 30 min | Low | **High** — type safety at persistence boundary |
| 7 | Replace raw DDL with Drizzle migrations | Dual schema → single schema + migrate() | 2 hr | Medium | **High** — eliminates schema drift risk |
| 8 | Extract GreetingTypewriter from chat.tsx | Inline 150-line component → separate file | 15 min | None | **Medium** — starts god component decomposition |
| 9 | Kill notes-sidebar t() / top-nav bubbleBg() | 96 hardcoded colors → CSS variables | 1-2 hr | Low | **Medium** — single theme system |
| 10 | Merge markdown.tsx + markdown-content.tsx | 2 markdown renderers → 1 with withAnchors prop | 30 min | None | **Low** — removes confusing duplication |
| 11 | Fix completeProcessing double-write | Direct mutation + event handler both write signalHistory | 30 min | Low | **High** — fixes latent data race |
| 12 | Wrap syncVaultToDb in transaction | 1100+ individual SQL → single transaction | 1 hr | Low | **High** — prevents partial-sync corruption |
| 13 | Extract notes into own store | 1890-line slice in flat store → standalone useNotesStore | 2 hr | Medium | **High** — removes 40% of main store surface |
| 14 | Add loading.tsx + kill useSetupGuard | Per-page loading gates → framework Suspense | 1 hr | Low | **Medium** — removes boilerplate, leverages framework |
| 15 | Decompose mini-chat.tsx | 2,329-line god component → shell + 4 tab components | 3 hr | Medium | **Medium** — maintainability |
| 16 | Decompose block-editor.tsx | 2,251-line god component → editor + slash + context + renderer | 3 hr | Medium | **Medium** — maintainability |
| 17 | Derive signals from LLM output | Regex-based query signals → tag-ratio signals | 4 hr | Medium | **High** — makes confidence meaningful |
| 18 | Collapse pipeline to 3 stages | 10 theatrical stages → 3 real stages | 4 hr | Medium | **Medium** — honest architecture |
| 19 | Add middleware.ts | Per-route withMiddleware → edge middleware | 1 hr | Low | **Medium** — removes boilerplate |
| 20 | Write DEVELOPMENT.md | No onboarding docs → setup + architecture + conventions | 2 hr | None | **High** — team readiness |

**Phase 1 (Week 1, ~8 hours)**: Items 1-6 + 8 + 10 + 11 + 20 — zero-risk foundation fixes
**Phase 2 (Week 2, ~10 hours)**: Items 7 + 9 + 12-14 + 19 — structural reinforcement
**Phase 3 (Week 3-4, ~14 hours)**: Items 15-18 — component and engine architecture
