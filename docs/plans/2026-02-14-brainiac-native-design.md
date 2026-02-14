# Brainiac Native — macOS App Design Document

> Full SwiftUI + Swift backend rebuild of the brainiac-2.0 TypeScript app.
> Target: macOS App Store. Built via a Claude Code conversion skill.

---

## 1. Vision

Brainiac is a **meta-analytical reasoning engine** — a research writing hub where you never need another app. It combines deep chat-based reasoning, a block-based notes system, autonomous research agents, and an immersive writing environment into a single, minimal, native macOS experience.

**Three words for the UI: Light. Spacious. Quiet.**

---

## 2. Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Platform | macOS (App Store) | Native distribution, Keychain, iCloud, windowing |
| Language | Swift + SwiftUI | Truly native. Not Electron, not Tauri, not WKWebView |
| Backend | Swift (new) | TypeScript codebase as reference spec, not ported |
| Build method | Claude Code skill (`brainiac-native`) | Reproducible, phased, context-safe across sessions |
| Database | GRDB.swift (SQLite) | Best Swift SQLite wrapper, WAL mode, migrations |
| State | @Observable + @Environment | Native SwiftUI reactivity, replaces Zustand |
| AI SDK | Direct HTTP (URLSession) | No Swift equivalent of Vercel AI SDK |
| LLM access | Both API + Local (Ollama) | User chooses per task |
| Audio | AVFoundation | Native macOS audio for ambience + frequency tones |
| Windowing | SwiftUI WindowGroup | Native multi-window, any panel detaches |
| Sync | iCloud Drive folder or local folder | No custom backend, vault is a folder of .md + .db |
| Agent FS access | Security-Scoped Bookmarks | Full file system via user-granted folder access |

---

## 3. Feature Set

### F1: Ambience Engine
- Each visual theme pairs with an ambient audio track
- Genres: jazz, classical, ambient synth, nostalgic plugg, deep focus, silence
- Crossfade on theme switch (2s transition)
- Gapless looping via AVAudioPlayer
- Volume: system + app slider
- Respects macOS Focus modes / Do Not Disturb

### F2: Deep Writer Mode
Two sub-modes within the Writer feature:

**Library Mode (Ulysses-style):**
- Three-pane: Groups → Sheets → Editor
- Markdown-first, plain text .md files in the vault
- Word count, reading time in status bar
- Drag-and-drop sheet organization

**Focus Mode (iA Writer-style):**
- Active paragraph highlighted, rest at 30% opacity
- Typewriter scrolling (active line at vertical center)
- Zero UI chrome — just text + cursor + ambience
- Esc to exit focus mode

Both modes read/write vault files — research notes and writing coexist.

### F3: Agent System
Background autonomous agents that research, write, synthesize, or analyze.

**Architecture:**
```
AgentService (Swift Actor)
├── AgentQueue — serial lifecycle management
├── Agent — individual task runner
│   ├── type: research | write | synthesize | analyze
│   ├── llmProvider: .api(provider) | .local(ollama)
│   ├── tools: [.webBrowse, .fileRead, .fileWrite, .noteCreate]
│   ├── status: .queued | .running | .paused | .completed | .failed
│   └── output: [AgentArtifact]
├── WebBrowseCapability — URLSession + HTML→text
├── FileCapability — Security-scoped FS access
└── NoteCapability — Direct vault write via GRDB
```

**Flow:** New Agent → pick type → natural language instruction → pick LLM → runs in background → results appear as notes/files.

LLM backends:
- API: Anthropic (Claude), OpenAI (GPT), Google (Gemini)
- Local: Ollama at localhost:11434

### F4: Modular Windowing
Any panel can detach into its own macOS window:
```swift
WindowGroup("Chat", id: "chat") { ChatView() }
WindowGroup("Notes", id: "notes") { NotesView() }
WindowGroup("Agent", id: "agent") { AgentListView() }
WindowGroup("Mini Chat", id: "mini-chat") { MiniChatView() }
```
Pop-out button (minimal icon, top-right). Windows share AppState for live sync.

### F5: Breathe Mode (Anti-Burnout)
Mandatory pause intervals. User must select during onboarding: 30m, 1h, or 2h.

**Sequence:**
1. Screen fades to black (3s)
2. Frequency tone begins (432Hz default, adjustable)
3. Typewriter text:
   - "Hey." (2s pause)
   - "Slow down." (2s pause)
   - "Count to 10 with me." (count 1-10)
   - "How do you feel right now?" (5s pause)
   - "Be kind to yourself." (3s pause)
