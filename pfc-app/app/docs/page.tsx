'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpenIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  BrainCircuitIcon,
  NetworkIcon,
  CalculatorIcon,
  LayersIcon,
  RocketIcon,
  WrenchIcon,
  AlertTriangleIcon,
  SparklesIcon,
  TerminalIcon,
  type LucideIcon,
} from 'lucide-react';
import { PageShell, GlassSection } from '@/components/page-shell';

/* ═══════════════════════════════════════════════════════════
   Collapsible Section
   ═══════════════════════════════════════════════════════════ */

function DocSection({
  icon: Icon,
  iconColor,
  title,
  defaultOpen = false,
  children,
  isDark,
}: {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  isDark: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        borderRadius: '1rem',
        overflow: 'hidden',
        background: isDark ? 'rgba(244,189,111,0.03)' : 'rgba(0,0,0,0.02)',
        border: isDark ? '1px solid rgba(79,69,57,0.3)' : '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          width: '100%',
          padding: '1.125rem 1.5rem',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'inherit',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '2.5rem',
            width: '2.5rem',
            borderRadius: '9999px',
            flexShrink: 0,
            background: isDark ? 'rgba(244,189,111,0.06)' : 'rgba(0,0,0,0.04)',
          }}
        >
          <Icon style={{ height: '1.25rem', width: '1.25rem', color: iconColor }} />
        </div>
        <span
          style={{
            flex: 1,
            fontSize: '1.0625rem',
            fontWeight: 650,
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </span>
        {open ? (
          <ChevronDownIcon style={{ height: '1rem', width: '1rem', opacity: 0.3 }} />
        ) : (
          <ChevronRightIcon style={{ height: '1rem', width: '1rem', opacity: 0.3 }} />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden', transformOrigin: 'top', transform: 'translateZ(0)' }}
          >
            <div
              style={{
                padding: '0 1.5rem 1.5rem',
                fontSize: '0.9375rem',
                lineHeight: 1.75,
                color: isDark ? 'rgba(237,224,212,0.7)' : 'rgba(0,0,0,0.6)',
              }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Inline code helper
   ═══════════════════════════════════════════════════════════ */

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: 'ui-monospace, "SF Mono", monospace',
        fontSize: '0.8125rem',
        padding: '0.175rem 0.4375rem',
        borderRadius: '0.375rem',
        background: 'rgba(244,189,111,0.1)',
        color: '#C4956A',
      }}
    >
      {children}
    </code>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: '0.9375rem',
        fontWeight: 650,
        letterSpacing: '-0.01em',
        marginTop: '1.5rem',
        marginBottom: '0.625rem',
        color: 'inherit',
        opacity: 0.85,
      }}
    >
      {children}
    </h3>
  );
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul style={{ paddingLeft: '1.25rem', margin: '0.5rem 0' }}>{children}</ul>;
}

function Li({ children }: { children: React.ReactNode }) {
  return <li style={{ marginBottom: '0.35rem' }}>{children}</li>;
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      style={{
        fontFamily: 'ui-monospace, "SF Mono", monospace',
        fontSize: '0.8125rem',
        lineHeight: 1.65,
        padding: '1rem 1.25rem',
        borderRadius: '0.75rem',
        background: 'rgba(0,0,0,0.3)',
        color: 'rgba(237,224,212,0.8)',
        overflowX: 'auto',
        margin: '0.75rem 0',
      }}
    >
      {children}
    </pre>
  );
}

/* ═══════════════════════════════════════════════════════════
   Docs Page
   ═══════════════════════════════════════════════════════════ */

