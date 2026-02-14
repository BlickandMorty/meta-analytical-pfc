# Simulate Rebuild — Design Document

> *"The best way to understand a system is to mentally rebuild it from scratch."*

## Overview

A Claude Code skill that mentally rebuilds the entire PFC app from scratch using 7 parallel domain agents, each reimagining their layer through three philosophical lenses. Produces a deep synthesis of what went right/wrong plus an ideal v2 architecture specification.

**Name:** `simulate-rebuild`
**Type:** User-invocable skill (`/simulate-rebuild`)
**Output:** Read-only analysis documents (never modifies code)
**Location:** `~/.claude/skills/simulate-rebuild/SKILL.md`

---

## Core Concept

The skill dispatches 7 domain-specialized agents in parallel ("The War Room"). Each agent deeply reads their domain of the codebase, then mentally reconstructs it — not just finding bugs, but asking "if I were building this today with everything I now know, what would I do differently and why?"

Every agent carries three philosophical lenses (the Approach 3 hybrid):
- **The Minimalist** — what's the simplest version that achieves the same goal?
- **The Purist** — what does the framework/community actually recommend?
- **The Street-Smart Pragmatist** — what do experienced devs actually do that isn't in docs? What social/community conventions exist? What are the 80/20 changes?

A final synthesis agent merges all 7 reports, finding cross-cutting tensions and emergent themes.

---

## The 7 War Room Agents

| # | Agent | Domain | Key Files |
|---|-------|--------|-----------|
| 1 | Architect | App structure, routing, file org, build config | `next.config.ts`, `app/` layout tree, `package.json`, `tsconfig.json` |
| 2 | State Oracle | Zustand store, 13 slices, cross-slice patterns, hydration, persistence | `lib/store/`, `lib/store/slices/`, `lib/store/events.ts`, `lib/store/hydrate.ts` |
| 3 | UI Surgeon | Component hierarchy, styling, animations, accessibility, design system | `components/`, `app/globals.css`, `components/ui/`, `hooks/` |
| 4 | Data Artisan | DB schema, queries, migrations, caching, localStorage | `lib/db/`, `drizzle.config.ts`, `lib/storage-versioning.ts`, `lib/branded.ts` |
| 5 | API Sentinel | Routes, middleware, streaming, error handling, auth | `app/api/`, `app/(chat)/api/`, `lib/api-middleware.ts`, `lib/rate-limit.ts` |
| 6 | Engine Whisperer | Pipeline, SOAR, steering, research extraction, LLM orchestration | `lib/engine/`, `lib/research/`, `daemon/` |
| 7 | DX Guardian | Testing, types, dev tooling, debugging, CI readiness | `tests/`, `vitest.config.ts`, `lib/branded.ts`, `tsconfig.json` |

### Per-Agent Report Structure

Each agent produces a report with these sections:
1. **What went right** — patterns worth keeping
2. **What went wrong** — anti-patterns, accumulated debt, framework misuse
3. **The minimalist take** — what could be removed entirely?
4. **The purist take** — what does the framework/community actually recommend?
5. **The street-smart take** — what do experienced devs do that isn't in any docs?
6. **Ideal reimagined version** — "if I rebuilt this domain today..."
7. **Priority transformations** — ranked list (high/medium/low impact)

---

## Synthesis Agent

After all 7 domain agents complete, a synthesis agent reads all reports and produces the final two-part output. It specifically looks for:
- **Contradictions** between domain reports
- **Emergent themes** that appear in 3+ reports
- **The highest-leverage single change** — if you could only do one thing

---

## Output Structure

### Part 1: Deep Synthesis (`docs/simulate-rebuild/synthesis.md`)

- Executive Summary (1 paragraph)
- What Went Right — grouped by theme, not domain
- What Went Wrong — grouped by severity (architectural > structural > cosmetic), with WHY not just WHAT
- Cross-Cutting Tensions — where two domains fight each other
- The Three Lenses (Minimalist / Purist / Street-Smart summaries)
- Lessons for Next Time — concrete "if I were starting over" rules

### Part 2: v2 Architecture Spec (`docs/simulate-rebuild/v2-architecture.md`)

- Design Philosophy (3-5 principles)
- Project Structure (ideal file tree)
- State Architecture (reimagined store shape)
- Component Hierarchy (ideal component tree)
- Data Layer (ideal schema + persistence)
- API Design (ideal route structure + patterns)
- Engine Architecture (ideal pipeline + modularity)
- Testing Strategy (what to test, how, coverage targets)
- Migration Path (current -> ideal, effort estimate, risk, ordered by high impact + low risk first)

---

## Execution Flow

```
/simulate-rebuild
      │
      ▼
Phase 0: ORIENT
  - Read MEMORY.md, CLAUDE.md, docs/
  - Read recent git log (last 30 commits)
  - Announce start
      │
      ▼
Phase 1: WAR ROOM (7 agents in parallel)
  - Each reads deeply into their domain
  - Each applies 3 philosophical lenses
  - PFC-tuned: knows Next.js, Zustand, SQLite, Drizzle, Tailwind, Framer Motion
  - Each writes domain report
      │ (all 7 complete)
      ▼
Phase 2: SYNTHESIS
  - Read all 7 domain reports
  - Find cross-cutting tensions
  - Identify emergent themes (3+ reports)
  - Determine highest-leverage single change
  - Write Part 1: Deep Synthesis
  - Write Part 2: v2 Architecture Spec
      │
      ▼
Phase 3: DELIVER
  - Save to docs/simulate-rebuild/
  - Print executive summary to user
  - Print top 5 highest-leverage changes
  - Ask: "Want me to dig into any domain?"
```

---

## Constraints

- **Read-only** — never modifies code, only produces analysis
- **PFC-tuned** — agents know Next.js app router, Zustand flat store, SQLite WAL, Tailwind 4, Framer Motion
- **User-invocable** — triggered by `/simulate-rebuild`
- **Timestamped output** — `docs/simulate-rebuild/YYYY-MM-DD/` if run multiple times

---

## Success Criteria

1. Each of the 7 agents produces a report with all 7 sections filled
2. The synthesis identifies at least 3 cross-cutting tensions
3. The v2 architecture spec is concrete enough to actually follow as a rebuild blueprint
4. The migration path is ordered by impact/risk ratio
5. Total execution completes within ~5 minutes
