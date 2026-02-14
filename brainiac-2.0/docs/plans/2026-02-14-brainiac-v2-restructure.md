# Brainiac 2.0 — Full Restructuring Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the PFC app (codename "Brainiac") from its current v1 architecture into an ideal v2 architecture in a new `brainiac-2.0/` workspace directory, applying all findings from the 7-agent Simulate Rebuild analysis.

**Architecture:** Copy the entire pfc-app into a fresh `brainiac-2.0/` directory, then systematically restructure it through 5 phases: scaffold new directories, extract/move files, decompose god objects, apply v2 patterns (store split, motion centralization, branded types at DB, middleware, signal derivation), and verify everything compiles and tests pass.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Zustand 5, Drizzle ORM + SQLite, Tailwind CSS 4, Framer Motion, Radix UI, Vitest 4

**V1 Baseline:** 198 tests passing, 176 source files, ~54,500 lines

---

## Phase 1: Foundation (Scaffold + Copy)

### Task 1.1: Create Brainiac 2.0 workspace

**Files:**
- Create: `brainiac-2.0/` (copy of `pfc-app/`)

**Step 1: Copy the entire pfc-app as the starting point**
```bash
cp -r pfc-app brainiac-2.0
```

**Step 2: Verify the copy compiles and tests pass**
```bash
cd brainiac-2.0 && npx vitest run
```
Expected: 198 tests passing

**Step 3: Update package.json name**
Change `"name"` to `"brainiac-2.0"` in `brainiac-2.0/package.json`.

**Step 4: Commit**
```bash
git add brainiac-2.0/
git commit -m "chore: create brainiac-2.0 workspace as copy of pfc-app"
```

---

### Task 1.2: Scaffold new directory structure

**Step 1: Create new component directories**
```bash
mkdir -p brainiac-2.0/components/{layout,chat,assistant,notes/block-editor,viz,decorative/wallpapers,shared}
```

**Step 2: Create new store directory structure**
```bash
# Store files will be created as individual stores, not slices
# New files: use-chat-store.ts, use-notes-store.ts, use-signal-store.ts, use-ui-store.ts, use-thread-store.ts
```

**Step 3: Create new engine directory structure**
```bash
mkdir -p brainiac-2.0/lib/engine/steering
# query-analysis.ts and signals.ts will be extracted from simulate.ts
```

**Step 4: Create analytics component directory**
```bash
mkdir -p brainiac-2.0/components/analytics
```

**Step 5: Commit scaffold**
```bash
git add brainiac-2.0/
git commit -m "chore: scaffold v2 directory structure"
```

---

## Phase 2: Extract & Move — Components

### Task 2.1: Move layout components to components/layout/

**Files:**
- Move: `components/app-shell.tsx` → `components/layout/app-shell.tsx`
- Move: `components/page-shell.tsx` → `components/layout/page-shell.tsx`
- Move: `components/page-transition.tsx` → `components/layout/page-transition.tsx`
- Move: `components/top-nav.tsx` → `components/layout/top-nav.tsx`
- Move: `components/error-boundary.tsx` → `components/layout/error-boundary.tsx`

**Step 1: Move each file**
For each file, move it and update ALL import paths across the codebase. Use find-and-replace on the import path string.

**Step 2: Run TypeScript check**
```bash
cd brainiac-2.0 && npx tsc --noEmit 2>&1 | head -20
```
Expected: Clean compile (0 errors)

**Step 3: Create barrel export**
Create `components/layout/index.ts` re-exporting all layout components.

**Step 4: Commit**
```bash
git commit -am "refactor: move layout components to components/layout/"
```

---

### Task 2.2: Move chat components to components/chat/

