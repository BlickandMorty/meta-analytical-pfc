'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainIcon,
  ZapIcon,
  ExpandIcon,
  ShrinkIcon,
  BookOpenIcon,
  RefreshCwIcon,
} from 'lucide-react';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { GlassBubbleButton } from '@/components/glass-bubble-button';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { PageShell, GlassSection } from '@/components/layout/page-shell';
import { PixelBook } from '@/components/pixel-book';
import { useIsDark } from '@/hooks/use-is-dark';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PALETTE = [
  '#8B7CF6', // violet
  '#22D3EE', // cyan
  '#34D399', // green
  '#F59E0B', // amber
  '#EC4899', // pink
  '#6366F1', // indigo
  '#14B8A6', // teal
  '#F97316', // orange
];

const CENTER_COLOR = '#C15F3C'; // ember

// ---------------------------------------------------------------------------
// Force-directed layout helpers
// ---------------------------------------------------------------------------

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isCenter: boolean;
  orbitAngle: number;
  orbitSpeed: number;
}

interface GraphEdge {
  source: string;
  target: string;
  strength: number;
}

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  };
}

function buildGraph(concepts: string[], confidence: number, entropy: number): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Center node — small anchor dot
  nodes.push({
    id: '__center__',
    label: 'Core',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 5,
    color: CENTER_COLOR,
    isCenter: true,
    orbitAngle: 0,
    orbitSpeed: 0,
  });

  concepts.forEach((concept, i) => {
    const rand = seededRandom(concept);
    const angle = (Math.PI * 2 * i) / Math.max(concepts.length, 1);
    // Scale orbit distance based on concept count so the graph breathes
    const baseDist = concepts.length > 12 ? 120 : concepts.length > 6 ? 100 : 80;
    const dist = baseDist + rand() * 50;
    // Format label: underscores to spaces, proper casing
    const label = concept.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    nodes.push({
      id: concept,
      label,
      x: Math.cos(angle) * dist + (rand() - 0.5) * 20,
      y: Math.sin(angle) * dist + (rand() - 0.5) * 20,
      vx: 0,
      vy: 0,
      radius: 3.5 + rand() * 3,
      color: PALETTE[i % PALETTE.length]!,
      isCenter: false,
      orbitAngle: angle,
      orbitSpeed: 0.0002 + rand() * 0.0003,
    });

    // Connect every concept to center
    edges.push({ source: '__center__', target: concept, strength: 0.3 + confidence * 0.4 });
  });

  // Cross-connections: use seeded hash to create a deterministic web
  // Each concept connects to 1-3 neighbors based on string similarity
  for (let i = 0; i < concepts.length; i++) {
    const rand = seededRandom(concepts[i]! + '__edges');
    const connectionCount = Math.min(1 + Math.floor(rand() * 2.5), concepts.length - 1);
    for (let c = 0; c < connectionCount; c++) {
      // Pick a target that's not self, using seeded offset
      const offset = 1 + Math.floor(rand() * (concepts.length - 1));
      const j = (i + offset) % concepts.length;
      if (j === i) continue;
      // Avoid duplicate edges (check both directions)
      const exists = edges.some(
        (e) =>
          (e.source === concepts[i] && e.target === concepts[j]) ||
          (e.source === concepts[j] && e.target === concepts[i]),
      );
      if (!exists) {
        edges.push({
          source: concepts[i]!,
          target: concepts[j]!,
          strength: 0.15 + rand() * 0.25 + entropy * 0.15,
        });
      }
    }
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Enhanced Animated Canvas
// ---------------------------------------------------------------------------

function ConceptCanvas({
  concepts,
  confidence,
  entropy,
  isProcessing,
  expanded,
}: {
  concepts: string[];
  confidence: number;
  entropy: number;
  isProcessing: boolean;
  expanded: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const animRef = useRef<number>(0);
  const drawRef = useRef<() => void>(() => {});
  const timeRef = useRef(0);
  const frameSkipRef = useRef(false);
  const tabHiddenRef = useRef(document.hidden);
  // Cached canvas dimensions from ResizeObserver — avoids getBoundingClientRect per frame
  const atlasSizeRef = useRef({ w: 0, h: 0 });

  const graphKey = concepts.join('|');
  useEffect(() => {
    graphRef.current = buildGraph(concepts, confidence, entropy);
  }, [graphKey, confidence, entropy]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const queueNextFrame = () => {
      animRef.current = requestAnimationFrame(() => drawRef.current());
    };

    // Skip when tab hidden
    if (tabHiddenRef.current) { queueNextFrame(); return; }

    // 30fps throttle
    frameSkipRef.current = !frameSkipRef.current;
    if (frameSkipRef.current) { queueNextFrame(); return; }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = atlasSizeRef.current.w;
    const H = atlasSizeRef.current.h;
    if (W === 0 || H === 0) { queueNextFrame(); return; }

    const targetW = Math.round(W * dpr);
    const targetH = Math.round(H * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = W / 2;
    const cy = H / 2;

    timeRef.current += 0.016;
    const t = timeRef.current;

    const { nodes, edges } = graphRef.current;

    // Build node lookup
    const nodeMap = new Map<string, GraphNode>();
    for (const n of nodes) nodeMap.set(n.id, n);

    // ── Force simulation step (tuned for Obsidian-style tight web) ──
    const repulsion = 2200;
    const attraction = 0.006;
    const damping = 0.88;
    const centerGravity = 0.01;

    for (let i = 0; i < nodes.length; i++) {
      const ni = nodes[i]!;
      if (ni.isCenter) continue;
      let fx = 0, fy = 0;

      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const nj = nodes[j]!;
        const dx = ni.x - nj.x;
        const dy = ni.y - nj.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }

      for (const edge of edges) {
        const a = nodeMap.get(edge.source);
        const b = nodeMap.get(edge.target);
        if (!a || !b) continue;
        if (a.id !== ni.id && b.id !== ni.id) continue;
        const other = a.id === ni.id ? b : a;
        const dx = other.x - ni.x;
        const dy = other.y - ni.y;
        fx += dx * attraction * edge.strength;
        fy += dy * attraction * edge.strength;
      }

      fx -= ni.x * centerGravity;
      fy -= ni.y * centerGravity;

      // Gentle ambient drift (barely perceptible — Obsidian-style calm)
      ni.orbitAngle += ni.orbitSpeed;
      fx += Math.cos(ni.orbitAngle + t * 0.05) * 0.03;
      fy += Math.sin(ni.orbitAngle + t * 0.05) * 0.03;

      if (isProcessing) {
        fx += Math.sin(t * 2 + i) * 0.2;
        fy += Math.cos(t * 2 + i * 0.7) * 0.2;
      }

      ni.vx = (ni.vx + fx) * damping;
      ni.vy = (ni.vy + fy) * damping;
      ni.x += ni.vx;
      ni.y += ni.vy;
    }

    // ══════════════════════════════════════════════════════════
    // RENDER — Obsidian-style clean graph
    // ══════════════════════════════════════════════════════════

    ctx.clearRect(0, 0, W, H);

    // ── Layer 1: Edges — thin, slightly curved lines ──
    for (const edge of edges) {
      const a = nodeMap.get(edge.source);
      const b = nodeMap.get(edge.target);
      if (!a || !b) continue;

      const ax = cx + a.x, ay = cy + a.y;
      const bx = cx + b.x, by = cy + b.y;

      // Subtle curve via offset control point
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const perpX = -(by - ay) * 0.06;
      const perpY = (bx - ax) * 0.06;
      const cpx = mx + perpX;
      const cpy = my + perpY;

      // Center-to-concept edges slightly brighter
      const isRadial = a.isCenter || b.isCenter;
      const alpha = isRadial
        ? 0.12 + edge.strength * 0.15
        : 0.06 + edge.strength * 0.12;

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cpx, cpy, bx, by);
      ctx.strokeStyle = `rgba(160,160,180,${alpha})`;
      ctx.lineWidth = isRadial ? 0.8 : 0.5;
      ctx.stroke();

      // Processing mode: single subtle pulse dot per edge
      if (isProcessing) {
        const phase = ((t * 0.3 + edge.strength * 2) % 1);
        const pt = phase;
        const px = (1 - pt) * (1 - pt) * ax + 2 * (1 - pt) * pt * cpx + pt * pt * bx;
        const py = (1 - pt) * (1 - pt) * ay + 2 * (1 - pt) * pt * cpy + pt * pt * by;
        ctx.beginPath();
        ctx.arc(px, py, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(160,160,180,${alpha + 0.2})`;
        ctx.fill();
      }
    }

    // ── Layer 2: Nodes — small colored dots + clean labels ──
    for (const node of nodes) {
      const nx = cx + node.x;
      const ny = cy + node.y;
      const pulse = node.isCenter
        ? Math.sin(t * 1.5) * 1
        : Math.sin(t * 1.2 + node.x * 0.01) * 0.5;
      const r = node.radius + pulse;

      // Subtle outer glow (1px halo)
      ctx.beginPath();
      ctx.arc(nx, ny, r + 2, 0, Math.PI * 2);
      ctx.fillStyle = node.color + '15';
      ctx.fill();

      // Node dot
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.fillStyle = node.color + (node.isCenter ? 'EE' : 'CC');
      ctx.fill();

      // Label — clean text, no pill background
      const label = node.label.length > 22 ? node.label.slice(0, 21) + '\u2026' : node.label;
      const fontSize = node.isCenter ? 9 : 8;
      ctx.font = `${node.isCenter ? 600 : 400} ${fontSize}px -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const labelY = ny + r + 4;

      // Faint text shadow for readability
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillText(label, nx + 0.5, labelY + 0.5);

      // Label text
      ctx.fillStyle = node.isCenter ? '#FFFFFF' : node.color + 'DD';
      ctx.fillText(label, nx, labelY);
    }

    queueNextFrame();
  }, [isProcessing]);

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;

    // Cache canvas dimensions via ResizeObserver — avoids getBoundingClientRect per frame
    const resizeObs = canvas
      ? new ResizeObserver(([entry]) => {
          const { width, height } = entry!.contentRect;
          atlasSizeRef.current = { w: width, h: height };
        })
      : null;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      atlasSizeRef.current = { w: rect.width, h: rect.height };
      resizeObs?.observe(canvas);
    }

    const onVis = () => { tabHiddenRef.current = document.hidden; };
    document.addEventListener('visibilitychange', onVis);
    animRef.current = requestAnimationFrame(() => drawRef.current());
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      cancelAnimationFrame(animRef.current);
      resizeObs?.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-xl"
      style={{
        height: expanded ? 'calc(100vh - 120px)' : '460px',
        background: 'rgba(0,0,0,0.04)',
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ConceptAtlasPage() {
  const ready = useSetupGuard();
  const { isDark } = useIsDark();
  const activeConcepts = usePFCStore((s) => s.activeConcepts);
  const confidence = usePFCStore((s) => s.confidence);
  const entropy = usePFCStore((s) => s.entropy);
  const harmonyKeyDistance = usePFCStore((s) => s.harmonyKeyDistance);
  const activeChordProduct = usePFCStore((s) => s.activeChordProduct);
  const isProcessing = usePFCStore((s) => s.isProcessing);
  const noteConcepts = usePFCStore((s) => s.concepts);
  const notePages = usePFCStore((s) => s.notePages);
  const extractConcepts = usePFCStore((s) => s.extractConcepts);
  const researchPapers = usePFCStore((s) => s.researchPapers);
  const [expanded, setExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState(true);

  // Merge pipeline concepts with note-derived concepts (deduplicated)
  const mergedConcepts = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];

    // Pipeline concepts first (they're the "live" ones)
    for (const c of activeConcepts) {
      const key = c.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(c);
      }
    }

    // Add note-derived concepts (headings, bold terms, linked entities)
    if (showNotes && noteConcepts.length > 0) {
      for (const nc of noteConcepts) {
        const key = nc.name.toLowerCase();
        if (!seen.has(key) && nc.name.length > 2) {
          seen.add(key);
          result.push(nc.name);
        }
      }
    }

    // Add research paper topics (from titles — extract key terms)
    if (showNotes && researchPapers.length > 0) {
      const stopWords = new Set(['the', 'a', 'an', 'of', 'in', 'and', 'for', 'to', 'on', 'with', 'from', 'by', 'is', 'are', 'was', 'were', 'that', 'this', 'at', 'as', 'or', 'not', 'its', 'has', 'have', 'be', 'been', 'but', 'which', 'their', 'they', 'will', 'can', 'may', 'about']);
      for (const paper of researchPapers.slice(0, 20)) {
        const words = paper.title.split(/\s+/)
          .map(w => w.replace(/[^a-zA-Z-]/g, ''))
          .filter(w => w.length > 4 && !stopWords.has(w.toLowerCase()));
        for (const word of words.slice(0, 3)) {
          const key = word.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            result.push(word);
          }
        }
      }
    }

    return result;
  }, [activeConcepts, noteConcepts, researchPapers, showNotes]);

  // Extract concepts from all note pages on first load (seed the atlas)
  const hasExtracted = useRef(false);
  useEffect(() => {
    if (hasExtracted.current || notePages.length === 0) return;
    hasExtracted.current = true;
    // Extract from up to 20 most recent pages
    const pages = [...notePages]
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 20);
    for (const page of pages) {
      extractConcepts(page.id);
    }
  }, [notePages, extractConcepts]);

  // Count where concepts come from
  const pipelineCount = activeConcepts.length;
  const noteCount = mergedConcepts.length - pipelineCount;

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--chat-surface)]">
        <PixelBook size={40} />
      </div>
    );
  }

  return (
    <PageShell icon={BrainIcon} iconColor="var(--color-pfc-violet)" title="Concept Atlas" subtitle="Live force-directed concept mapping — from your chat, notes & research" backHref="/library?tab=tools">
      <GlassSection title="Force Graph" className={cn('mb-6', expanded ? 'max-w-full' : '')}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-mono gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-pfc-violet inline-block" />
              {mergedConcepts.length} concepts
            </Badge>
            {pipelineCount > 0 && (
              <Badge variant="outline" className="text-[10px] font-mono gap-1" style={{ color: 'var(--color-pfc-ember)' }}>
                <ZapIcon className="h-2.5 w-2.5" /> {pipelineCount} from chat
              </Badge>
            )}
            {noteCount > 0 && (
              <Badge variant="outline" className="text-[10px] font-mono gap-1" style={{ color: 'var(--color-pfc-green)' }}>
                <BookOpenIcon className="h-2.5 w-2.5" /> {noteCount} from notes
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] font-mono">
              Harmony {(1 - harmonyKeyDistance).toFixed(2)}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Toggle note concepts */}
            <div title={showNotes ? 'Hide note concepts' : 'Show note concepts'}>
              <GlassBubbleButton
                color={showNotes ? 'green' : 'violet'}
                size="sm"
                onClick={() => setShowNotes(!showNotes)}
              >
                <BookOpenIcon className="h-3.5 w-3.5" />
              </GlassBubbleButton>
            </div>
            {/* Re-extract from notes */}
            <div title="Re-extract concepts from notes">
              <GlassBubbleButton
                color="violet"
                size="sm"
                onClick={() => {
                  const pages = [...notePages]
                    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
                    .slice(0, 20);
                  for (const page of pages) {
                    extractConcepts(page.id);
                  }
                }}
              >
                <RefreshCwIcon className="h-3.5 w-3.5" />
              </GlassBubbleButton>
            </div>
            <GlassBubbleButton
              color="violet"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ShrinkIcon className="h-3.5 w-3.5" /> : <ExpandIcon className="h-3.5 w-3.5" />}
            </GlassBubbleButton>
          </div>
        </div>

        <div className="relative rounded-xl overflow-hidden">
          {mergedConcepts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <BrainIcon className="h-10 w-10 text-muted-foreground/20 mb-4" />
              <p className="text-sm text-muted-foreground/50">No active concepts yet</p>
              <p className="text-xs text-muted-foreground/30 mt-1">
                Ask a research question or add notes about your topics to see concepts map out
              </p>
            </div>
          ) : (
            <ConceptCanvas
              concepts={mergedConcepts}
              confidence={confidence}
              entropy={entropy}
              isProcessing={isProcessing}
              expanded={expanded}
            />
          )}

          <AnimatePresence>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-pfc-ember/10 border border-pfc-ember/20 px-3 py-1"
              >
                <ZapIcon className="h-3 w-3 text-pfc-ember animate-pulse" />
                <span className="text-[10px] text-pfc-ember font-medium">Mapping concepts...</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GlassSection>

      {mergedConcepts.length > 0 && (
        <GlassSection title="Active Concepts" className="">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="flex flex-wrap gap-2"
          >
            {mergedConcepts.map((concept, i) => {
              const isFromPipeline = i < pipelineCount;
              return (
                <Badge
                  key={concept}
                  variant="secondary"
                  className="text-xs"
                  style={{
                    background: isFromPipeline
                      ? 'rgba(139,124,246,0.1)'
                      : (isDark ? 'rgba(52,211,153,0.08)' : 'rgba(52,211,153,0.1)'),
                    color: isFromPipeline
                      ? 'var(--color-pfc-violet)'
                      : 'var(--color-pfc-green)',
                    borderColor: isFromPipeline
                      ? 'rgba(139,124,246,0.2)'
                      : 'rgba(52,211,153,0.2)',
                  }}
                >
                  {concept}
                </Badge>
              );
            })}
            {activeChordProduct > 0 && (
              <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                Chord: {activeChordProduct.toFixed(3)}
              </Badge>
            )}
          </motion.div>
        </GlassSection>
      )}
    </PageShell>
  );
}
