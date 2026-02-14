# Forge Production Audit — AAA Polish Pass

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Deep audit and harden the entire pfc-app codebase for production release — fix broken things, optimize conflicts, remove clutter, add stability tests, and prepare for desktop/mobile adaptation.

**Architecture:** Next.js 16 + React 19 + Zustand + SQLite (Drizzle) + Vercel AI SDK. 195+ source files across 23 pages, 11 API routes, 62 components, 6 hooks, 65+ lib modules. This audit follows the Forge Three-Pass Protocol adapted from AAA game development polish phases.

**Tech Stack:** TypeScript strict, Tailwind CSS v4, Framer Motion, Radix UI, D3, Vitest

---

## Phase 1: STATIC ANALYSIS — The Compiler's Eye

### Task 1: TypeScript Strict Audit + Fix All Type Warnings

**Files:**
- Audit: ALL `.ts` and `.tsx` files
- Focus: `lib/db/index.ts` (line 229 `as any`), `daemon/shell-layer.ts` (line 136 `as unknown`), `app/research-copilot/page.tsx` (lines 430, 565), `app/(chat)/api/research/[action]/route.ts` (line 343), `lib/engine/file-processor.ts` (line 177)

**Steps:**
1. Run `npx tsc --noEmit 2>&1` and capture all warnings/errors
2. Fix every `as any` cast — replace with proper typed interfaces or generics
3. Fix every `as unknown` cast — add proper type narrowing
4. Ensure zero type errors remain
5. Run build to verify: `npx next build`

**Acceptance:** `tsc --noEmit` exits with 0 errors, 0 warnings

---

### Task 2: ESLint Cleanup — Resolve or Document Every Disable

**Files:**
- `hooks/use-typewriter.ts` (line 98)
- `lib/db/index.ts` (lines 224, 228)
- `components/app-shell.tsx` (line 124)
- `components/chat.tsx` (lines 328, 1010)
- `app/visualizer/page.tsx` (lines 726, 809, 1285, 1317, 1346)
- `app/daemon/page.tsx` (lines 229, 253, 259)
- `app/settings/page.tsx` (lines 193, 198, 252, 263, 268)
- `components/notes/block-editor.tsx` (lines 828, 859)
- `components/notes/note-ai-chat.tsx` (line 211)
- `components/concept-mini-map.tsx` (line 76)

**Steps:**
1. For each `eslint-disable` comment, determine if the disable is genuinely needed
2. If the dependency can be added safely, add it and remove the disable
3. If the disable is genuinely needed (e.g., intentional non-reactive ref), add a `// SAFETY:` comment explaining WHY
4. Remove any disable that masks a real bug
5. Run `npx next lint` and verify zero warnings

**Acceptance:** All disables documented with SAFETY comments, or removed. `next lint` clean.

---

### Task 3: Create Debug Logger — Replace All console.* Statements

**Files:**
- Create: `lib/debug-logger.ts`
- Modify: 20+ files with console.log/warn/error (see audit list)

**Steps:**
1. Create `lib/debug-logger.ts` with environment-gated logging:
```typescript
const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  debug: (label: string, ...args: unknown[]) => { if (isDev) console.debug(`[${label}]`, ...args); },
  info: (label: string, ...args: unknown[]) => { if (isDev) console.log(`[${label}]`, ...args); },
  warn: (label: string, ...args: unknown[]) => { console.warn(`[${label}]`, ...args); },
  error: (label: string, ...args: unknown[]) => { console.error(`[${label}]`, ...args); },
};
```
2. Replace ALL `console.log` with `logger.info` or `logger.debug`
3. Replace ALL `console.warn` with `logger.warn`
4. Replace ALL `console.error` with `logger.error`
5. Keep `logger.error` for genuine error handlers (those are fine in prod)
6. Verify no raw `console.` calls remain (except in debug-logger.ts itself)

**Acceptance:** `grep -r "console\.\(log\|warn\|error\)" --include="*.ts" --include="*.tsx" | grep -v debug-logger | grep -v node_modules` returns 0 results (excluding the logger itself and error-boundary which legitimately needs console.error).

---

### Task 4: Dead Code Removal — TODO/FIXME/HACK Cleanup

**Files:** All source files

**Steps:**
1. Search for all TODO, FIXME, HACK, XXX, TEMP comments
2. For each one: either resolve it (implement the missing piece) or remove it with a comment explaining the decision
3. Remove any commented-out code blocks (dead code)
4. Remove any unused exports or functions
5. Verify build still passes

**Acceptance:** Zero unresolved TODO/FIXME/HACK/XXX comments. No commented-out code blocks.

---

## Phase 2: DYNAMIC ANALYSIS — The Crash Hunter