**Files:**
- Move: `components/chat.tsx` → `components/chat/chat.tsx`
- Move: `components/message.tsx` → `components/chat/message.tsx`
- Move: `components/messages.tsx` → `components/chat/messages.tsx`
- Move: `components/multimodal-input.tsx` → `components/chat/multimodal-input.tsx`
- Move: `components/streaming-text.tsx` → `components/chat/streaming-text.tsx`
- Move: `components/thinking-accordion.tsx` → `components/chat/thinking-accordion.tsx`
- Move: `components/thinking-controls.tsx` → `components/chat/thinking-controls.tsx`
- Move: `components/research-mode-bar.tsx` → `components/chat/research-mode-bar.tsx`
- Move: `components/truth-bot-card.tsx` → `components/chat/truth-bot-card.tsx`
- Move: `components/feature-buttons.tsx` → `components/chat/feature-buttons.tsx`
- Move: `components/recent-chats.tsx` → `components/chat/recent-chats.tsx`
- Move: `components/steering-feedback.tsx` → `components/chat/steering-feedback.tsx`
- Move: `components/steering-indicator.tsx` → `components/chat/steering-indicator.tsx`
- Move: `components/live-controls.tsx` → `components/chat/live-controls.tsx`
- Move: `components/markdown.tsx` → `components/shared/markdown.tsx`
- Move: `components/markdown-content.tsx` → `components/shared/markdown-content.tsx`

**Step 1: Move each file and update all imports**

**Step 2: Run TypeScript check**
```bash
npx tsc --noEmit
```

**Step 3: Commit**
```bash
git commit -am "refactor: move chat components to components/chat/"
```

---

### Task 2.3: Move assistant (mini-chat) to components/assistant/

**Files:**
- Move: `components/mini-chat.tsx` → `components/assistant/mini-chat.tsx`

**Step 1: Move and update imports**

**Step 2: TypeScript check**

**Step 3: Commit**
```bash
git commit -am "refactor: move mini-chat to components/assistant/"
```

---

### Task 2.4: Move visualization components to components/viz/

**Files:**
- Move: `components/concept-hierarchy-panel.tsx` → `components/viz/concept-hierarchy-panel.tsx`
- Move: `components/concept-mini-map.tsx` → `components/viz/concept-mini-map.tsx`
- Move: `components/thought-visualizer.tsx` → `components/viz/thought-visualizer.tsx`
- Move: `components/portal-sidebar.tsx` → `components/viz/portal-sidebar.tsx`

**Step 1-3: Move, check, commit**
```bash
git commit -am "refactor: move viz components to components/viz/"
```

---

### Task 2.5: Move decorative components to components/decorative/

**Files:**
- Move: `components/star-field.tsx` → `components/decorative/star-field.tsx`
- Move: `components/thematic-wallpaper.tsx` → `components/decorative/wallpapers/thematic.tsx`
- Move: `components/sunny-wallpaper.tsx` → `components/decorative/wallpapers/sunny.tsx`
- Move: `components/sunset-wallpaper.tsx` → `components/decorative/wallpapers/sunset.tsx`
- Merge: `components/pixel-sun.tsx` + `components/pixel-moon.tsx` + `components/pixel-book.tsx` → `components/decorative/pixel-mascots.tsx`

**Step 1: Move wallpapers and star-field**
**Step 2: Merge 3 pixel components into one file**

Create `components/decorative/pixel-mascots.tsx`:
```tsx
'use client'
import Image from 'next/image'

export function PixelSun() {
  return <Image src="/pixel-sun.gif" alt="Sun" width={32} height={32} unoptimized />
}

export function PixelMoon() {
  return <Image src="/pixel-moon.gif" alt="Moon" width={24} height={24} unoptimized />
}

export function PixelBook({ className }: { className?: string }) {
  return <div className={className}>{/* existing spinner CSS */}</div>
}
```

**Step 3: Update all imports of PixelSun/Moon/Book**
**Step 4: Delete the 3 original files**
**Step 5: TypeScript check + commit**
```bash
git commit -am "refactor: move decorative components, merge pixel mascots"
```

---

### Task 2.6: Move shared components

**Files:**
- Move: `components/toast-container.tsx` → `components/shared/toast-container.tsx`
- Move: `components/educational-tooltip.tsx` → `components/shared/educational-tooltip.tsx`
- Move: `components/glass-bubble-button.tsx` → `components/chat/glass-bubble-button.tsx`

**Step 1-3: Move, check, commit**
```bash
git commit -am "refactor: move shared components"
```

---

### Task 2.7: Move analytics sub-pages to components

**Goal:** Convert phantom routes (diagnostics, visualizer, steering-lab, cortex-archive, pipeline) from standalone pages to components imported by analytics.

