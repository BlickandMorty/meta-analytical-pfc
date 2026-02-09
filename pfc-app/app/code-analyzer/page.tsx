'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, type Easing } from 'framer-motion';
import { useTheme } from 'next-themes';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import { PageShell, GlassSection } from '@/components/page-shell';
import { GlassBubbleButton } from '@/components/glass-bubble-button';
import type {
  ProgrammingLanguage,
  ProjectCategory,
  LanguageFitScore,
  CodebaseAnalysis,
} from '@/lib/research/types';
import {
  CodeIcon,
  MonitorIcon,
  ServerIcon,
  SmartphoneIcon,
  LayoutIcon,
  GamepadIcon,
  BrainCircuitIcon,
  TerminalIcon,
  CpuIcon,
  GlobeIcon,
  DatabaseIcon,
  NetworkIcon,
  WrenchIcon,
  BlocksIcon,
  LibraryIcon,
  BoxIcon,
  LayersIcon,
  ArrowRightIcon,
  Trash2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  StarIcon,
  TrendingUpIcon,
  ShieldCheckIcon,
  UsersIcon,
  ZapIcon,
  PackageIcon,
  ClockIcon,
  AlertTriangleIcon,
  SparklesIcon,
  HistoryIcon,
  XIcon,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════

const CUPERTINO_EASING = [0.32, 0.72, 0, 1] as const;

const LANGUAGE_LABELS: Record<ProgrammingLanguage, { name: string; color: string }> = {
  typescript:  { name: 'TypeScript',  color: '#3178C6' },
  javascript:  { name: 'JavaScript',  color: '#F7DF1E' },
  python:      { name: 'Python',      color: '#3776AB' },
  rust:        { name: 'Rust',        color: '#CE422B' },
  go:          { name: 'Go',          color: '#00ADD8' },
  java:        { name: 'Java',        color: '#ED8B00' },
  kotlin:      { name: 'Kotlin',      color: '#7F52FF' },
  swift:       { name: 'Swift',       color: '#F05138' },
  c:           { name: 'C',           color: '#A8B9CC' },
  cpp:         { name: 'C++',         color: '#00599C' },
  csharp:      { name: 'C#',          color: '#239120' },
  ruby:        { name: 'Ruby',        color: '#CC342D' },
  php:         { name: 'PHP',         color: '#777BB4' },
  dart:        { name: 'Dart',        color: '#0175C2' },
  elixir:      { name: 'Elixir',      color: '#6E4A7E' },
  zig:         { name: 'Zig',         color: '#F7A41D' },
  lua:         { name: 'Lua',         color: '#2C2D72' },
  scala:       { name: 'Scala',       color: '#DC322F' },
  haskell:     { name: 'Haskell',     color: '#5D4F85' },
  ocaml:       { name: 'OCaml',       color: '#EC6813' },
};

const ALL_LANGUAGES = Object.keys(LANGUAGE_LABELS) as ProgrammingLanguage[];

interface CategoryInfo {
  key: ProjectCategory;
  label: string;
  description: string;
  icon: typeof CodeIcon;
}

const CATEGORIES: CategoryInfo[] = [
  { key: 'web-frontend',   label: 'Web Frontend',       description: 'SPAs, SSR, UI frameworks',           icon: LayoutIcon },
  { key: 'web-backend',    label: 'Web Backend',        description: 'APIs, servers, microservices',       icon: ServerIcon },
  { key: 'mobile-native',  label: 'Mobile Native',      description: 'iOS, Android native apps',           icon: SmartphoneIcon },
  { key: 'mobile-cross',   label: 'Mobile Cross-Plat',  description: 'Flutter, React Native, MAUI',        icon: SmartphoneIcon },
  { key: 'desktop-app',    label: 'Desktop App',        description: 'Native desktop applications',        icon: MonitorIcon },
  { key: 'cli-tool',       label: 'CLI Tool',           description: 'Command-line utilities',             icon: TerminalIcon },
  { key: 'game-engine',    label: 'Game Engine',        description: 'Rendering, physics, ECS',            icon: GamepadIcon },
  { key: 'game-scripting', label: 'Game Scripting',     description: 'Gameplay logic, modding',            icon: GamepadIcon },
  { key: 'ml-training',    label: 'ML Training',        description: 'Model training, research',           icon: BrainCircuitIcon },
  { key: 'ml-inference',   label: 'ML Inference',       description: 'Model serving, edge deployment',     icon: BrainCircuitIcon },
  { key: 'data-pipeline',  label: 'Data Pipeline',      description: 'ETL, streaming, batch processing',   icon: DatabaseIcon },
  { key: 'systems',        label: 'Systems',            description: 'OS, drivers, low-level',             icon: CpuIcon },
  { key: 'embedded',       label: 'Embedded',           description: 'IoT, firmware, microcontrollers',    icon: CpuIcon },
  { key: 'api-service',    label: 'API Service',        description: 'REST, GraphQL, gRPC services',       icon: GlobeIcon },
  { key: 'devtools',       label: 'Dev Tools',          description: 'Linters, formatters, build tools',   icon: WrenchIcon },
  { key: 'blockchain',     label: 'Blockchain',         description: 'Smart contracts, DeFi, L2s',         icon: BlocksIcon },
  { key: 'library',        label: 'Library / SDK',      description: 'Reusable packages, frameworks',      icon: LibraryIcon },
  { key: 'compiler',       label: 'Compiler / Lang',    description: 'Language tooling, interpreters',     icon: BoxIcon },
  { key: 'database',       label: 'Database',           description: 'Storage engines, query systems',     icon: DatabaseIcon },
  { key: 'networking',     label: 'Networking',         description: 'Proxies, load balancers, P2P',       icon: NetworkIcon },
];

// ═══════════════════════════════════════════════════════════════════
// Mock Data Generator
// ═══════════════════════════════════════════════════════════════════

type ScoreEntry = {
  overall: number;
  perf: number;
  eco: number;
  dx: number;
  maint: number;
  hire: number;
  reasoning: string;
  libs: string[];
  repos: string[];
  bestFor: string[];
  tradeoffs: string[];
};

const CATEGORY_SCORES: Partial<Record<ProjectCategory, Partial<Record<ProgrammingLanguage, ScoreEntry>>>> = {
  'web-frontend': {
    typescript: {
      overall: 92, perf: 75, eco: 98, dx: 95, maint: 95, hire: 92,
      reasoning: 'TypeScript is the dominant choice for modern web frontends. Superior type safety catches errors at compile time, while the ecosystem (React, Vue, Svelte, Angular) is unmatched.',
      libs: ['React', 'Next.js', 'Vue 3', 'Svelte', 'Tailwind CSS', 'Zustand'],
      repos: ['vercel/next.js', 'facebook/react', 'sveltejs/svelte'],
      bestFor: ['Large-scale SPAs', 'SSR/SSG applications', 'Component libraries'],
      tradeoffs: ['Build step required', 'Runtime overhead vs vanilla JS is negligible but exists'],
    },
    javascript: {
      overall: 85, perf: 74, eco: 97, dx: 82, maint: 78, hire: 95,
      reasoning: 'JavaScript remains highly capable for frontend work. Fastest prototyping speed, but lack of types becomes painful in larger codebases.',
      libs: ['React', 'Vue', 'Svelte', 'Vite', 'Parcel'],
      repos: ['vuejs/vue', 'sveltejs/kit', 'vitejs/vite'],
      bestFor: ['Quick prototypes', 'Small projects', 'Scripts and widgets'],
      tradeoffs: ['No type safety', 'Harder to refactor at scale', 'Runtime errors more common'],
    },
    dart: {
      overall: 70, perf: 72, eco: 55, dx: 78, maint: 80, hire: 40,
      reasoning: 'Dart with Flutter Web is viable but the web ecosystem is smaller. Best when sharing code with a Flutter mobile app.',
      libs: ['Flutter Web', 'Riverpod', 'Bloc'],
      repos: ['flutter/flutter', 'rrousselGit/riverpod'],
      bestFor: ['Cross-platform apps with web target', 'Material Design UIs'],
      tradeoffs: ['Smaller web ecosystem', 'SEO challenges', 'Fewer web-specific libraries'],
    },
    rust: {
      overall: 65, perf: 95, eco: 35, dx: 55, maint: 88, hire: 25,
      reasoning: 'Rust via WASM is excellent for compute-heavy web apps (image processing, games, simulations) but not ideal for typical UI development.',
      libs: ['Leptos', 'Yew', 'Dioxus', 'wasm-bindgen'],
      repos: ['nickel-org/nickel.rs', 'AmbientRun/Ambient', 'nickel-org/nickel.rs'],
      bestFor: ['Performance-critical web modules', 'WASM-powered computation', 'WebGPU'],
      tradeoffs: ['Steep learning curve', 'Limited UI ecosystem', 'Slow compile times'],
    },
  },
  'web-backend': {
    go: {
      overall: 90, perf: 92, eco: 85, dx: 82, maint: 90, hire: 80,
      reasoning: 'Go excels at backend services with its simplicity, excellent concurrency model, fast compilation, and strong standard library for HTTP and networking.',
      libs: ['Gin', 'Echo', 'Fiber', 'GORM', 'sqlx', 'chi'],
      repos: ['gin-gonic/gin', 'gofiber/fiber', 'go-chi/chi'],
      bestFor: ['Microservices', 'APIs with high concurrency', 'Cloud-native backends'],
      tradeoffs: ['Limited generics', 'Verbose error handling', 'Less expressive type system'],
    },
    rust: {
      overall: 88, perf: 98, eco: 72, dx: 65, maint: 92, hire: 55,
      reasoning: 'Rust delivers the highest performance with memory safety guarantees. Actix-web and Axum are production-ready, but development velocity is slower.',
      libs: ['Axum', 'Actix-web', 'Tokio', 'SQLx', 'SeaORM', 'Tower'],
      repos: ['tokio-rs/axum', 'actix/actix-web', 'launchbadge/sqlx'],
      bestFor: ['High-performance APIs', 'Systems requiring memory safety', 'Low-latency services'],
      tradeoffs: ['Steep learning curve', 'Slower development iteration', 'Smaller hiring pool'],
    },
    typescript: {
      overall: 85, perf: 68, eco: 95, dx: 92, maint: 88, hire: 90,
      reasoning: 'TypeScript with Node.js or Bun offers rapid development, code sharing with frontend, and a massive package ecosystem. Performance is good but not systems-level.',
      libs: ['Express', 'Fastify', 'NestJS', 'Prisma', 'tRPC', 'Hono'],
      repos: ['nestjs/nest', 'fastify/fastify', 'prisma/prisma'],
      bestFor: ['Full-stack TypeScript teams', 'Rapid development', 'Real-time apps'],
      tradeoffs: ['Single-threaded event loop', 'Lower raw performance', 'node_modules complexity'],
    },
    python: {
      overall: 82, perf: 55, eco: 92, dx: 90, maint: 82, hire: 92,
      reasoning: 'Python is excellent for rapid API development, especially with FastAPI. Large talent pool and rich ecosystem, but performance requires careful architecture.',
      libs: ['FastAPI', 'Django', 'Flask', 'SQLAlchemy', 'Pydantic', 'Celery'],
      repos: ['tiangolo/fastapi', 'django/django', 'pallets/flask'],
      bestFor: ['Data-heavy backends', 'ML-integrated APIs', 'Rapid prototyping'],
      tradeoffs: ['GIL limits concurrency', 'Runtime type errors', 'Deployment can be complex'],
    },
    java: {
      overall: 78, perf: 82, eco: 90, dx: 65, maint: 85, hire: 95,
      reasoning: 'Java with Spring Boot is battle-tested for enterprise backends. Excellent tooling and monitoring, but verbose and slower to iterate.',
      libs: ['Spring Boot', 'Quarkus', 'Micronaut', 'Hibernate', 'jOOQ'],
      repos: ['spring-projects/spring-boot', 'quarkusio/quarkus'],
      bestFor: ['Enterprise applications', 'Large team projects', 'Banking and fintech'],
      tradeoffs: ['Verbose boilerplate', 'Slow startup (mitigated by GraalVM)', 'Heavy memory usage'],
    },
  },
  'mobile-native': {
    swift: {
      overall: 92, perf: 90, eco: 88, dx: 92, maint: 90, hire: 72,
      reasoning: 'Swift with SwiftUI is the gold standard for iOS development. First-class Apple platform support, excellent performance, and modern language design.',
      libs: ['SwiftUI', 'Combine', 'Alamofire', 'Realm', 'SnapKit'],
      repos: ['apple/swift', 'Alamofire/Alamofire', 'realm/realm-swift'],
      bestFor: ['iOS apps', 'macOS apps', 'Apple ecosystem integration'],
      tradeoffs: ['Apple platforms only', 'SwiftUI still maturing', 'Frequent API changes'],
    },
    kotlin: {
      overall: 91, perf: 88, eco: 90, dx: 90, maint: 92, hire: 78,
      reasoning: 'Kotlin is the recommended language for Android. Jetpack Compose modernizes UI development, and KMP enables code sharing across platforms.',
      libs: ['Jetpack Compose', 'Ktor', 'Koin', 'Room', 'Coroutines'],
      repos: ['JetBrains/kotlin', 'android/compose-samples'],
      bestFor: ['Android apps', 'Kotlin Multiplatform', 'Server-side Kotlin'],
      tradeoffs: ['Android-centric ecosystem', 'Build times with Gradle', 'KMP still evolving'],
    },
  },
  'desktop-app': {
    rust: {
      overall: 90, perf: 98, eco: 68, dx: 65, maint: 95, hire: 50,
      reasoning: 'Rust with Tauri delivers near-native performance with small binaries. Memory safety eliminates entire classes of desktop app bugs. Growing rapidly.',
      libs: ['Tauri', 'Iced', 'egui', 'Slint', 'gtk-rs'],
      repos: ['nickel-org/nickel.rs', 'nickel-org/nickel.rs', 'nickel-org/nickel.rs'],
      bestFor: ['Performance-critical apps', 'Cross-platform with Tauri', 'System utilities'],
      tradeoffs: ['Steep learning curve', 'UI ecosystem still maturing', 'Slower development'],
    },
    cpp: {
      overall: 85, perf: 97, eco: 82, dx: 50, maint: 70, hire: 72,
      reasoning: 'C++ with Qt remains the industry standard for high-performance desktop apps. Massive existing codebase and proven at scale.',
      libs: ['Qt', 'wxWidgets', 'ImGui', 'JUCE', 'Boost'],
      repos: ['nickel-org/nickel.rs', 'nickel-org/nickel.rs'],
      bestFor: ['Professional creative tools', 'CAD/engineering', 'Audio/video applications'],
      tradeoffs: ['Memory safety issues', 'Complex build systems', 'Long compile times'],
    },
    swift: {
      overall: 82, perf: 88, eco: 72, dx: 88, maint: 85, hire: 55,
      reasoning: 'Swift with SwiftUI/AppKit provides excellent macOS-native apps. Limited to Apple platforms but offers superb integration.',
      libs: ['SwiftUI', 'AppKit', 'Combine', 'CoreData'],
      repos: ['apple/swift', 'iina/iina'],
      bestFor: ['macOS apps', 'Apple ecosystem tools', 'Menu bar utilities'],
      tradeoffs: ['macOS only', 'Smaller cross-platform story', 'Fewer desktop-specific libraries'],
    },
    typescript: {
      overall: 78, perf: 55, eco: 92, dx: 90, maint: 82, hire: 92,
      reasoning: 'Electron/TypeScript enables rapid cross-platform desktop development using web technologies. Large ecosystem but higher resource usage.',
      libs: ['Electron', 'Tauri (TS frontend)', 'React', 'electron-builder'],
      repos: ['nickel-org/nickel.rs', 'nickel-org/nickel.rs'],
      bestFor: ['Cross-platform apps fast', 'Web-to-desktop ports', 'Collaboration tools'],
      tradeoffs: ['High memory usage', 'Large bundle size', 'Not truly native feel'],
    },
  },
  'ml-training': {
    python: {
      overall: 95, perf: 60, eco: 99, dx: 92, maint: 85, hire: 95,
      reasoning: 'Python is the undisputed king of ML training. PyTorch, TensorFlow, JAX, and the entire scientific computing ecosystem live here. No serious alternative for most teams.',
      libs: ['PyTorch', 'TensorFlow', 'JAX', 'Hugging Face', 'scikit-learn', 'Weights & Biases'],
      repos: ['pytorch/pytorch', 'tensorflow/tensorflow', 'huggingface/transformers'],
      bestFor: ['Model training', 'Research experiments', 'Data analysis', 'Notebooks'],
      tradeoffs: ['Slow execution (mitigated by C extensions)', 'GIL', 'Deployment complexity'],
    },
    rust: {
      overall: 72, perf: 96, eco: 42, dx: 55, maint: 90, hire: 30,
      reasoning: 'Rust ML ecosystem (Candle, Burn) is growing rapidly. Excellent for custom high-performance training loops but the ecosystem is far behind Python.',
      libs: ['Candle', 'Burn', 'tch-rs', 'ndarray', 'polars'],
      repos: ['huggingface/candle', 'tracel-ai/burn'],
      bestFor: ['Custom training kernels', 'Performance-critical pipelines', 'Edge deployment'],
      tradeoffs: ['Very limited ecosystem vs Python', 'Fewer pre-trained models', 'Harder to prototype'],
    },
    cpp: {
      overall: 65, perf: 98, eco: 55, dx: 35, maint: 60, hire: 50,
      reasoning: 'C++ powers the underlying ML frameworks (PyTorch, TensorFlow cores) but writing ML training code directly in C++ is painful and rarely necessary.',
      libs: ['LibTorch', 'TensorFlow C++', 'ONNX Runtime', 'OpenCV'],
      repos: ['pytorch/pytorch', 'onnx/onnx'],
      bestFor: ['Framework development', 'Custom CUDA kernels', 'Embedded inference'],
      tradeoffs: ['Very slow iteration', 'No notebook workflow', 'Memory management overhead'],
    },
  },
  'game-engine': {
    cpp: {
      overall: 93, perf: 98, eco: 92, dx: 50, maint: 72, hire: 75,
      reasoning: 'C++ remains the dominant language for game engines. Unreal, custom engines, and performance-critical systems all use C++. Deep ecosystem of tools and middleware.',
      libs: ['SDL2', 'GLFW', 'EnTT', 'PhysX', 'Dear ImGui', 'Vulkan SDK'],
      repos: ['EpicGames/UnrealEngine', 'godotengine/godot', 'SFML/SFML'],
      bestFor: ['AAA game engines', 'Real-time rendering', 'Physics simulations'],
      tradeoffs: ['Memory safety issues', 'Complex codebase management', 'Long compile times'],
    },
    rust: {
      overall: 88, perf: 97, eco: 62, dx: 68, maint: 92, hire: 42,
      reasoning: 'Rust is rapidly gaining ground in game development. Bevy is a promising ECS engine, and memory safety eliminates common game dev bugs.',
      libs: ['Bevy', 'wgpu', 'rapier', 'nalgebra', 'winit'],
      repos: ['bevyengine/bevy', 'gfx-rs/wgpu', 'dimforge/rapier'],
      bestFor: ['Indie game engines', 'Simulation-heavy games', 'WebGPU-based renderers'],
      tradeoffs: ['Ecosystem still maturing', 'Fewer AAA-proven patterns', 'Borrow checker learning curve'],
    },
    csharp: {
      overall: 82, perf: 78, eco: 88, dx: 90, maint: 85, hire: 82,
      reasoning: 'C# with Unity or Godot (C# bindings) is excellent for game development. Great developer experience and large community.',
      libs: ['Unity Engine', 'Godot (C#)', 'MonoGame', 'Stride'],
      repos: ['godotengine/godot', 'MonoGame/MonoGame'],
      bestFor: ['Indie games', 'Mobile games', 'XR/VR applications'],
      tradeoffs: ['GC pauses can affect frame times', 'Less control than C++', 'Unity licensing concerns'],
    },
  },
  'cli-tool': {
    rust: {
      overall: 92, perf: 97, eco: 78, dx: 75, maint: 92, hire: 55,
      reasoning: 'Rust is the premier choice for CLI tools. Single binary distribution, blazing performance, and excellent crates like clap make it ideal.',
      libs: ['clap', 'serde', 'tokio', 'indicatif', 'crossterm', 'ratatui'],
      repos: ['BurntSushi/ripgrep', 'sharkdp/bat', 'sharkdp/fd'],
      bestFor: ['High-performance CLIs', 'Developer tools', 'System utilities'],
      tradeoffs: ['Slower development speed', 'Steeper learning curve', 'Compile times'],
    },
    go: {
      overall: 90, perf: 88, eco: 82, dx: 88, maint: 88, hire: 78,
      reasoning: 'Go is excellent for CLI tools with fast compilation, single binary output, and simple cross-compilation. Cobra powers many popular CLIs.',
      libs: ['Cobra', 'Viper', 'bubbletea', 'lipgloss', 'charm'],
      repos: ['spf13/cobra', 'charmbracelet/bubbletea', 'cli/cli'],
      bestFor: ['DevOps tools', 'Cloud CLIs', 'Network utilities'],
      tradeoffs: ['Larger binary size than Rust', 'Less expressive', 'Error handling verbosity'],
    },
    python: {
      overall: 75, perf: 45, eco: 88, dx: 92, maint: 78, hire: 95,
      reasoning: 'Python CLIs are fast to build with Click/Typer but require Python runtime. Best for internal tools and data-oriented utilities.',
      libs: ['Click', 'Typer', 'Rich', 'argparse', 'Textual'],
      repos: ['Textualize/rich', 'tiangolo/typer', 'pallets/click'],
      bestFor: ['Internal tools', 'Data processing scripts', 'Rapid prototypes'],
      tradeoffs: ['Requires Python runtime', 'Slow startup', 'Distribution challenges'],
    },
  },
  'systems': {
    rust: {
      overall: 94, perf: 98, eco: 75, dx: 68, maint: 96, hire: 50,
      reasoning: 'Rust is the modern choice for systems programming. Memory safety without GC, zero-cost abstractions, and growing adoption in Linux kernel, Windows, and Android.',
      libs: ['tokio', 'nix', 'libc', 'crossbeam', 'rayon', 'mio'],
      repos: ['nickel-org/nickel.rs', 'nickel-org/nickel.rs'],
      bestFor: ['OS components', 'Drivers', 'Embedded systems', 'Network stacks'],
      tradeoffs: ['Steep learning curve', 'Smaller hiring pool', 'Less legacy code to reference'],
    },
    c: {
      overall: 90, perf: 97, eco: 85, dx: 45, maint: 65, hire: 70,
      reasoning: 'C is still the lingua franca of systems programming. Linux kernel, embedded systems, and most OS APIs are C. Unmatched portability and control.',
      libs: ['glibc', 'musl', 'libev', 'libuv', 'zlib'],
      repos: ['torvalds/linux', 'libuv/libuv', 'madler/zlib'],
      bestFor: ['Kernel development', 'Embedded firmware', 'Cross-platform libraries'],
      tradeoffs: ['No memory safety', 'Manual memory management', 'Undefined behavior risks'],
    },
    cpp: {
      overall: 88, perf: 97, eco: 88, dx: 52, maint: 72, hire: 75,
      reasoning: 'C++ adds abstractions over C while maintaining systems-level control. Used in browsers, databases, and high-performance systems.',
      libs: ['Boost', 'Abseil', 'folly', 'gRPC', 'Protobuf'],
      repos: ['nickel-org/nickel.rs', 'nickel-org/nickel.rs'],
      bestFor: ['Database engines', 'Browsers', 'High-frequency trading'],
      tradeoffs: ['Complexity', 'Long compile times', 'Memory safety challenges'],
    },
    zig: {
      overall: 82, perf: 95, eco: 38, dx: 72, maint: 85, hire: 18,
      reasoning: 'Zig is a compelling modern systems language with excellent C interop, comptime, and no hidden control flow. Still pre-1.0 but gaining traction.',
      libs: ['std lib', 'zig-network', 'zap'],
      repos: ['ziglang/zig', 'michal-z/zig-gamedev'],
      bestFor: ['C replacement projects', 'Cross-compilation', 'Performance-critical code'],
      tradeoffs: ['Pre-1.0 language', 'Very small ecosystem', 'Limited tooling'],
    },
  },
  'data-pipeline': {
    python: {
      overall: 88, perf: 55, eco: 96, dx: 90, maint: 80, hire: 95,
      reasoning: 'Python dominates data engineering with Spark, Airflow, dbt, and Polars. Ideal for orchestration and transformation workflows.',
      libs: ['Apache Spark', 'Airflow', 'Polars', 'dbt', 'Pandas', 'Dagster'],
      repos: ['apache/airflow', 'pola-rs/polars', 'dagster-io/dagster'],
      bestFor: ['ETL pipelines', 'Data orchestration', 'Analytics engineering'],
      tradeoffs: ['Performance bottlenecks at scale', 'GIL limitations', 'Memory usage'],
    },
    rust: {
      overall: 82, perf: 97, eco: 55, dx: 60, maint: 90, hire: 40,
      reasoning: 'Rust excels at high-throughput data processing. Polars and DataFusion are Rust-native. Ideal when Python pipelines hit performance walls.',
      libs: ['Polars', 'DataFusion', 'Arrow', 'Tokio', 'Rayon'],
      repos: ['pola-rs/polars', 'apache/arrow-datafusion'],
      bestFor: ['High-throughput processing', 'Real-time streaming', 'Custom data engines'],
      tradeoffs: ['Slower to develop', 'Fewer integrations', 'Steeper learning curve'],
    },
    go: {
      overall: 78, perf: 85, eco: 70, dx: 80, maint: 85, hire: 78,
      reasoning: 'Go is solid for concurrent data pipeline workers. Good for stream processing and message-driven architectures.',
      libs: ['Sarama', 'go-nsq', 'Benthos', 'Watermill'],
      repos: ['benthosdev/benthos', 'ThreeDotsLabs/watermill'],
      bestFor: ['Message queue consumers', 'Stream processors', 'Pipeline workers'],
      tradeoffs: ['Less data science tooling', 'No notebook ecosystem', 'Fewer data libraries'],
    },
  },
  'api-service': {
    go: {
      overall: 90, perf: 90, eco: 82, dx: 85, maint: 88, hire: 80,
      reasoning: 'Go is purpose-built for API services. Excellent HTTP stdlib, goroutines for concurrency, and fast compile-deploy cycles.',
      libs: ['Gin', 'Echo', 'Connect', 'gRPC-Go', 'sqlc', 'Ent'],
      repos: ['gin-gonic/gin', 'bufbuild/connect-go'],
      bestFor: ['REST APIs', 'gRPC services', 'Gateway services'],
      tradeoffs: ['Limited generics', 'Verbose patterns', 'Less ORM maturity'],
    },
    typescript: {
      overall: 87, perf: 65, eco: 95, dx: 92, maint: 85, hire: 92,
      reasoning: 'TypeScript with NestJS or Hono delivers rapid API development with type safety. Excellent for teams already using TypeScript on the frontend.',
      libs: ['NestJS', 'Hono', 'tRPC', 'Prisma', 'Drizzle', 'Zod'],
      repos: ['nestjs/nest', 'honojs/hono', 'trpc/trpc'],
      bestFor: ['Full-stack TS apps', 'tRPC end-to-end safety', 'BFF patterns'],
      tradeoffs: ['Single-threaded', 'Lower throughput than Go/Rust', 'Dependency weight'],
    },
    rust: {
      overall: 85, perf: 98, eco: 68, dx: 62, maint: 90, hire: 48,
      reasoning: 'Axum and Actix provide extremely high-performance API frameworks. Best when you need maximum throughput and minimal latency.',
      libs: ['Axum', 'Actix-web', 'tonic (gRPC)', 'SQLx', 'SeaORM'],
      repos: ['tokio-rs/axum', 'actix/actix-web'],
      bestFor: ['High-throughput APIs', 'Latency-sensitive services', 'Financial APIs'],
      tradeoffs: ['Slower development', 'Fewer middleware options', 'Steeper onboarding'],
    },
  },
  'devtools': {
    rust: {
      overall: 90, perf: 97, eco: 72, dx: 70, maint: 92, hire: 50,
      reasoning: 'Many modern dev tools are written in Rust for performance: SWC, Turbopack, Biome, oxc. Users expect instant feedback from dev tools.',
      libs: ['clap', 'tree-sitter', 'syn', 'tower-lsp', 'chumsky'],
      repos: ['nickel-org/nickel.rs', 'nickel-org/nickel.rs'],
      bestFor: ['Compilers and bundlers', 'Linters', 'Language servers', 'Code formatters'],
      tradeoffs: ['Higher development investment', 'Smaller contributor pool', 'Complex AST handling'],
    },
    typescript: {
      overall: 82, perf: 55, eco: 92, dx: 92, maint: 82, hire: 92,
      reasoning: 'TypeScript dev tools benefit from the JS ecosystem. ESLint, Prettier, and many VS Code extensions are TypeScript. Easy to contribute to.',
      libs: ['TypeScript Compiler API', 'unified', 'AST types', 'VS Code API'],
      repos: ['microsoft/TypeScript', 'eslint/eslint', 'prettier/prettier'],
      bestFor: ['VS Code extensions', 'ESLint plugins', 'Code generators'],
      tradeoffs: ['Slower than native tools', 'Limited by Node.js performance', 'Higher memory usage'],
    },
    go: {
      overall: 80, perf: 88, eco: 70, dx: 85, maint: 88, hire: 78,
      reasoning: 'Go is used for many DevOps and infrastructure tools. Simple deployment, fast startup, and easy cross-compilation.',
      libs: ['Cobra', 'go-analysis', 'golangci-lint'],
      repos: ['golangci/golangci-lint', 'goreleaser/goreleaser'],
      bestFor: ['Infrastructure tools', 'CI/CD tooling', 'Container tools'],
      tradeoffs: ['Less suited for AST-heavy work', 'Fewer parsing libraries', 'Limited metaprogramming'],
    },
  },
  'blockchain': {
    rust: {
      overall: 90, perf: 96, eco: 70, dx: 60, maint: 92, hire: 45,
      reasoning: 'Rust dominates blockchain infrastructure: Solana, Polkadot, Near, and many L2s. Memory safety is critical for consensus code.',
      libs: ['Substrate', 'Anchor', 'ethers-rs', 'alloy', 'Foundry'],
      repos: ['nickel-org/nickel.rs', 'nickel-org/nickel.rs'],
      bestFor: ['L1/L2 protocols', 'Solana programs', 'MEV bots'],
      tradeoffs: ['Steep learning curve', 'Complex toolchains', 'Debugging difficulty'],
    },
    go: {
      overall: 82, perf: 82, eco: 75, dx: 80, maint: 85, hire: 70,
      reasoning: 'Go powers Ethereum (Geth), Cosmos SDK, and many blockchain tools. Good balance of performance and development speed.',
      libs: ['go-ethereum', 'Cosmos SDK', 'Tendermint', 'IPFS'],
      repos: ['ethereum/go-ethereum', 'cosmos/cosmos-sdk'],
      bestFor: ['Ethereum tooling', 'Cosmos chains', 'Blockchain infrastructure'],
      tradeoffs: ['Less suitable for smart contracts', 'GC pauses in consensus', 'Limited zero-cost abstractions'],
    },
  },
  'embedded': {
    rust: {
      overall: 90, perf: 96, eco: 62, dx: 60, maint: 92, hire: 35,
      reasoning: 'Rust embedded is rapidly maturing. Embassy for async embedded, probe-rs for debugging, and no_std support make it excellent for safety-critical embedded.',
      libs: ['Embassy', 'probe-rs', 'defmt', 'heapless', 'embedded-hal'],
      repos: ['embassy-rs/embassy', 'probe-rs/probe-rs'],
      bestFor: ['Safety-critical firmware', 'Async embedded', 'IoT devices'],
      tradeoffs: ['Smaller ecosystem than C', 'HAL coverage gaps', 'Fewer vendor SDKs'],
    },
    c: {
      overall: 92, perf: 96, eco: 95, dx: 45, maint: 60, hire: 80,
      reasoning: 'C remains the standard for embedded. Every MCU vendor provides C SDKs, RTOS options are plentiful, and decades of proven patterns exist.',
      libs: ['FreeRTOS', 'Zephyr', 'CMSIS', 'lwIP', 'mbed'],
      repos: ['zephyrproject-rtos/zephyr', 'FreeRTOS/FreeRTOS'],
      bestFor: ['Vendor SDK projects', 'Legacy firmware', 'Ultra-constrained devices'],
      tradeoffs: ['Memory safety risks', 'Manual everything', 'Buffer overflows'],
    },
    cpp: {
      overall: 82, perf: 95, eco: 80, dx: 48, maint: 68, hire: 72,
      reasoning: 'C++ on embedded brings abstractions with zero overhead. Used in automotive, robotics, and higher-end MCUs where resources allow.',
      libs: ['Arduino', 'mbed C++', 'ETL', 'Boost.Asio'],
      repos: ['arduino/Arduino', 'ARMmbed/mbed-os'],
      bestFor: ['Robotics', 'Automotive', 'Complex embedded systems'],
      tradeoffs: ['Complexity overkill for small MCUs', 'Template bloat risk', 'Toolchain issues'],
    },
  },
  'mobile-cross': {
    dart: {
      overall: 90, perf: 80, eco: 82, dx: 90, maint: 85, hire: 55,
      reasoning: 'Dart with Flutter is the top cross-platform mobile framework. Beautiful custom UIs, hot reload, and strong performance via ahead-of-time compilation.',
      libs: ['Flutter', 'Riverpod', 'Bloc', 'Dio', 'Hive'],
      repos: ['flutter/flutter', 'nickel-org/nickel.rs'],
      bestFor: ['Cross-platform apps', 'Custom UI designs', 'Startup MVPs'],
      tradeoffs: ['Not native look', 'Dart hiring pool smaller', 'Platform API gaps'],
    },
    typescript: {
      overall: 82, perf: 70, eco: 88, dx: 85, maint: 80, hire: 92,
      reasoning: 'TypeScript with React Native enables code sharing with web teams. Large ecosystem and familiar patterns for web developers.',
      libs: ['React Native', 'Expo', 'React Navigation', 'MMKV', 'Reanimated'],
      repos: ['facebook/react-native', 'expo/expo'],
      bestFor: ['Web-to-mobile teams', 'Content-driven apps', 'Social apps'],
      tradeoffs: ['Bridge overhead', 'Native module complexity', 'Performance ceiling'],
    },
    kotlin: {
      overall: 78, perf: 85, eco: 68, dx: 80, maint: 82, hire: 70,
      reasoning: 'Kotlin Multiplatform (KMP) shares business logic across platforms while keeping native UIs. Growing rapidly in the enterprise.',
      libs: ['KMP', 'Ktor', 'SQLDelight', 'Koin', 'Compose Multiplatform'],
      repos: ['JetBrains/kotlin', 'nickel-org/nickel.rs'],
      bestFor: ['Shared business logic', 'Enterprise apps', 'Android-first teams'],
      tradeoffs: ['iOS UI still native', 'Tooling maturing', 'Smaller community than RN/Flutter'],
    },
  },
  'game-scripting': {
    lua: {
      overall: 85, perf: 60, eco: 72, dx: 90, maint: 72, hire: 40,
      reasoning: 'Lua is the industry standard for game scripting. Lightweight, embeddable, and used in Roblox, World of Warcraft, and countless game engines.',
      libs: ['LOVE2D', 'Solar2D', 'Defold'],
      repos: ['love2d/love', 'nickel-org/nickel.rs'],
      bestFor: ['Game mod systems', 'Embedded scripting', 'Rapid gameplay iteration'],
      tradeoffs: ['Limited type safety', 'Small standard library', 'Indexing from 1'],
    },
    csharp: {
      overall: 88, perf: 78, eco: 88, dx: 92, maint: 85, hire: 80,
      reasoning: 'C# with Unity is the most popular game scripting setup. Excellent tooling, large community, and rapid iteration for gameplay code.',
      libs: ['Unity', 'Godot (C#)', 'MonoGame'],
      repos: ['godotengine/godot', 'MonoGame/MonoGame'],
      bestFor: ['Unity games', 'Indie development', 'Mobile games'],
      tradeoffs: ['GC pauses', 'Unity-specific patterns', 'Less control than C++'],
    },
    python: {
      overall: 68, perf: 35, eco: 72, dx: 88, maint: 75, hire: 90,
      reasoning: 'Python is used for game scripting in tools like Blender and some indie engines. Excellent for tooling and asset pipelines.',
      libs: ['Pygame', 'Panda3D', 'Ren\'Py', 'Pyglet'],
      repos: ['pygame/pygame', 'nickel-org/nickel.rs'],
      bestFor: ['Game tooling', 'Asset pipelines', 'Visual novels'],
      tradeoffs: ['Very slow for real-time', 'Not embeddable in most engines', 'Frame rate issues'],
    },
  },
  'library': {
    rust: {
      overall: 88, perf: 97, eco: 68, dx: 65, maint: 95, hire: 48,
      reasoning: 'Rust libraries are prized for performance and correctness. cargo makes publishing seamless, and the type system prevents API misuse.',
      libs: ['serde', 'tokio', 'rayon', 'thiserror', 'anyhow'],
      repos: ['serde-rs/serde', 'tokio-rs/tokio'],
      bestFor: ['Performance libraries', 'Safety-critical APIs', 'Cross-language FFI'],
      tradeoffs: ['Smaller user base', 'Complex generics', 'Compile time impact'],
    },
    typescript: {
      overall: 86, perf: 60, eco: 96, dx: 92, maint: 85, hire: 95,
      reasoning: 'TypeScript libraries reach the largest developer audience via npm. Excellent DX with type definitions, and works in both Node.js and browsers.',
      libs: ['tsup', 'vitest', 'changesets', 'typedoc'],
      repos: ['microsoft/TypeScript', 'nickel-org/nickel.rs'],
      bestFor: ['npm packages', 'Frontend utilities', 'Full-stack libraries'],
      tradeoffs: ['Runtime type erasure', 'CJS/ESM complexity', 'Bundle size concerns'],
    },
    python: {
      overall: 84, perf: 50, eco: 94, dx: 88, maint: 80, hire: 95,
      reasoning: 'Python libraries benefit from the massive PyPI ecosystem. Easy to publish, well-documented conventions, and huge user base.',
      libs: ['setuptools', 'poetry', 'pydantic', 'pytest'],
      repos: ['pypa/pip', 'python-poetry/poetry'],
      bestFor: ['Data science libraries', 'ML tools', 'Developer utilities'],
      tradeoffs: ['Performance limitations', 'Packaging complexity', 'Version management'],
    },
  },
  'compiler': {
    rust: {
      overall: 92, perf: 96, eco: 65, dx: 68, maint: 92, hire: 42,
      reasoning: 'Rust is increasingly the language of choice for compiler and language tool development. Memory safety prevents bugs in complex AST transformations.',
      libs: ['cranelift', 'inkwell (LLVM)', 'logos', 'chumsky', 'ariadne'],
      repos: ['nickel-org/nickel.rs', 'nickel-org/nickel.rs'],
      bestFor: ['New language compilers', 'Optimizing compilers', 'Code analysis tools'],
      tradeoffs: ['Complex ownership patterns in graphs', 'Slower prototyping', 'Arena allocation needed'],
    },
    cpp: {
      overall: 85, perf: 97, eco: 82, dx: 45, maint: 65, hire: 65,
      reasoning: 'C++ is the traditional compiler language. LLVM, GCC, and most production compilers are C++. Vast reference material and proven patterns.',
      libs: ['LLVM', 'ANTLR', 'Flex/Bison'],
      repos: ['llvm/llvm-project', 'nickel-org/nickel.rs'],
      bestFor: ['LLVM-based compilers', 'Production compiler backends', 'Language VMs'],
      tradeoffs: ['Complex codebase management', 'Memory bugs in graph structures', 'Build system complexity'],
    },
    haskell: {
      overall: 78, perf: 72, eco: 52, dx: 65, maint: 82, hire: 15,
      reasoning: 'Haskell is academically renowned for compiler construction. Pattern matching, algebraic data types, and immutability make AST manipulation natural.',
      libs: ['Megaparsec', 'Alex/Happy', 'prettyprinter', 'mtl'],
      repos: ['ghc/ghc', 'nickel-org/nickel.rs'],
      bestFor: ['Research compilers', 'Functional language implementation', 'Type system research'],
      tradeoffs: ['Very small hiring pool', 'Lazy evaluation pitfalls', 'Limited industry adoption'],
    },
  },
  'database': {
    rust: {
      overall: 90, perf: 98, eco: 60, dx: 60, maint: 95, hire: 42,
      reasoning: 'Rust is ideal for database engines. Memory safety prevents data corruption, and performance rivals C/C++. TiKV, SurrealDB, and Neon use Rust.',
      libs: ['RocksDB bindings', 'sled', 'redb', 'tokio'],
      repos: ['tikv/tikv', 'surrealdb/surrealdb'],
      bestFor: ['Storage engines', 'Embedded databases', 'Distributed databases'],
      tradeoffs: ['Complex async patterns', 'Unsafe sometimes needed', 'Fewer DB-specific libraries'],
    },
    cpp: {
      overall: 88, perf: 97, eco: 85, dx: 48, maint: 70, hire: 70,
      reasoning: 'Most production databases are C++ (MySQL, PostgreSQL parts, ClickHouse, RocksDB). Proven patterns and deep ecosystem.',
      libs: ['RocksDB', 'LevelDB', 'Boost.Asio'],
      repos: ['facebook/rocksdb', 'ClickHouse/ClickHouse'],
      bestFor: ['Production OLAP/OLTP', 'Key-value stores', 'Query engines'],
      tradeoffs: ['Memory safety risk', 'Complex codebase', 'Hard to attract contributors'],
    },
    go: {
      overall: 80, perf: 82, eco: 72, dx: 85, maint: 85, hire: 78,
      reasoning: 'Go is used for databases like CockroachDB, Dgraph, and BoltDB. Good balance of performance and development speed.',
      libs: ['bbolt', 'badger', 'ristretto'],
      repos: ['cockroachdb/cockroach', 'dgraph-io/dgraph'],
      bestFor: ['Distributed databases', 'Graph databases', 'Operational databases'],
      tradeoffs: ['GC pauses in write-heavy loads', 'Less control than C/Rust', 'Higher memory usage'],
    },
  },
  'networking': {
    rust: {
      overall: 92, perf: 98, eco: 72, dx: 65, maint: 92, hire: 45,
      reasoning: 'Rust with Tokio is outstanding for networking. Zero-cost async, memory safety for protocol handling, and high throughput for proxies and load balancers.',
      libs: ['Tokio', 'hyper', 'quinn', 'tonic', 'tower', 'mio'],
      repos: ['tokio-rs/tokio', 'cloudflare/quiche'],
      bestFor: ['Proxies', 'Protocol implementations', 'High-throughput servers'],
      tradeoffs: ['Complex async code', 'Steeper onboarding', 'Fewer networking tutorials'],
    },
    go: {
      overall: 88, perf: 85, eco: 80, dx: 88, maint: 88, hire: 80,
      reasoning: 'Go is a natural fit for networking. goroutines simplify concurrent connections, and the net package is excellent. Powers Docker, K8s, and Traefik.',
      libs: ['net/http', 'gRPC', 'quic-go', 'netlink'],
      repos: ['traefik/traefik', 'mholt/caddy'],
      bestFor: ['Network services', 'Service mesh', 'VPN and tunneling'],
      tradeoffs: ['GC pressure under load', 'Less zero-copy support', 'Higher latency tail'],
    },
    c: {
      overall: 82, perf: 97, eco: 80, dx: 40, maint: 55, hire: 65,
      reasoning: 'C remains the foundation of networking. Linux kernel networking, nginx, HAProxy are all C. Maximum control and minimal overhead.',
      libs: ['libevent', 'libev', 'libuv', 'openssl'],
      repos: ['nginx/nginx', 'haproxy/haproxy'],
      bestFor: ['Kernel networking', 'eBPF programs', 'Protocol stacks'],
      tradeoffs: ['Memory safety risks', 'Manual buffer management', 'Harder to maintain'],
    },
  },
  'ml-inference': {
    rust: {
      overall: 88, perf: 97, eco: 60, dx: 60, maint: 92, hire: 40,
      reasoning: 'Rust is excellent for ML inference at the edge and in production. Candle and ONNX Runtime bindings provide efficient model serving.',
      libs: ['Candle', 'ort (ONNX Runtime)', 'tch-rs', 'tract'],
      repos: ['huggingface/candle', 'pykeio/ort'],
      bestFor: ['Edge inference', 'Low-latency serving', 'Embedded ML'],
      tradeoffs: ['Fewer pre-trained models', 'Less tooling than Python', 'Complex model loading'],
    },
    python: {
      overall: 85, perf: 55, eco: 98, dx: 90, maint: 80, hire: 95,
      reasoning: 'Python with TensorRT, ONNX, and vLLM is the standard for model serving. Fastest path from training to deployment.',
      libs: ['vLLM', 'TensorRT', 'ONNX Runtime', 'Triton', 'BentoML'],
      repos: ['vllm-project/vllm', 'triton-inference-server/server'],
      bestFor: ['LLM serving', 'Model APIs', 'Batch inference'],
      tradeoffs: ['Higher latency', 'More memory usage', 'Requires GPU libraries'],
    },
    cpp: {
      overall: 82, perf: 98, eco: 70, dx: 40, maint: 65, hire: 55,
      reasoning: 'C++ powers inference runtimes like TensorRT and ONNX Runtime core. Used when maximum throughput and minimum latency are essential.',
      libs: ['TensorRT', 'ONNX Runtime (C++)', 'llama.cpp', 'TVM'],
      repos: ['ggerganov/llama.cpp', 'microsoft/onnxruntime'],
      bestFor: ['Custom inference engines', 'Mobile inference', 'GPU optimization'],
      tradeoffs: ['Very slow development', 'Complex debugging', 'Memory management burden'],
    },
  },
};

function getMigrationComplexity(
  from: ProgrammingLanguage,
  to: ProgrammingLanguage,
): 'trivial' | 'moderate' | 'significant' | 'massive' {
  if (from === to) return 'trivial';
  const similar: Record<string, ProgrammingLanguage[]> = {
    js: ['typescript', 'javascript'],
    jvm: ['java', 'kotlin', 'scala'],
    systems: ['c', 'cpp', 'rust', 'zig'],
    ml: ['python', 'rust'],
    mobile: ['swift', 'kotlin'],
    functional: ['haskell', 'ocaml', 'elixir', 'scala'],
  };
  for (const group of Object.values(similar)) {
    if (group.includes(from) && group.includes(to)) return 'moderate';
  }
  const hardPairs = new Set([
    'python->rust', 'python->c', 'python->cpp',
    'javascript->rust', 'javascript->c',
    'ruby->rust', 'ruby->c', 'ruby->go',
    'php->rust', 'php->go',
  ]);
  if (hardPairs.has(`${from}->${to}`)) return 'massive';
  return 'significant';
}

function generateAnalysis(
  category: ProjectCategory,
  currentLang: ProgrammingLanguage | null,
  projectName: string,
): CodebaseAnalysis {
  const catScores = CATEGORY_SCORES[category] || {};
  const scores: LanguageFitScore[] = [];

  for (const [lang, data] of Object.entries(catScores)) {
    const pl = lang as ProgrammingLanguage;
    scores.push({
      language: pl,
      overallScore: data.overall,
      performanceScore: data.perf,
      ecosystemScore: data.eco,
      devExperienceScore: data.dx,
      maintainabilityScore: data.maint,
      hiringPoolScore: data.hire,
      reasoning: data.reasoning,
      bestFor: data.bestFor,
      tradeoffs: data.tradeoffs,
      recommendedLibs: data.libs,
      recommendedRepos: data.repos,
    });
  }

  scores.sort((a, b) => b.overallScore - a.overallScore);
  const topLang = scores[0]?.language || 'typescript';
  const effectiveCurrent = currentLang || topLang;

  const catLabel = CATEGORIES.find((c) => c.key === category)?.label || category;
  const topName = LANGUAGE_LABELS[topLang]?.name || topLang;

  return {
    id: `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    projectName: projectName || `${catLabel} Project`,
    currentLanguage: effectiveCurrent,
    category,
    scores,
    topRecommendation: topLang,
    migrationComplexity: getMigrationComplexity(effectiveCurrent, topLang),
    estimatedFiles: Math.floor(Math.random() * 500) + 50,
    aiSummary: `For ${catLabel.toLowerCase()} projects, ${topName} scores highest at ${scores[0]?.overallScore}/100. ${scores[0]?.reasoning.split('.')[0]}.`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function ScoreBar({
  label,
  value,
  color,
  isDark,
}: {
  label: string;
  value: number;
  color: string;
  isDark: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
      <span
        style={{
          fontSize: '0.6875rem',
          width: '5.5rem',
          flexShrink: 0,
          color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
          letterSpacing: '-0.01em',
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: '0.375rem',
          borderRadius: '0.25rem',
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: CUPERTINO_EASING as unknown as Easing }}
          style={{
            height: '100%',
            borderRadius: '0.25rem',
            background: color,
          }}
        />
      </div>
      <span
        style={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          width: '1.75rem',
          textAlign: 'right',
          color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function LanguageResultCard({
  score,
  rank,
  isTop,
  isCurrentLang,
  isDark,
  expanded,
  onToggle,
}: {
  score: LanguageFitScore;
  rank: number;
  isTop: boolean;
  isCurrentLang: boolean;
  isDark: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const langInfo = LANGUAGE_LABELS[score.language];
  const overallColor =
    score.overallScore >= 85 ? '#34D399' : score.overallScore >= 70 ? '#FBBF24' : '#F87171';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: CUPERTINO_EASING as unknown as Easing }}
      style={{
        background: isTop
          ? isDark
            ? 'rgba(139,124,246,0.08)'
            : 'rgba(139,124,246,0.06)'
          : isDark
            ? 'rgba(255,255,255,0.03)'
            : 'rgba(0,0,0,0.02)',
        border: `1px solid ${
          isTop
            ? isDark
              ? 'rgba(139,124,246,0.25)'
              : 'rgba(139,124,246,0.2)'
            : isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(0,0,0,0.06)'
        }`,
        borderRadius: '1rem',
        padding: '1rem 1.25rem',
        cursor: 'pointer',
        transition: 'border-color 0.2s, background 0.2s',
      }}
      onClick={onToggle}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Rank badge */}
        <div
          style={{
            width: '1.75rem',
            height: '1.75rem',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: isTop
              ? 'rgba(139,124,246,0.2)'
              : isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(0,0,0,0.06)',
            color: isTop
              ? '#8B7CF6'
              : isDark
                ? 'rgba(255,255,255,0.4)'
                : 'rgba(0,0,0,0.4)',
            flexShrink: 0,
          }}
        >
          {rank}
        </div>

        {/* Language dot + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          <div
            style={{
              width: '0.625rem',
              height: '0.625rem',
              borderRadius: '50%',
              background: langInfo.color,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontWeight: 600,
              fontSize: '0.9375rem',
              letterSpacing: '-0.02em',
              color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)',
            }}
          >
            {langInfo.name}
          </span>
          {isTop && (
            <span
              style={{
                fontSize: '0.625rem',
                fontWeight: 600,
                padding: '0.125rem 0.5rem',
                borderRadius: '1rem',
                background: 'rgba(139,124,246,0.15)',
                color: '#8B7CF6',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              Recommended
            </span>
          )}
          {isCurrentLang && !isTop && (
            <span
              style={{
                fontSize: '0.625rem',
                fontWeight: 600,
                padding: '0.125rem 0.5rem',
                borderRadius: '1rem',
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              Current
            </span>
          )}
        </div>

        {/* Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: overallColor,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}
          >
            {score.overallScore}
          </span>
          <span
            style={{
              fontSize: '0.6875rem',
              color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
            }}
          >
            /100
          </span>
          {expanded ? (
            <ChevronUpIcon
              style={{
                width: '0.875rem',
                height: '0.875rem',
                color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
              }}
            />
          ) : (
            <ChevronDownIcon
              style={{
                width: '0.875rem',
                height: '0.875rem',
                color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
              }}
            />
          )}
        </div>
      </div>

      {/* Overall score bar */}
      <div style={{ marginTop: '0.75rem' }}>
        <div
          style={{
            height: '0.25rem',
            borderRadius: '0.25rem',
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score.overallScore}%` }}
            transition={{ duration: 0.8, ease: CUPERTINO_EASING as unknown as Easing, delay: rank * 0.05 }}
            style={{
              height: '100%',
              borderRadius: '0.25rem',
              background: `linear-gradient(90deg, ${overallColor}88, ${overallColor})`,
            }}
          />
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: CUPERTINO_EASING as unknown as Easing }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: '1rem' }}>
              {/* Reasoning */}
              <p
                style={{
                  fontSize: '0.8125rem',
                  lineHeight: 1.6,
                  color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
                  marginBottom: '1rem',
                }}
              >
                {score.reasoning}
              </p>

              {/* Sub-scores */}
              <div style={{ marginBottom: '1rem' }}>
                <ScoreBar label="Performance" value={score.performanceScore} color="#E07850" isDark={isDark} />
                <ScoreBar label="Ecosystem" value={score.ecosystemScore} color="#8B7CF6" isDark={isDark} />
                <ScoreBar label="Dev Experience" value={score.devExperienceScore} color="#22D3EE" isDark={isDark} />
                <ScoreBar label="Maintainability" value={score.maintainabilityScore} color="#34D399" isDark={isDark} />
                <ScoreBar label="Hiring Pool" value={score.hiringPoolScore} color="#FBBF24" isDark={isDark} />
              </div>

              {/* Best for */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    marginBottom: '0.375rem',
                  }}
                >
                  <StarIcon
                    style={{
                      width: '0.75rem',
                      height: '0.75rem',
                      color: '#34D399',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Best For
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {score.bestFor.map((item) => (
                    <span
                      key={item}
                      style={{
                        fontSize: '0.6875rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '0.5rem',
                        background: isDark ? 'rgba(52,211,153,0.1)' : 'rgba(52,211,153,0.08)',
                        color: '#34D399',
                        fontWeight: 500,
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tradeoffs */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    marginBottom: '0.375rem',
                  }}
                >
                  <AlertTriangleIcon
                    style={{
                      width: '0.75rem',
                      height: '0.75rem',
                      color: '#FBBF24',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Tradeoffs
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {score.tradeoffs.map((item) => (
                    <span
                      key={item}
                      style={{
                        fontSize: '0.6875rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '0.5rem',
                        background: isDark ? 'rgba(251,191,36,0.1)' : 'rgba(251,191,36,0.08)',
                        color: '#FBBF24',
                        fontWeight: 500,
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Libraries & Repos */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  marginTop: '0.75rem',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      marginBottom: '0.375rem',
                    }}
                  >
                    <PackageIcon
                      style={{
                        width: '0.75rem',
                        height: '0.75rem',
                        color: '#8B7CF6',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Libraries
                    </span>
                  </div>
                  {score.recommendedLibs.map((lib) => (
                    <div
                      key={lib}
                      style={{
                        fontSize: '0.75rem',
                        color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                        padding: '0.125rem 0',
                      }}
                    >
                      {lib}
                    </div>
                  ))}
                </div>
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      marginBottom: '0.375rem',
                    }}
                  >
                    <CodeIcon
                      style={{
                        width: '0.75rem',
                        height: '0.75rem',
                        color: '#E07850',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Repos
                    </span>
                  </div>
                  {score.recommendedRepos.map((repo) => (
                    <div
                      key={repo}
                      style={{
                        fontSize: '0.75rem',
                        color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                        padding: '0.125rem 0',
                      }}
                    >
                      {repo}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════════

type Step = 'category' | 'language' | 'results';

export default function CodeAnalyzerPage() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? resolvedTheme === 'dark' : true;

  // Store
  const programmingEnabled = usePFCStore((s) => s.programmingEnabled);
  const codebaseAnalyses = usePFCStore((s) => s.codebaseAnalyses);
  const addCodebaseAnalysis = usePFCStore((s) => s.addCodebaseAnalysis);
  const removeCodebaseAnalysis = usePFCStore((s) => s.removeCodebaseAnalysis);

  // Local state
  const [step, setStep] = useState<Step>('category');
  const [selectedCategory, setSelectedCategory] = useState<ProjectCategory | null>(null);
  const [currentLang, setCurrentLang] = useState<ProgrammingLanguage | null>(null);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [analysis, setAnalysis] = useState<CodebaseAnalysis | null>(null);
  const [expandedLang, setExpandedLang] = useState<ProgrammingLanguage | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Gate check
  if (!programmingEnabled) {
    return (
      <PageShell
        icon={CodeIcon}
        iconColor="var(--color-pfc-violet)"
        title="Code Language Analyzer"
        subtitle="Programming Suite tool"
      >
        <GlassSection>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '60vh',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                height: '4rem',
                width: '4rem',
                borderRadius: '1.25rem',
                background: isDark ? 'rgba(139,124,246,0.1)' : 'rgba(139,124,246,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <CodeIcon
                style={{
                  height: '2rem',
                  width: '2rem',
                  color: 'rgba(139,124,246,0.4)',
                }}
              />
            </div>
            <h2
              style={{
                fontSize: '1.125rem',
                fontWeight: 650,
                letterSpacing: '-0.02em',
                marginBottom: '0.375rem',
              }}
            >
              Programming Suite Required
            </h2>
            <p
              style={{
                fontSize: '0.8125rem',
                color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                maxWidth: '24rem',
                lineHeight: 1.6,
              }}
            >
              The Code Language Analyzer is part of the Programming Suite.
              Enable the Programming or Full tier in Settings to access code analysis tools.
            </p>
          </div>
        </GlassSection>
      </PageShell>
    );
  }

  const handleCategorySelect = (cat: ProjectCategory) => {
    setSelectedCategory(cat);
    setStep('language');
    setAnalysis(null);
    setExpandedLang(null);
  };

  const handleRunAnalysis = () => {
    if (!selectedCategory) return;
    const result = generateAnalysis(selectedCategory, currentLang, projectName);
    setAnalysis(result);
    addCodebaseAnalysis(result);
    setStep('results');
    setExpandedLang(result.topRecommendation);
  };

  const handleSkipLanguage = () => {
    setCurrentLang(null);
    setShowLangPicker(false);
    handleRunAnalysis();
  };

  const handleReset = () => {
    setStep('category');
    setSelectedCategory(null);
    setCurrentLang(null);
    setShowLangPicker(false);
    setProjectName('');
    setAnalysis(null);
    setExpandedLang(null);
  };

  const handleLoadAnalysis = (a: CodebaseAnalysis) => {
    setAnalysis(a);
    setSelectedCategory(a.category);
    setCurrentLang(a.currentLanguage);
    setProjectName(a.projectName);
    setStep('results');
    setShowHistory(false);
    setExpandedLang(a.topRecommendation);
  };

  return (
    <PageShell
      icon={CodeIcon}
      iconColor="var(--color-pfc-violet)"
      title="Code Language Analyzer"
      subtitle="Find the optimal programming language for your project category"
    >
      {/* ── Top controls ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {step !== 'category' && (
            <GlassBubbleButton color="neutral" size="sm" onClick={handleReset}>
              <XIcon style={{ width: '0.75rem', height: '0.75rem' }} />
              New Analysis
            </GlassBubbleButton>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {codebaseAnalyses.length > 0 && (
            <GlassBubbleButton
              color="violet"
              size="sm"
              active={showHistory}
              onClick={() => setShowHistory(!showHistory)}
            >
              <HistoryIcon style={{ width: '0.75rem', height: '0.75rem' }} />
              History ({codebaseAnalyses.length})
            </GlassBubbleButton>
          )}
        </div>
      </div>

      {/* ── Analysis History Panel ── */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: CUPERTINO_EASING as unknown as Easing }}
            style={{ overflow: 'hidden' }}
          >
            <GlassSection title="Analysis History">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {codebaseAnalyses.map((a) => {
                  const catInfo = CATEGORIES.find((c) => c.key === a.category);
                  const topLangInfo = LANGUAGE_LABELS[a.topRecommendation];
                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.75rem',
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onClick={() => handleLoadAnalysis(a)}
                    >
                      <div
                        style={{
                          width: '0.5rem',
                          height: '0.5rem',
                          borderRadius: '50%',
                          background: topLangInfo?.color || '#8B7CF6',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                            color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {a.projectName}
                        </div>
                        <div
                          style={{
                            fontSize: '0.6875rem',
                            color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <span>{catInfo?.label || a.category}</span>
                          <span style={{ opacity: 0.4 }}>|</span>
                          <span style={{ color: topLangInfo?.color }}>{topLangInfo?.name}</span>
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: '0.625rem',
                          color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <ClockIcon style={{ width: '0.625rem', height: '0.625rem' }} />
                        {new Date(a.timestamp).toLocaleDateString()}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCodebaseAnalysis(a.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.25rem',
                          borderRadius: '0.375rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                          transition: 'color 0.15s',
                        }}
                      >
                        <Trash2Icon style={{ width: '0.75rem', height: '0.75rem' }} />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </GlassSection>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Step 1: Category Selection ── */}
      <AnimatePresence mode="wait">
        {step === 'category' && (
          <motion.div
            key="category-step"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: CUPERTINO_EASING as unknown as Easing }}
          >
            <GlassSection title="Select Project Category">
              {/* Project name input */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                    marginBottom: '0.375rem',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Project Name (optional)
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="My Awesome Project"
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.75rem',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
                    fontSize: '0.8125rem',
                    outline: 'none',
                    transition: 'border-color 0.15s',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Category grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))',
                  gap: '0.625rem',
                }}
              >
                {CATEGORIES.map((cat) => {
                  const CatIcon = cat.icon;
                  const isSelected = selectedCategory === cat.key;
                  return (
                    <motion.div
                      key={cat.key}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleCategorySelect(cat.key)}
                      style={{
                        padding: '0.875rem 1rem',
                        borderRadius: '0.875rem',
                        cursor: 'pointer',
                        background: isSelected
                          ? isDark
                            ? 'rgba(139,124,246,0.12)'
                            : 'rgba(139,124,246,0.08)'
                          : isDark
                            ? 'rgba(255,255,255,0.03)'
                            : 'rgba(0,0,0,0.02)',
                        border: `1px solid ${
                          isSelected
                            ? 'rgba(139,124,246,0.3)'
                            : isDark
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(0,0,0,0.06)'
                        }`,
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
                        <CatIcon
                          style={{
                            width: '1rem',
                            height: '1rem',
                            color: isSelected ? '#8B7CF6' : isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                            color: isSelected
                              ? '#8B7CF6'
                              : isDark
                                ? 'rgba(255,255,255,0.75)'
                                : 'rgba(0,0,0,0.75)',
                          }}
                        >
                          {cat.label}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: '0.6875rem',
                          color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                          lineHeight: 1.4,
                          marginLeft: '1.625rem',
                        }}
                      >
                        {cat.description}
                      </p>
                    </motion.div>
                  );
                })}
              </div>
            </GlassSection>
          </motion.div>
        )}

        {/* ── Step 2: Current Language (optional) ── */}
        {step === 'language' && (
          <motion.div
            key="language-step"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: CUPERTINO_EASING as unknown as Easing }}
          >
            <GlassSection title="Current Language (Optional)">
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
                  marginBottom: '1rem',
                  lineHeight: 1.6,
                }}
              >
                If you have an existing codebase, select its primary language to see migration complexity estimates. Otherwise, skip to see fresh recommendations.
              </p>

              {/* Selected category badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '0.625rem',
                  background: isDark ? 'rgba(139,124,246,0.1)' : 'rgba(139,124,246,0.08)',
                  marginBottom: '1.25rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#8B7CF6',
                }}
              >
                {(() => {
                  const catInfo = CATEGORIES.find((c) => c.key === selectedCategory);
                  const CatIcon = catInfo?.icon || CodeIcon;
                  return (
                    <>
                      <CatIcon style={{ width: '0.75rem', height: '0.75rem' }} />
                      {catInfo?.label || selectedCategory}
                    </>
                  );
                })()}
              </div>

              {/* Toggle picker */}
              {!showLangPicker ? (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <GlassBubbleButton color="violet" size="md" onClick={() => setShowLangPicker(true)}>
                    <CodeIcon style={{ width: '0.875rem', height: '0.875rem' }} />
                    Select Current Language
                  </GlassBubbleButton>
                  <GlassBubbleButton color="green" size="md" onClick={handleSkipLanguage}>
                    <SparklesIcon style={{ width: '0.875rem', height: '0.875rem' }} />
                    Skip &mdash; Fresh Recommendations
                  </GlassBubbleButton>
                </div>
              ) : (
                <>
                  {/* Language grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))',
                      gap: '0.5rem',
                      marginBottom: '1rem',
                    }}
                  >
                    {ALL_LANGUAGES.map((lang) => {
                      const info = LANGUAGE_LABELS[lang];
                      const isSelected = currentLang === lang;
                      return (
                        <motion.div
                          key={lang}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => setCurrentLang(lang)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.625rem',
                            cursor: 'pointer',
                            background: isSelected
                              ? isDark
                                ? 'rgba(139,124,246,0.12)'
                                : 'rgba(139,124,246,0.08)'
                              : isDark
                                ? 'rgba(255,255,255,0.03)'
                                : 'rgba(0,0,0,0.02)',
                            border: `1px solid ${
                              isSelected
                                ? 'rgba(139,124,246,0.3)'
                                : isDark
                                  ? 'rgba(255,255,255,0.06)'
                                  : 'rgba(0,0,0,0.06)'
                            }`,
                            transition: 'background 0.15s, border-color 0.15s',
                          }}
                        >
                          <div
                            style={{
                              width: '0.5rem',
                              height: '0.5rem',
                              borderRadius: '50%',
                              background: info.color,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: isSelected ? 600 : 450,
                              color: isSelected
                                ? '#8B7CF6'
                                : isDark
                                  ? 'rgba(255,255,255,0.6)'
                                  : 'rgba(0,0,0,0.6)',
                            }}
                          >
                            {info.name}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Run button */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <GlassBubbleButton
                      color="violet"
                      size="lg"
                      onClick={handleRunAnalysis}
                      disabled={!selectedCategory}
                    >
                      <ZapIcon style={{ width: '0.875rem', height: '0.875rem' }} />
                      Run Analysis
                      {currentLang && (
                        <span style={{ opacity: 0.6 }}>
                          ({LANGUAGE_LABELS[currentLang].name})
                        </span>
                      )}
                    </GlassBubbleButton>
                    <GlassBubbleButton color="neutral" size="lg" onClick={handleSkipLanguage}>
                      Skip
                    </GlassBubbleButton>
                  </div>
                </>
              )}
            </GlassSection>
          </motion.div>
        )}

        {/* ── Step 3: Results ── */}
        {step === 'results' && analysis && (
          <motion.div
            key="results-step"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: CUPERTINO_EASING as unknown as Easing }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          >
            {/* Summary card */}
            <GlassSection>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <h3
                      style={{
                        fontSize: '1.125rem',
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        marginBottom: '0.25rem',
                        color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)',
                      }}
                    >
                      {analysis.projectName}
                    </h3>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.75rem',
                        color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                      }}
                    >
                      <span>{CATEGORIES.find((c) => c.key === analysis.category)?.label}</span>
                      {currentLang && (
                        <>
                          <span style={{ opacity: 0.4 }}>|</span>
                          <span>
                            Current: {LANGUAGE_LABELS[analysis.currentLanguage]?.name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.875rem',
                      borderRadius: '0.75rem',
                      background: isDark ? 'rgba(139,124,246,0.1)' : 'rgba(139,124,246,0.08)',
                      border: '1px solid rgba(139,124,246,0.2)',
                    }}
                  >
                    <div
                      style={{
                        width: '0.625rem',
                        height: '0.625rem',
                        borderRadius: '50%',
                        background: LANGUAGE_LABELS[analysis.topRecommendation]?.color || '#8B7CF6',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 650,
                        color: '#8B7CF6',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {LANGUAGE_LABELS[analysis.topRecommendation]?.name}
                    </span>
                    <span
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: '#34D399',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {analysis.scores[0]?.overallScore}
                    </span>
                  </div>
                </div>

                {/* AI summary */}
                <p
                  style={{
                    fontSize: '0.8125rem',
                    lineHeight: 1.65,
                    color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                  }}
                >
                  {analysis.aiSummary}
                </p>

                {/* Migration complexity */}
                {currentLang && currentLang !== analysis.topRecommendation && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.75rem',
                      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    }}
                  >
                    <ArrowRightIcon
                      style={{
                        width: '1rem',
                        height: '1rem',
                        color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                          marginBottom: '0.125rem',
                        }}
                      >
                        Migration: {LANGUAGE_LABELS[analysis.currentLanguage]?.name}{' '}
                        <span style={{ opacity: 0.4 }}>&rarr;</span>{' '}
                        {LANGUAGE_LABELS[analysis.topRecommendation]?.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.6875rem',
                          color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
                        }}
                      >
                        Complexity:{' '}
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              analysis.migrationComplexity === 'trivial'
                                ? '#34D399'
                                : analysis.migrationComplexity === 'moderate'
                                  ? '#FBBF24'
                                  : analysis.migrationComplexity === 'significant'
                                    ? '#E07850'
                                    : '#F87171',
                          }}
                        >
                          {analysis.migrationComplexity.charAt(0).toUpperCase() +
                            analysis.migrationComplexity.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </GlassSection>

            {/* Ranked results */}
            <GlassSection title="Language Rankings">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {analysis.scores.map((score, idx) => (
                  <LanguageResultCard
                    key={score.language}
                    score={score}
                    rank={idx + 1}
                    isTop={idx === 0}
                    isCurrentLang={currentLang === score.language}
                    isDark={isDark}
                    expanded={expandedLang === score.language}
                    onToggle={() =>
                      setExpandedLang(
                        expandedLang === score.language ? null : score.language,
                      )
                    }
                  />
                ))}
              </div>
            </GlassSection>

            {/* Score legend */}
            <GlassSection title="Score Dimensions">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(13rem, 1fr))',
                  gap: '0.75rem',
                }}
              >
                {[
                  { icon: ZapIcon, label: 'Performance', color: '#E07850', desc: 'Raw speed, memory usage, throughput' },
                  { icon: PackageIcon, label: 'Ecosystem', color: '#8B7CF6', desc: 'Libraries, frameworks, community size' },
                  { icon: SparklesIcon, label: 'Dev Experience', color: '#22D3EE', desc: 'Tooling, IDE support, debugging' },
                  { icon: ShieldCheckIcon, label: 'Maintainability', color: '#34D399', desc: 'Type safety, refactoring, readability' },
                  { icon: UsersIcon, label: 'Hiring Pool', color: '#FBBF24', desc: 'Available talent, learning resources' },
                ].map((dim) => {
                  const DimIcon = dim.icon;
                  return (
                    <div
                      key={dim.label}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        padding: '0.625rem 0.75rem',
                        borderRadius: '0.75rem',
                        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                      }}
                    >
                      <DimIcon
                        style={{
                          width: '0.875rem',
                          height: '0.875rem',
                          color: dim.color,
                          marginTop: '0.125rem',
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                            marginBottom: '0.125rem',
                          }}
                        >
                          {dim.label}
                        </div>
                        <div
                          style={{
                            fontSize: '0.6875rem',
                            color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
                            lineHeight: 1.4,
                          }}
                        >
                          {dim.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassSection>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}
