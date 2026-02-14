/**
 * Route Integration Tests — Verify Every Page Loads
 *
 * Forge Production Audit, Phase 2 (Dynamic Analysis), Task 5
 *
 * These tests verify that every page route module can be imported
 * without crashing and exports a default React component (function).
 * We do NOT render components — just verify module-level integrity.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Mock next/navigation — used by many route pages
// ---------------------------------------------------------------------------
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({ id: 'test-chat-id' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  useSelectedLayoutSegment: () => null,
  useSelectedLayoutSegments: () => [],
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock next/dynamic — returns a stub component
// ---------------------------------------------------------------------------
vi.mock('next/dynamic', () => ({
  default: () => {
    const Stub = () => null;
    Stub.displayName = 'DynamicStub';
    return Stub;
  },
}));

// ---------------------------------------------------------------------------
// Mock next-themes — used by onboarding and settings
// ---------------------------------------------------------------------------
vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'system',
    setTheme: vi.fn(),
    resolvedTheme: 'dark',
    themes: ['light', 'dark', 'system'],
  }),
}));

// ---------------------------------------------------------------------------
// Mock better-sqlite3 — server-only module, crashes in browser env
// ---------------------------------------------------------------------------
vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => ({
    pragma: vi.fn(),
    exec: vi.fn(),
    prepare: vi.fn(() => ({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(() => []),
    })),
    close: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Route definitions: path to module, grouped by section
// ---------------------------------------------------------------------------
const ROUTES = {
  chat: {
    'Main chat page — app/(chat)/page.tsx':
      '@/app/(chat)/page',
    'Individual chat page — app/(chat)/chat/[id]/page.tsx':
      '@/app/(chat)/chat/[id]/page',
  },
  features: {
    'Pipeline viewer — app/pipeline/page.tsx':
      '@/app/pipeline/page',
    'Steering lab — app/steering-lab/page.tsx':
      '@/app/steering-lab/page',
    'Analytics — app/analytics/page.tsx':
      '@/app/analytics/page',
    'Notes — app/notes/page.tsx':
      '@/app/notes/page',
    'Concept atlas — app/concept-atlas/page.tsx':
      '@/app/concept-atlas/page',
    'Cortex archive — app/cortex-archive/page.tsx':
      '@/app/cortex-archive/page',
    'Library — app/library/page.tsx':
      '@/app/library/page',
    'Research copilot — app/research-copilot/page.tsx':
      '@/app/research-copilot/page',
    'Visualizer — app/visualizer/page.tsx':
      '@/app/visualizer/page',
  },
  tools: {
    'Export — app/export/page.tsx':
      '@/app/export/page',
    'Diagnostics — app/diagnostics/page.tsx':
      '@/app/diagnostics/page',
    'Daemon — app/daemon/page.tsx':
      '@/app/daemon/page',
  },
  misc: {
    'Onboarding — app/onboarding/page.tsx':
      '@/app/onboarding/page',
    'Docs — app/docs/page.tsx':
      '@/app/docs/page',
    'Settings — app/settings/page.tsx':
      '@/app/settings/page',
  },
} as const;

// ---------------------------------------------------------------------------
// Helper: dynamically import a route module and validate its default export
// ---------------------------------------------------------------------------
async function assertRouteExportsDefaultComponent(modulePath: string) {
  const mod = await import(modulePath);
  expect(mod).toBeDefined();
  expect(mod.default).toBeDefined();
  expect(typeof mod.default).toBe('function');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Route Integration Tests — Verify Every Page Loads', () => {
  describe('Chat routes', () => {
    for (const [label, modulePath] of Object.entries(ROUTES.chat)) {
      it(`imports and exports default component: ${label}`, async () => {
        await assertRouteExportsDefaultComponent(modulePath);
      });
    }
  });

  describe('Feature routes', () => {
    for (const [label, modulePath] of Object.entries(ROUTES.features)) {
      it(`imports and exports default component: ${label}`, async () => {
        await assertRouteExportsDefaultComponent(modulePath);
      });
    }
  });

  describe('Tool routes', () => {
    for (const [label, modulePath] of Object.entries(ROUTES.tools)) {
      it(`imports and exports default component: ${label}`, async () => {
        await assertRouteExportsDefaultComponent(modulePath);
      });
    }
  });

  describe('Miscellaneous routes', () => {
    for (const [label, modulePath] of Object.entries(ROUTES.misc)) {
      it(`imports and exports default component: ${label}`, async () => {
        await assertRouteExportsDefaultComponent(modulePath);
      });
    }
  });
});