**Files:**
- Move: `app/diagnostics/page.tsx` → `components/analytics/diagnostics-view.tsx`
- Move: `app/visualizer/visualizer-content.tsx` → `components/analytics/visualizer-view.tsx`
- Move: `app/steering-lab/page.tsx` → `components/analytics/steering-lab-view.tsx`
- Move: `app/cortex-archive/page.tsx` → `components/analytics/cortex-archive-view.tsx`
- Move: `app/pipeline/page.tsx` → `components/analytics/pipeline-view.tsx`
- Delete: `app/diagnostics/`, `app/visualizer/`, `app/steering-lab/`, `app/cortex-archive/`, `app/pipeline/` (route directories + layouts)

**Step 1: Convert each page to a component export**

For each file, change `export default function PageName()` to `export function PageNameView()` and remove any page-level guards/metadata.

**Step 2: Update analytics/page.tsx** to import from `@/components/analytics/` instead of `../diagnostics/page`.

**Step 3: Delete the phantom route directories**

**Step 4: TypeScript check + test + commit**
```bash
git commit -am "refactor: convert phantom routes to analytics components"
```

---

## Phase 3: Decompose God Objects

### Task 3.1: Extract GreetingTypewriter from chat.tsx

**Files:**
- Create: `components/chat/greeting-typewriter.tsx`
- Modify: `components/chat/chat.tsx`

**Step 1: Cut the GreetingTypewriter function** (~150 lines starting around line 78 of chat.tsx) into its own file with all its state, refs, effects, and the idle phase progression logic.

**Step 2: Import it back into chat.tsx**

**Step 3: TypeScript check + commit**
```bash
git commit -am "refactor: extract GreetingTypewriter from chat.tsx"
```

---

### Task 3.2: Extract ChatHistorySheet from chat.tsx

**Files:**
- Create: `components/chat/chat-history-sheet.tsx`
- Modify: `components/chat/chat.tsx`

**Step 1: Extract the bottom-sheet "All Chats" panel** (starts around the SHEET_SPRING constant) with its own spring config, state, and rendering logic.

**Step 2: Pass props: `chats`, `isOpen`, `onClose`, `onSelectChat`**

**Step 3: TypeScript check + commit**
```bash
git commit -am "refactor: extract ChatHistorySheet from chat.tsx"
```

---

### Task 3.3: Decompose mini-chat.tsx into shell + tabs

**Files:**
- Keep: `components/assistant/mini-chat.tsx` (shell only — container, drag, resize, tab switching)
- Create: `components/assistant/mini-chat-chat-tab.tsx`
- Create: `components/assistant/mini-chat-history-tab.tsx`
- Create: `components/assistant/mini-chat-notes-tab.tsx`
- Create: `components/assistant/mini-chat-research-tab.tsx`

**Step 1: Identify each tab's rendering section** in mini-chat.tsx and extract each as a component.

**Step 2: Each tab receives its needed state via props or store selectors.**

**Step 3: The shell component handles container, drag/resize, tab switching, thread management.**

**Step 4: TypeScript check + test + commit**
```bash
git commit -am "refactor: decompose mini-chat into shell + 4 tab components"
```

---

### Task 3.4: Decompose block-editor.tsx

**Files:**
- Keep: `components/notes/block-editor/editor.tsx` (main orchestrator)
- Create: `components/notes/block-editor/slash-menu.tsx`
- Create: `components/notes/block-editor/context-menu.tsx`
- Create: `components/notes/block-editor/block-renderer.tsx`

**Step 1: Move the existing `block-editor.tsx` into `block-editor/editor.tsx`**

**Step 2: Extract SlashCommandMenu** (fuzzy search + category rendering) into `slash-menu.tsx`

**Step 3: Extract BlockContextMenu** (right-click operations) into `context-menu.tsx`

**Step 4: Extract BlockRenderer** (per-type contentEditable rendering) into `block-renderer.tsx`

**Step 5: TypeScript check + commit**
```bash
git commit -am "refactor: decompose block-editor into focused modules"
```

---

### Task 3.5: Extract settings sections