4. Screen fades back in (3s)

- No skip, no escape — the app enforces rest
- Total duration: ~45 seconds
- Ambient music pauses during breathe, resumes after
- Cmd+Shift+B to trigger manually

### F6: iCloud Vault Sync
The vault is a folder of .md files + brainiac.db:

**Mode A — iCloud container:**
```
~/Library/Mobile Documents/iCloud~com.brainiac.app/Documents/
```
macOS handles sync automatically.

**Mode B — User-selected folder:**
Any folder via Security-Scoped Bookmark. If user picks their iCloud Drive folder, sync "just works" via macOS.

SQLite DB lives inside the vault folder. Vault is portable — move it anywhere.

---

## 4. Swift App Architecture

### Project Structure
```
Brainiac/
├── Brainiac.xcodeproj
├── Brainiac/
│   ├── BrainiacApp.swift              # @main, WindowGroup, MenuBarExtra
│   │
│   ├── Models/                         # Data layer
│   │   ├── Schema.swift                # GRDB table definitions
│   │   ├── Chat.swift                  # Chat, Message
│   │   ├── Note.swift                  # Page, Block, Vault
│   │   ├── Concept.swift               # Concept graph
│   │   └── Migrations.swift            # DB version migrations
│   │
│   ├── Services/                       # Business logic
│   │   ├── LLMService.swift            # API + Ollama LLM client
│   │   ├── AgentService.swift          # Agent orchestration
│   │   ├── PipelineService.swift       # Reasoning pipeline
│   │   ├── SOARService.swift           # Self-optimizing reasoning
│   │   ├── ResearchService.swift       # Research library + web
│   │   ├── AmbienceService.swift       # Audio engine
│   │   ├── BreatheService.swift        # Pause timer + meditation
│   │   ├── SyncService.swift           # iCloud / local sync
│   │   └── FileSystemService.swift     # Security-scoped access
│   │
│   ├── State/                          # @Observable state
│   │   ├── AppState.swift              # Root observable
│   │   ├── ChatState.swift             # Messages, streaming
│   │   ├── NotesState.swift            # Vault, pages, blocks
│   │   ├── InferenceState.swift        # Mode, keys (Keychain)
│   │   ├── AgentState.swift            # Running agents
│   │   └── UIState.swift               # Theme, sidebar, panels
│   │
│   ├── Views/                          # SwiftUI views
│   │   ├── Shell/                      # AppShell, Sidebar, TopBar
│   │   ├── Chat/                       # ChatView, MessageBubble, ChatInput
│   │   ├── Writer/                     # WriterView, ParagraphFocus, Library
│   │   ├── Notes/                      # NotesView, BlockEditor, Sidebar
│   │   ├── Agents/                     # AgentList, AgentDetail, NewAgent
│   │   ├── Breathe/                    # BreatheOverlay
│   │   ├── Settings/                   # SettingsView (native)
│   │   └── Shared/                     # MinimalButton, GlassPanel, TypewriterText
│   │
│   ├── Theme/
│   │   ├── BrainiacTheme.swift         # Colors, typography, spacing
│   │   ├── Ambience.swift              # Theme → track mapping
│   │   └── MotionConfig.swift          # Spring presets
│   │
│   └── Resources/
│       ├── Audio/                      # Ambient loops (m4a)
│       ├── Fonts/                      # Custom typefaces
│       └── Assets.xcassets             # App icon, colors
│
├── BrainiacTests/
└── scripts/                            # Build, sign, notarize
```

### TypeScript → Swift Mapping

| TypeScript | Swift Equivalent |
|-----------|-----------------|
| Zustand store (13 slices) | @Observable model objects in @Environment |
| Event bus (emit/on) | NotificationCenter or Combine publishers |
| React components (.tsx) | SwiftUI Views (.swift) |
| API routes (app/api/) | Direct function calls on Services |
| Framer Motion | SwiftUI .animation(), .matchedGeometryEffect |
| better-sqlite3 | GRDB.swift |
| Drizzle ORM | GRDB record types + migrations |
| localStorage | UserDefaults (non-sensitive), Keychain (API keys) |
| CSS Tailwind | SwiftUI modifiers + BrainiacTheme |
| next-themes | @AppStorage("theme") + system appearance |
| proxy.ts (edge auth) | Not needed — no server, direct function calls |
| daemon/ | Background Swift Actors with Task scheduling |