### Task 5: Write Route Integration Tests — Verify Every Page Loads

**Files:**
- Create: `tests/routes.test.ts`

**Steps:**
1. Write tests that verify every page route renders without crashing
2. Test all 15 feature pages + chat routes
3. Use a lightweight approach — verify the route module exports properly and key components render
4. Test the dynamic route `/chat/[id]` with mock params
5. Run and verify all pass

**Test structure:**
```typescript
import { describe, it, expect } from 'vitest';

describe('Route modules', () => {
  it('all page routes export default components', async () => {
    const routes = [
      './app/(chat)/page',
      './app/analytics/page',
      './app/concept-atlas/page',
      // ... all routes
    ];
    for (const route of routes) {
      const mod = await import(route);
      expect(mod.default).toBeDefined();
    }
  });
});
```

**Acceptance:** All route tests pass. Every page can at minimum be imported without error.

---

### Task 6: Write API Route Tests — Verify Every Endpoint Handles Edge Cases

**Files:**
- Create: `tests/api-routes.test.ts`

**Steps:**
1. Test each API route handler with:
   - Valid input → expected response shape
   - Empty/missing body → 400 error response
   - Malformed JSON → graceful error
   - Missing required fields → validation error
2. Focus on: `/api/chat`, `/api/history`, `/api/research/[action]`, `/api/synthesis`, `/api/assistant`
3. Mock the database and LLM calls
4. Verify error responses have consistent shape: `{ error: string }`

**Acceptance:** All API route tests pass. Every endpoint handles malformed input without crashing.

---

### Task 7: Write Store Integrity Tests — State Never Corrupts

**Files:**
- Create: `tests/store-integrity.test.ts`

**Steps:**
1. Test that the main Zustand store initializes with valid defaults
2. Test that every state mutation function produces valid state
3. Test rapid sequential mutations (e.g., add 100 messages then clear)
4. Test that store hydration from localStorage handles corrupted data gracefully
5. Test that store resets cleanly without leaking previous state

**Acceptance:** All store tests pass. Store never enters an invalid state.

---

### Task 8: Write Engine Pipeline Tests — Every Stage Produces Valid Output

**Files:**
- Create: `tests/pipeline-stages.test.ts`
- Focus: `lib/engine/simulate.ts`

**Steps:**
1. Test the simulation pipeline with various query types
2. Verify each of the 10 stages produces properly typed output
3. Test with edge case queries: empty string, very long string (10K chars), unicode, only whitespace
4. Test that signals remain within valid bounds (0-1 range) after each stage
5. Test the SSE event stream produces events in correct order

**Acceptance:** All pipeline tests pass. No stage produces invalid output for any input.

---

## Phase 3: HARDENING — Stability & Performance

### Task 9: Add Error Boundaries to Every Page Route

**Files:**
- Modify: All page routes that don't have error boundaries
- Reference: `components/error-boundary.tsx`

**Steps:**
1. Audit every page component — check which ones are wrapped in error boundaries
2. Add `<ErrorBoundary>` wrapping to any page that's missing it
3. Ensure error boundaries show a user-friendly fallback, not a blank page
4. Test that a thrown error in a child component is caught and displayed gracefully

**Acceptance:** Every page route has an error boundary. No uncaught errors can crash the entire app.

---

### Task 10: localStorage Schema Versioning

**Files:**
- Create: `lib/storage-versioning.ts`
- Modify: All files that read from localStorage

**Steps:**
1. Create a versioning wrapper for localStorage:
```typescript
interface VersionedData<T> { version: number; data: T; }
export function readVersioned<T>(key: string, currentVersion: number, migrate?: (old: unknown) => T): T | null;
export function writeVersioned<T>(key: string, version: number, data: T): void;
```
2. Add version numbers to all localStorage keys
3. Add migration functions for each key that handle old formats
4. Test that loading data from a previous version migrates correctly
5. Test that corrupted data returns null gracefully (never crashes)

**Acceptance:** All localStorage reads go through the versioning wrapper. Corrupted data never causes a crash.

---

### Task 11: Optimize Bundle — Lazy Load Heavy Pages

**Files:**
- Audit: All page routes for their import weight
- Focus: Pages importing D3, heavy components, or large libraries

**Steps:**
1. Check which pages already use `next/dynamic` with `{ ssr: false }`
2. Add dynamic imports for any heavy page that doesn't have them:
   - `concept-atlas` (D3 force graph)
   - `visualizer` (D3 + canvas)
   - `notes` (block editor)
   - `research-copilot` (multiple tools)
3. Verify code splitting is working: check `.next/static` chunk sizes
4. Add `loading` fallback components for dynamically imported pages

**Acceptance:** No page loads more than 200KB of JS on initial render. Heavy pages are code-split.

---