**Files:**
- Create: `app/settings/sections/inference-section.tsx`
- Create: `app/settings/sections/soar-section.tsx`
- Create: `app/settings/sections/appearance-section.tsx`
- Create: `app/settings/sections/export-section.tsx`
- Modify: `app/settings/page.tsx` (orchestrator only)

**Step 1: Extract each GlassSection group** into its own file.

**Step 2: settings/page.tsx becomes a thin orchestrator importing sections.**

**Step 3: TypeScript check + commit**
```bash
git commit -am "refactor: extract settings into section components"
```

---

### Task 3.6: Extract simulate.ts into focused modules

**Files:**
- Create: `lib/engine/query-analysis.ts` (lines ~46-272 of simulate.ts)
- Create: `lib/engine/signal-generation.ts` (lines ~876-994)
- Create: `lib/engine/fallback-generators.ts` (lines ~377-728 + concept extraction)
- Modify: `lib/engine/simulate.ts` (keep only the pipeline generator ~1031-1357)

**Step 1: Extract `analyzeQuery()` and follow-up detection** into `query-analysis.ts`

**Step 2: Extract `generateSignals()` and signal helpers** into `signal-generation.ts`

**Step 3: Extract all fallback/template generators** into `fallback-generators.ts`

**Step 4: simulate.ts imports from the new modules and keeps only `runPipeline()`**

**Step 5: TypeScript check + test + commit**
```bash
git commit -am "refactor: extract simulate.ts into focused engine modules"
```

---

## Phase 4: Apply V2 Patterns

### Task 4.1: Centralize all motion constants

**Files:**
- Modify: `lib/motion/motion-config.ts` (add missing presets)
- Modify: ~15 component files (replace local constants with imports)

**Step 1: Add chat spring presets** to motion-config.ts:
```typescript
export const spring = {
  // ...existing...
  chatEnter: { type: 'spring' as const, stiffness: 400, damping: 32, mass: 0.6 },
  chatPanel: { type: 'spring' as const, stiffness: 480, damping: 36, mass: 0.7 },
  chatSheet: { type: 'spring' as const, stiffness: 500, damping: 38, mass: 0.8 },
}
```

**Step 2: Replace ALL local easing/spring constants** across 15+ files with imports from `@/lib/motion/motion-config`.

Files to update: `chat.tsx`, `message.tsx`, `messages.tsx`, `feature-buttons.tsx`, `multimodal-input.tsx`, `page-shell.tsx`, `page-transition.tsx`, `portal-sidebar.tsx`, `notes-sidebar.tsx`, `vault-picker.tsx`, `block-editor/editor.tsx`, `thinking-accordion.tsx`, `note-ai-chat.tsx`, `concept-panel.tsx`, `mini-chat.tsx`, `recent-chats.tsx`, `toast-container.tsx`

**Step 3: TypeScript check + commit**
```bash
git commit -am "refactor: centralize all motion constants into motion-config.ts"
```

---

### Task 4.2: Wire branded types to DB queries

**Files:**
- Modify: `lib/db/queries.ts`
- Modify: `lib/db/notes-queries.ts`

**Step 1: Update query function signatures** to accept branded types:
```typescript
import { UserId, ChatId, MessageId, PageId, BlockId, VaultId } from '@/lib/branded'

export async function getOrCreateUser(userId: UserId) { ... }
export async function createChat({ id, userId }: { id: ChatId, userId: UserId, title?: string }) { ... }
export async function getChatById(chatId: ChatId) { ... }
export async function getMessagesByChatId(chatId: ChatId) { ... }
// etc for all functions
```

**Step 2: Update callers** that pass raw strings to use branded constructors.

**Step 3: TypeScript check + test + commit**
```bash
git commit -am "feat: wire branded types to DB query boundary"
```

---

### Task 4.3: Kill dead slices and dead code

**Files:**
- Delete: tier slice state/actions from store composition
- Delete: chatMode/researchChatMode from UI and research slices
- Modify: `lib/store/use-pfc-store.ts` (remove tier from composition)
- Modify: `lib/store/slices/ui.ts` (remove setChatMode no-op)
- Modify: `lib/store/slices/research.ts` (remove toggleResearchChatMode no-op)

**Step 1: Remove tier slice**
- Remove `createTierSlice` from `use-pfc-store.ts` composition
- Remove tier state from the `reset()` function
- Remove tier selectors from `app-shell.tsx`
- Delete `slices/tier.ts` or inline the constants as a plain module