### Line Count Target
- Current TypeScript: ~15,000 LOC
- Target Swift: ~8,000-10,000 LOC (~35-40% reduction)
- Reduction from: declarative SwiftUI, no API layer, native state, no bundler config

---

## 5. UI Design Principles

### Visual Language
- **No borders** — spacing and subtle backgrounds, never lines
- **Muted palette** — pastels, translucency, never saturated colors
- **Native blur** — .ultraThinMaterial for panels (frosted glass)
- **Small metadata** — .caption size for secondary info, .body for content
- **Generous padding** — 16pt minimum everywhere
- **Monochromatic icons** — SF Symbols, weight: .light or .regular

### Animation Standards
- **Default spring:** `.spring(duration: 0.35, bounce: 0.15)`
- **Entrance:** `.transition(.opacity.combined(with: .scale(0.97)))`
- **Text changes:** `.contentTransition(.numericText())`
- **View morphing:** `.matchedGeometryEffect(id:in:)`
- **No linear easing** — everything uses springs
- **No bounce > 0.3** — subtle, not playful

### Reference Apps (feel targets)
- Claude iOS — minimal buttons, spacious, "feels like air"
- Apple Notes — clean editor, sidebar
- ChatGPT — smooth streaming text, light input bar
- iA Writer — focus mode typography

---

## 6. Conversion Skill Design

### Skill: `brainiac-native`

```
brainiac-native/
├── skill.md                    # Orchestrator entry point
├── phases/
│   ├── 00-analyze.md           # Deep TS→Swift architecture mapping
│   ├── 01-foundation.md        # Xcode project, SPM, GRDB, iCloud
│   ├── 02-engine.md            # Pipeline, SOAR, agents, LLM client
│   ├── 03-core-ui.md           # Shell, nav, theming, modular windows
│   ├── 04-port-features.md     # Chat, Notes, Analytics (existing)
│   ├── 05-new-features.md      # Ambience, Writer, Agents, Breathe
│   └── 06-polish.md            # Animations, a11y, perf, App Store
└── mappings/
    ├── ts-to-swift.md          # Type/pattern reference
    ├── component-map.md        # React→SwiftUI view mapping
    └── api-map.md              # Route→service mapping
```

### Phase Gates
Each phase must pass before the next begins:
- **Compile gate:** `xcodebuild build` succeeds with 0 errors
- **Test gate:** all tests pass
- **Review gate:** agent output is meta-read and verified
- **No cross-phase conflicts:** each phase has explicit file ownership

### Agent Safety Rules (encoded in skill)
1. One agent per isolated task — no overlapping file scopes
2. Every agent task specifies exact target directory
3. Agent output is read and verified before committing
4. Compile check after every agent completes
5. If compile fails, the agent's work is reverted before continuing

---

## 7. Security & App Store Compliance

### Sandboxing
- App Sandbox: ON (required for App Store)
- Network: outgoing (API calls to LLM providers + web browse)
- File system: Security-Scoped Bookmarks for user folders
- Keychain: API keys stored in app-scoped Keychain

### Privacy
- No telemetry, no analytics, no tracking
- All data local or in user's iCloud
- Privacy manifest declares: no data collection
- Camera/microphone: not used

### Entitlements
```xml
com.apple.security.app-sandbox: true
com.apple.security.network.client: true
com.apple.security.files.user-selected.read-write: true
com.apple.security.files.bookmarks.app-scope: true
com.apple.security.keychain-access-groups: [com.brainiac.app]
```

---

## 8. What Stays, What's New, What's Cut

### Ported from TypeScript (reimagined in Swift)
- Chat interface + streaming
- Notes system (vault, pages, blocks)
- Concept atlas (force-directed graph)
- 10-stage reasoning pipeline
- SOAR engine
- Steering vectors
- Settings (inference mode, API keys, appearance)
- Onboarding flow
- Research library

### New for Native
- F1: Ambience Engine
- F2: Deep Writer Mode
- F3: Agent System (web browse, FS access, background tasks)
- F4: Modular Windowing
- F5: Breathe Mode
- F6: iCloud Vault Sync

### Cut (not needed in native)
- API routes (no server — direct function calls)
- proxy.ts / middleware (no edge runtime)
- Rate limiting (no HTTP endpoints)
- Daemon as separate process (replaced by Swift Actors)
- CSS/Tailwind (replaced by SwiftUI modifiers)
- Framer Motion (replaced by native animations)
- All bundler/build config (Next.js, PostCSS, etc.)