### Task 12: Performance Audit — Eliminate Unnecessary Re-renders

**Files:**
- Focus: Components using `usePFCStore` with broad selectors
- Focus: Components missing `memo()` wrapping

**Steps:**
1. Audit all Zustand selectors — ensure they select the minimum needed state
2. Look for components that subscribe to the entire store (anti-pattern)
3. Add `memo()` to any component rendered in a list (message items, note blocks, etc.)
4. Verify that typing in the chat input doesn't re-render the message list
5. Check that switching themes doesn't cause excessive re-renders

**Acceptance:** No unnecessary re-renders detected. Chat input typing is smooth 60fps.

---

## Phase 4: POLISH — The Artisan's Eye

### Task 13: Consistent Error Response Format Across All API Routes

**Files:**
- All API route handlers in `app/api/` and `app/(chat)/api/`

**Steps:**
1. Define a standard error response type:
```typescript
type ApiErrorResponse = { error: string; code?: string; details?: unknown; };
```
2. Audit every API route's catch block
3. Ensure all return the same shape: `NextResponse.json({ error: message }, { status: code })`
4. Add appropriate HTTP status codes (400 for bad input, 404 for not found, 500 for internal)
5. Never expose internal error messages to the client (sanitize them)

**Acceptance:** Every API route returns consistent error shapes. No internal details leaked.

---

### Task 14: Accessibility Pass — Keyboard Navigation & ARIA

**Files:**
- Focus: Interactive components (buttons, inputs, modals, collapsibles)
- Focus: `components/multimodal-input.tsx`, `components/chat.tsx`, `components/portal-sidebar.tsx`

**Steps:**
1. Verify all interactive elements are keyboard-accessible (Tab, Enter, Escape)
2. Add `aria-label` to icon-only buttons
3. Verify focus management in modals/dialogs (focus trap)
4. Check color contrast ratios for all theme variants
5. Test screen reader announcements for dynamic content (streaming responses)

**Acceptance:** All interactive elements keyboard-accessible. No unlabeled buttons. Focus management works in overlays.

---

### Task 15: Security Headers & Input Validation Audit

**Files:**
- `next.config.ts` (existing headers)
- All API routes (input validation)
- `middleware.ts` if exists

**Steps:**
1. Verify security headers are comprehensive (already partially done in next.config.ts)
2. Add CSP (Content-Security-Policy) header
3. Audit all API routes for input validation — ensure all user input is validated with Zod before use
4. Check that file upload paths can't escape the uploads directory (path traversal)
5. Verify API keys are never logged or exposed in responses

**Acceptance:** All security headers in place. All API inputs validated. No path traversal possible.

---

## Phase 5: FINAL VERIFICATION

### Task 16: Full Test Suite Run + Build Verification

**Steps:**
1. Run `npx vitest run` — ALL tests must pass
2. Run `npx next build` — zero errors, zero warnings
3. Run `npx tsc --noEmit` — zero type errors
4. Run `npx next lint` — zero lint warnings
5. Manual smoke test: start the app, send a chat message, verify streaming works
6. Verify all 15 feature pages load without errors

**Acceptance:** All green. Zero warnings across all tools. App functions correctly end-to-end.

---

## Task Dependency Graph

```
Phase 1 (Static Analysis):
  Task 1 (types) ──┐
  Task 2 (eslint) ─┤── Can run in parallel
  Task 3 (logger) ─┤
  Task 4 (dead code)┘

Phase 2 (Dynamic Analysis) — depends on Phase 1:
  Task 5 (route tests) ──┐
  Task 6 (API tests) ────┤── Can run in parallel
  Task 7 (store tests) ──┤
  Task 8 (pipeline tests)┘

Phase 3 (Hardening) — depends on Phase 2:
  Task 9 (error boundaries) ─┐
  Task 10 (localStorage) ────┤── Can run in parallel
  Task 11 (bundle optimize) ─┤
  Task 12 (re-renders) ──────┘

Phase 4 (Polish) — depends on Phase 3:
  Task 13 (API errors) ──┐
  Task 14 (a11y) ────────┤── Can run in parallel
  Task 15 (security) ────┘

Phase 5 (Verification) — depends on ALL above:
  Task 16 (final verification)
```

---

## Success Criteria (The Forge Final Gate)

```
1. Does it build with ZERO warnings?              □
2. Do ALL tests pass (existing + new)?            □
3. Have I tried to crash it and failed?           □
4. Are all error messages helpful?                □
5. Did I remove all TODO/FIXME/HACK comments?     □
6. Is every eslint-disable documented?            □
7. Are all API inputs validated?                  □
8. Is every page wrapped in an error boundary?    □
9. No console.log in production?                  □
10. All localStorage reads handle corruption?     □
```