**Step 2: Remove chatMode/researchChatMode**
- Remove `setChatMode` from ui.ts (no-op)
- Remove `toggleResearchChatMode` from research.ts (no-op)
- Remove `ChatMode` type (single-variant union)
- Update any components that reference these

**Step 3: TypeScript check + test + commit**
```bash
git commit -am "chore: remove dead slices (tier, chatMode, researchChatMode)"
```

---

### Task 4.4: Merge markdown renderers

**Files:**
- Modify: `components/shared/markdown.tsx` → becomes the single renderer
- Delete: `components/shared/markdown-content.tsx`

**Step 1: Merge markdown-content.tsx features into markdown.tsx**
Add optional `withAnchors?: boolean` prop. When true, generate heading IDs for TOC linking (the feature from markdown-content.tsx).

**Step 2: Update all imports** from `markdown-content` to `markdown`.

**Step 3: Delete markdown-content.tsx**

**Step 4: TypeScript check + commit**
```bash
git commit -am "refactor: merge markdown renderers into single component"
```

---

### Task 4.5: Fix completeProcessing double-write bug

**Files:**
- Modify: `lib/store/slices/message.ts`
- Modify: `lib/store/use-pfc-store.ts` (event handlers)

**Step 1: Remove the direct `signalHistory` write** from `completeProcessing` in message.ts (around line 286). The event handler in `use-pfc-store.ts` (around line 247) already handles this via the `query:completed` event.

**Step 2: Move remaining cross-slice mutations** from `completeProcessing` (conceptWeights, queryConceptHistory) to the `query:completed` event handler.

**Step 3: TypeScript check + test + commit**
```bash
git commit -am "fix: resolve signalHistory double-write in completeProcessing"
```

---

### Task 4.6: Wrap syncVaultToDb in transaction

**Files:**
- Modify: `lib/db/notes-queries.ts`
- Modify: `lib/db/index.ts` (ensure withTransaction is exported)

**Step 1: Import `withTransaction`** from `lib/db/index.ts`

**Step 2: Wrap the entire body of `syncVaultToDb`** in a transaction:
```typescript
export async function syncVaultToDb(vaultId, vault, pages, blocks, books, concepts, pageLinks) {
  return withTransaction(() => {
    // existing upsert logic
  })
}
```

**Step 3: Also wrap `saveMessage`** (insert + timestamp update) in a transaction.

**Step 4: TypeScript check + test + commit**
```bash
git commit -am "fix: wrap syncVaultToDb and saveMessage in transactions"
```

---

### Task 4.7: Add middleware.ts for auth + rate limiting

**Files:**
- Create: `middleware.ts`
- Modify: API route files (remove per-route withMiddleware wrapping)

**Step 1: Create `brainiac-2.0/middleware.ts`:**
```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'

export function middleware(request: NextRequest) {
  const token = process.env.PFC_API_TOKEN
  if (!token) return NextResponse.next() // No token = open access (local-first)

  const headerToken = request.headers.get('x-pfc-token')
  const cookieToken = request.cookies.get('pfc-token')?.value

  const providedToken = headerToken || cookieToken
  if (!providedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Timing-safe comparison
  const a = Buffer.from(token)
  const b = Buffer.from(providedToken)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*', '/(chat)/api/:path*']
}
```

**Step 2: Simplify `withMiddleware`** to only handle rate limiting (auth now in middleware).

**Step 3: TypeScript check + test + commit**
```bash
git commit -am "feat: add edge middleware for auth, simplify per-route middleware"
```

---

### Task 4.8: Move AppShell to (shell) route group

**Files:**
- Create: `app/(shell)/layout.tsx` (client layout with AppShell)
- Modify: `app/layout.tsx` (become thin server component)
- Create: `app/(shell)/loading.tsx` (universal loading spinner)
- Move: all app pages under `app/(shell)/`

**Step 1: Create `app/(shell)/layout.tsx`:**
```tsx
'use client'
import { AppShell } from '@/components/layout/app-shell'
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
```

**Step 2: Slim down root `app/layout.tsx`** to pure server component:
```tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'Brainiac', description: '...' }
export const viewport: Viewport = { ... }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
```