export default function DocsPage() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? (resolvedTheme === 'dark' || resolvedTheme === 'oled') : true;

  return (
    <PageShell
      icon={BookOpenIcon}
      iconColor="#8B7CF6"
      title="Documentation"
      subtitle="Everything you need to know about PFC"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* ── About PFC ── */}
        <DocSection icon={BrainCircuitIcon} iconColor="#8B7CF6" title="About PFC" defaultOpen isDark={isDark}>
          <p>
            <strong>PFC (Prefrontal Cortex)</strong> is a meta-analytical reasoning engine that stress-tests
            claims through a rigorous 10-stage pipeline. It draws inspiration from how the human prefrontal
            cortex evaluates information — weighing evidence, detecting contradictions, calibrating confidence,
            and synthesizing conclusions.
          </p>
          <Heading>The Problem</Heading>
          <p>
            Most AI chatbots give you a single answer with no transparency into how that answer was reached.
            There is no way to audit the reasoning, no adversarial stress-testing, no Bayesian calibration,
            and no separation between statistical evidence and causal claims. PFC solves this by making the
            entire reasoning process visible, auditable, and tunable.
          </p>
          <Heading>The Core Thesis</Heading>
          <p>
            Every claim deserves to be examined through multiple analytical lenses before a conclusion is
            reached. PFC applies statistical analysis, causal inference, meta-analysis, Bayesian updating,
            adversarial review, and confidence calibration — in sequence — to produce a transparent,
            well-calibrated answer.
          </p>
        </DocSection>

        {/* ── The 10-Stage Pipeline ── */}
        <DocSection icon={NetworkIcon} iconColor="#C15F3C" title="The 10-Stage Pipeline" isDark={isDark}>
          <p>
            Every query passes through a 10-stage executive reasoning protocol. Each stage has a specific
            analytical purpose and produces measurable outputs.
          </p>
          <Heading>Stage 1: Triage</Heading>
          <p>Classifies query complexity and domain. Determines which downstream stages need emphasis.</p>
          <Heading>Stage 2: Memory Retrieval</Heading>
          <p>Retrieves relevant context from prior analyses and the current session&apos;s concept graph.</p>
          <Heading>Stage 3: Pathway Routing</Heading>
          <p>Selects optimal analytical pathways based on domain, complexity, and available evidence.</p>
          <Heading>Stage 4: Statistical Analysis</Heading>
          <p>Runs frequentist statistical tests — p-values, effect sizes, confidence intervals, power analysis.</p>
          <Heading>Stage 5: Causal Inference</Heading>
          <p>Evaluates causal relationships using DAGs (directed acyclic graphs), Bradford Hill criteria, and counterfactual reasoning.</p>
          <Heading>Stage 6: Meta-Analysis</Heading>
          <p>Aggregates multi-study evidence with heterogeneity assessment, forest plot logic, and publication bias detection.</p>
          <Heading>Stage 7: Bayesian Updating</Heading>
          <p>Starts with prior beliefs and updates them with new evidence to form posteriors. Uses conjugate priors and credible intervals.</p>
          <Heading>Stage 8: Synthesis</Heading>
          <p>Combines outputs from all analytical stages into a coherent narrative with explicit trade-offs and confidence levels.</p>
          <Heading>Stage 9: Adversarial Review</Heading>
          <p>Stress-tests the synthesis — devil&apos;s advocate arguments, edge cases, failure modes, and steel-man counterarguments.</p>
          <Heading>Stage 10: Confidence Calibration</Heading>
          <p>Final calibration of confidence intervals. Adjusts for overconfidence, base rates, and reference class forecasting.</p>
        </DocSection>

        {/* ── Mathematical Foundations ── */}
        <DocSection icon={CalculatorIcon} iconColor="#22D3EE" title="Mathematical Foundations" isDark={isDark}>
          <Heading>Signal System</Heading>
          <p>PFC tracks five core signals in real time:</p>
          <Ul>
            <Li><strong>Confidence</strong> (0–1): How certain the engine is in the current synthesis. Computed from evidence strength, replication, and calibration.</Li>
            <Li><strong>Entropy</strong> (0–1): Information-theoretic measure of disagreement across analytical stages. High entropy = stages disagree.</Li>
            <Li><strong>Dissonance</strong> (0–1): Degree of internal contradiction in the evidence. Different from entropy — dissonance means evidence actively conflicts.</Li>
            <Li><strong>Health Score</strong> (0–1): Overall system health combining signal stability, concept coherence, and pipeline completion.</Li>
            <Li><strong>Safety State</strong> (green/yellow/orange/red): Traffic light indicator derived from all signals.</Li>
          </Ul>

          <Heading>Topological Data Analysis (TDA)</Heading>
          <p>
            PFC uses persistent homology to analyze the shape of the concept space:
          </p>
          <Ul>
            <Li><strong>Betti-0 (B0)</strong>: Number of connected components. High B0 means fragmented reasoning.</Li>
            <Li><strong>Betti-1 (B1)</strong>: Number of loops/cycles in the concept graph. Indicates circular reasoning or feedback loops.</Li>
            <Li><strong>Persistence Entropy</strong>: How spread out the topological features are. Low = dominated by one structure. High = many features of similar importance.</Li>
            <Li><strong>Max Persistence</strong>: The longest-lived topological feature. Indicates the most robust structural pattern.</Li>
          </Ul>

          <Heading>Bayesian Updating</Heading>
          <p>The engine maintains Bayesian priors over 14+ dimensions and updates them with each analysis:</p>
          <CodeBlock>{`P(θ|data) ∝ P(data|θ) × P(θ)
posterior ∝ likelihood × prior

Each dimension tracks:
  - mean (center of belief)
  - variance (uncertainty)
  - sampleCount (evidence accumulation)`}</CodeBlock>

          <Heading>Concept Chord Harmony</Heading>
          <p>
            Concepts are assigned weights and their product forms a &quot;chord&quot; — analogous to musical
            harmony. The chord product and key distance measure how well the active concepts fit together.
            Low key distance = harmonious, coherent reasoning.
          </p>

          <Heading>Steering Engine</Heading>
          <p>
            The adaptive steering system learns from each analysis outcome. It maintains a memory of exemplars
            (past analyses + outcomes), projects them into a PCA space, and computes a steering bias vector
            that nudges future analyses toward better outcomes.
          </p>
        </DocSection>

        {/* ── The Stack ── */}
        <DocSection icon={LayersIcon} iconColor="#4ADE80" title="The Stack" isDark={isDark}>
          <Heading>Frontend</Heading>
          <Ul>
            <Li><strong>Next.js 15</strong> — App Router, server components, API routes</Li>
            <Li><strong>TypeScript</strong> — Full type safety across the entire codebase</Li>
            <Li><strong>Framer Motion</strong> — Physics-based animations (spring, Cupertino easing)</Li>
            <Li><strong>Tailwind CSS v4</strong> — Utility-first styling with custom design tokens</Li>
            <Li><strong>Canvas API</strong> — Code rain animation, concept atlas force graph</Li>
            <Li><strong>next-themes</strong> — System-aware dark/light mode</Li>
          </Ul>

          <Heading>State Management</Heading>
          <Ul>
            <Li><strong>Zustand</strong> — Lightweight store for all app state (signals, concepts, pipeline, settings)</Li>
            <Li><strong>Steering Store</strong> — Separate Zustand store for the adaptive steering memory</Li>
            <Li><strong>localStorage</strong> — Persistence for settings, API keys, steering memory, cortex snapshots</Li>
          </Ul>

          <Heading>Inference</Heading>
          <Ul>
            <Li><strong>Simulation Mode</strong> — Built-in engine that simulates all 10 pipeline stages locally</Li>
            <Li><strong>API Mode</strong> — Connect to OpenAI (GPT-4o) or Anthropic (Claude) for real LLM inference</Li>
            <Li><strong>Local Mode</strong> — Ollama integration for fully local, private inference</Li>
          </Ul>

          <Heading>Design System</Heading>
          <Ul>
            <Li><strong>Liquid Glass</strong> — Frosted glass aesthetic with backdrop blur and subtle borders</Li>
            <Li><strong>OLED Dark Mode</strong> — True black background for OLED displays</Li>
            <Li><strong>Custom Fonts</strong> — Ubuntu Bold for headings, FuntasiLear for input</Li>
            <Li><strong>Code Rain</strong> — AI/data science code tokens falling with syntax highlighting</Li>
          </Ul>
        </DocSection>

        {/* ── What Makes It Novel ── */}
        <DocSection icon={SparklesIcon} iconColor="#FACC15" title="What Makes PFC Novel" isDark={isDark}>
          <p>PFC is fundamentally different from standard AI chat wrappers:</p>
          <Heading>Transparent Reasoning Pipeline</Heading>
          <p>
            Every answer shows exactly which analytical stages ran, what each stage found, and where
            disagreements exist. You can audit every step of the reasoning process.
          </p>
          <Heading>Multi-Lens Analysis</Heading>
          <p>
            Claims are examined through statistical, causal, Bayesian, meta-analytical, and adversarial
            lenses. No single methodology dominates — the engine synthesizes across all of them.
          </p>
          <Heading>Real-Time Signal Dashboard</Heading>
          <p>
            Live confidence, entropy, dissonance, and health metrics let you see the quality of the
            analysis as it happens. You know when to trust the output and when to be skeptical.
          </p>
          <Heading>Adaptive Steering</Heading>
          <p>
            The engine learns from your feedback. Rate analyses with thumbs up/down, and the Bayesian
            steering memory adapts future analyses to your preferences and quality standards.
          </p>
          <Heading>Topological Concept Mapping</Heading>
          <p>
            Active concepts form a force-directed graph with TDA-computed topological features. You can
            see how ideas connect, where clusters form, and when reasoning becomes fragmented.
          </p>
          <Heading>Cortex Snapshots</Heading>
          <p>
            Save and restore complete brain states — signals, concepts, controls, and pipeline settings.
            Compare different analytical configurations side by side.
          </p>
        </DocSection>

        {/* ── Getting Started ── */}
        <DocSection icon={RocketIcon} iconColor="#E07850" title="Getting Started" isDark={isDark}>
          <Heading>Prerequisites</Heading>
          <Ul>
            <Li><strong>Node.js 18+</strong> — Required for Next.js</Li>
            <Li><strong>npm or pnpm</strong> — Package manager</Li>
            <Li><strong>Optional: Ollama</strong> — For local inference mode</Li>
          </Ul>

          <Heading>Installation</Heading>
          <CodeBlock>{`# Clone the repository
git clone <repo-url>
cd meta-analytical-pfc/pfc-app

# Install dependencies
npm install

# Start development server
npm run dev

# Open in browser
open http://localhost:3000`}</CodeBlock>

          <Heading>First Steps</Heading>
          <Ul>
            <Li>The app starts in <strong>Simulation Mode</strong> — no API key needed</Li>
            <Li>Type a research question in the chat to trigger the 10-stage pipeline</Li>
            <Li>Watch the signals update in real time as each stage processes</Li>
            <Li>Navigate to <strong>Analytics</strong> to explore all signals, visualizations, and tools</Li>
            <Li>Go to <strong>Settings</strong> to switch to API or Local inference mode</Li>
          </Ul>
        </DocSection>

        {/* ── Scripts & Commands ── */}
        <DocSection icon={TerminalIcon} iconColor="#8B7CF6" title="Scripts & Commands" isDark={isDark}>
          <Heading>Development</Heading>
          <CodeBlock>{`npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint`}</CodeBlock>

          <Heading>Ollama (Local Inference)</Heading>
          <CodeBlock>{`# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Start the server
ollama serve

# Pull a model
ollama pull llama3.1
ollama pull mistral

# Verify running
curl http://localhost:11434/api/tags`}</CodeBlock>

          <Heading>Environment Variables</Heading>
          <p>All configuration is stored in <Code>localStorage</Code> through the Settings page. No <Code>.env</Code> file needed for basic usage.</p>
          <p>If using API mode, your API key is stored locally and never sent to any server other than the selected provider (OpenAI or Anthropic).</p>
        </DocSection>

        {/* ── Troubleshooting ── */}
        <DocSection icon={AlertTriangleIcon} iconColor="#EF4444" title="Troubleshooting" isDark={isDark}>
          <Heading>Build Errors</Heading>
          <Ul>
            <Li><strong>&quot;Module not found&quot;</strong> — Run <Code>npm install</Code> to ensure all dependencies are installed</Li>
            <Li><strong>TypeScript errors</strong> — Check that you&apos;re using Node.js 18+ and the correct TypeScript version</Li>
            <Li><strong>CSS parsing errors</strong> — Tailwind v4 requires <Code>@import</Code> rules at the very top of CSS files, before any other rules</Li>
          </Ul>

          <Heading>Ollama Issues</Heading>
          <Ul>
            <Li><strong>&quot;Ollama not detected&quot;</strong> — Ensure <Code>ollama serve</Code> is running. Check the URL in Settings (default: <Code>http://localhost:11434</Code>)</Li>
            <Li><strong>No models available</strong> — Pull at least one model: <Code>ollama pull llama3.1</Code></Li>
            <Li><strong>Slow inference</strong> — Check GPU availability in Settings &gt; Hardware. CPU-only inference is much slower</Li>
          </Ul>

          <Heading>API Mode Issues</Heading>
          <Ul>
            <Li><strong>&quot;Connection failed&quot;</strong> — Verify your API key is correct and has sufficient credits</Li>
            <Li><strong>Rate limits</strong> — Switch to a different model or wait before retrying</Li>
            <Li><strong>CORS errors</strong> — API calls are proxied through Next.js API routes; direct browser calls won&apos;t work</Li>
          </Ul>

          <Heading>UI Issues</Heading>
          <Ul>
            <Li><strong>Blank page</strong> — Check browser console for errors. Try clearing <Code>localStorage</Code> and refreshing</Li>
            <Li><strong>Animations stuttering</strong> — Reduce the number of open tabs. Canvas animations are GPU-accelerated but can be heavy</Li>
            <Li><strong>Theme not switching</strong> — The app uses <Code>next-themes</Code> with system detection. Ensure your OS dark mode setting is configured</Li>
          </Ul>

          <Heading>Reset Everything</Heading>
          <p>
            If something is broken beyond repair, go to <strong>Settings &gt; Reset</strong> or run this
            in your browser console:
          </p>
          <CodeBlock>{`localStorage.clear();
location.reload();`}</CodeBlock>
        </DocSection>

        {/* ── Architecture Deep Dive ── */}
        <DocSection icon={WrenchIcon} iconColor="#06B6D4" title="Architecture Deep Dive" isDark={isDark}>
          <Heading>Project Structure</Heading>
          <CodeBlock>{`pfc-app/
├── app/                  # Next.js App Router pages
│   ├── page.tsx          # Main chat page
│   ├── layout.tsx        # Root layout (ThemeProvider, AppShell)
│   ├── pipeline/         # Pipeline visualization
│   ├── analytics/        # Analytics hub (all tools)
│   ├── docs/             # This documentation page
│   ├── settings/         # Configuration
│   ├── diagnostics/      # Signal diagnostics
│   ├── visualizer/       # Charts & graphs
│   ├── evaluate/         # ML project evaluator
│   ├── concept-atlas/    # Force-directed concept graph
│   ├── steering-lab/     # Adaptive steering engine
│   ├── cortex-archive/   # Brain state snapshots
│   └── research-copilot/ # Research techniques & tools
├── components/           # Shared UI components
│   ├── app-shell.tsx     # Top-level layout (sidebar trigger, theme toggle)
│   ├── app-sidebar.tsx   # Navigation sidebar
│   ├── chat.tsx          # Chat interface
│   ├── messages.tsx      # Message rendering
│   ├── page-shell.tsx    # Page wrapper with header
│   └── ui/               # shadcn/ui primitives
├── hooks/                # Custom React hooks
├── lib/
│   ├── engine/           # Core reasoning engine
│   │   ├── llm/          # LLM integration (API, Ollama)
│   │   ├── steering/     # Adaptive steering system
│   │   └── types.ts      # Engine type definitions
│   ├── store/            # Zustand state stores
│   └── constants.ts      # Pipeline stages, example queries
└── public/
    └── fonts/            # Custom font files`}</CodeBlock>

          <Heading>Data Flow</Heading>
          <p>
            When a user submits a query, the data flows through:
          </p>
          <Ul>
            <Li><Code>MultimodalInput</Code> → <Code>useChatStream</Code> hook → API route or simulation engine</Li>
            <Li>Each pipeline stage updates the Zustand store with progress and results</Li>
            <Li>The store updates trigger re-renders in all connected components (signals, pipeline, concepts)</Li>
            <Li>The steering engine observes the final outcome and updates its Bayesian memory</Li>
          </Ul>
        </DocSection>
      </div>
    </PageShell>
  );
}