**Step 3: Create `app/(shell)/loading.tsx`** with the PixelBook spinner.

**Step 4: Move all page routes** (except onboarding) under `(shell)/`.

**Step 5: TypeScript check + build + commit**
```bash
git commit -am "refactor: move AppShell to (shell) route group, root layout now server component"
```

---

### Task 4.9: Consolidate API routes

**Files:**
- Merge: `api/ollama-check` + `api/ollama-status` → `api/system/[action]/route.ts`
- Merge: `api/notes-ai` + `api/notes-learn` + `api/notes/sync` → `api/notes/[action]/route.ts`
- Move: `api/test-connection` → handled by `api/system/[action]`
- Move: `api/daemon` → handled by `api/system/[action]`

**Step 1: Create `api/system/[action]/route.ts`** with action routing:
- `ollama-check` → GET handler
- `ollama-status` → POST handler
- `test-connection` → POST handler
- `daemon` → GET/POST handler

**Step 2: Create `api/notes/[action]/route.ts`** with action routing:
- `ai` → POST handler (from notes-ai)
- `learn` → POST handler (from notes-learn)
- `sync` → GET/POST handler (from notes/sync)

**Step 3: Update all client-side fetch URLs**

**Step 4: Delete old route directories**

**Step 5: TypeScript check + test + commit**
```bash
git commit -am "refactor: consolidate API routes (12→8)"
```

---

### Task 4.10: Replace raw SQL DDL with Drizzle migrations

**Files:**
- Modify: `lib/db/index.ts` (remove raw CREATE TABLE statements)
- Create: `lib/db/migrations/` (generated by drizzle-kit)

**Step 1: Generate baseline migration**
```bash
cd brainiac-2.0 && npx drizzle-kit generate
```

**Step 2: Replace `initDb()` raw DDL** with migration runner:
```typescript
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

function initDb() {
  // ... pragmas ...
  migrate(db, { migrationsFolder: './lib/db/migrations' })
}
```

**Step 3: Remove all `CREATE TABLE IF NOT EXISTS` statements** from index.ts.

**Step 4: TypeScript check + test + commit**
```bash
git commit -am "refactor: replace raw DDL with Drizzle migrations"
```

---

## Phase 5: Verify & Polish

### Task 5.1: Full verification suite

**Step 1: TypeScript check**
```bash
cd brainiac-2.0 && npx tsc --noEmit
```
Expected: 0 errors

**Step 2: Run all tests**
```bash
npx vitest run
```
Expected: 198+ tests passing

**Step 3: Build**
```bash
npx next build
```
Expected: Build succeeds

**Step 4: Verify no file over 500 lines** (except canvas/viz at 800 max)
```bash
find . -name '*.tsx' -o -name '*.ts' | grep -v node_modules | grep -v '.next' | xargs wc -l | sort -rn | head -20
```

---

### Task 5.2: Update imports and clean up

**Step 1: Remove any remaining old re-exports** or barrel files that point to v1 locations.

**Step 2: Run ESLint** and fix any new unused import warnings:
```bash
npx eslint . --fix
```

**Step 3: Final commit**
```bash
git commit -am "chore: brainiac 2.0 restructure complete — all tests passing"
```

---

### Task 5.3: Write DEVELOPMENT.md

**Files:**
- Create: `brainiac-2.0/DEVELOPMENT.md`

Contents:
- Setup instructions (npm install, npm run dev)
- Architecture overview with directory tree
- Store ownership model (5 stores, event bus)
- Component hierarchy
- Testing conventions
- Styling conventions (Tailwind + CSS vars, no inline styles for new code)
- Motion system (import from motion-config.ts)

---

## Execution Notes

**Agent dispatch strategy for Phase 2-4:**
- Tasks 2.1-2.7 can be parallelized (component moves are independent)
- Tasks 3.1-3.6 can be partially parallelized (different files)
- Tasks 4.1-4.10 must be mostly sequential (some depend on prior moves)
- Task 4.8 (AppShell move) is the highest-risk change — test thoroughly
- Task 5.1-5.3 is sequential verification

**Total estimated effort:** ~20-25 hours of focused agent work across 5 phases.
