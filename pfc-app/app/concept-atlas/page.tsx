'use client';

import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  BrainIcon,
  ZapIcon,
  ExpandIcon,
  ShrinkIcon,
} from 'lucide-react';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { ThemeToggle } from '@/components/theme-toggle';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMBER = '#C15F3C';
const VIOLET = '#6B5CE7';
const GREEN = '#22C55E';
const CYAN = '#06B6D4';

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

  // Center "Brain" node
  nodes.push({
    id: '__center__',
    label: 'PFC Core',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 24,
    color: EMBER,
    isCenter: true,
  });

  const colors = [VIOLET, CYAN, GREEN, '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#F97316'];

  concepts.forEach((concept, i) => {
    const rand = seededRandom(concept);
    const angle = (Math.PI * 2 * i) / Math.max(concepts.length, 1);
    const dist = 100 + rand() * 60;
    nodes.push({
      id: concept,
      label: concept,
      x: Math.cos(angle) * dist + (rand() - 0.5) * 40,
      y: Math.sin(angle) * dist + (rand() - 0.5) * 40,
      vx: 0,
      vy: 0,
      radius: 14 + rand() * 8,
      color: colors[i % colors.length],
      isCenter: false,
    });

    // Edge to center
    edges.push({ source: '__center__', target: concept, strength: 0.5 + confidence * 0.5 });

    // Cross-edges between adjacent concepts
    if (i > 0) {
      edges.push({ source: concepts[i - 1], target: concept, strength: 0.3 + entropy * 0.3 });
    }
  });

  // Close the ring
  if (concepts.length > 2) {
    edges.push({ source: concepts[concepts.length - 1], target: concepts[0], strength: 0.2 });
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Animated Canvas Component
// ---------------------------------------------------------------------------

function ConceptCanvas({
  concepts,
  confidence,
  entropy,
  harmonyKeyDistance,
  isProcessing,
  expanded,
}: {
  concepts: string[];
  confidence: number;
  entropy: number;
  harmonyKeyDistance: number;
  isProcessing: boolean;
  expanded: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);

  // Rebuild graph when concepts change
  const graphKey = concepts.join('|');
  useEffect(() => {
    graphRef.current = buildGraph(concepts, confidence, entropy);
  }, [graphKey, confidence, entropy]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const cx = W / 2;
    const cy = H / 2;

    timeRef.current += 0.016;
    const t = timeRef.current;

    const { nodes, edges } = graphRef.current;

    // --- Simple force simulation step ---
    const repulsion = 3000;
    const attraction = 0.005;
    const damping = 0.92;
    const centerGravity = 0.01;

    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].isCenter) continue;
      let fx = 0, fy = 0;

      // Repulsion from all other nodes
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }

      // Attraction along edges
      for (const edge of edges) {
        const a = nodes.find((n) => n.id === edge.source);
        const b = nodes.find((n) => n.id === edge.target);
        if (!a || !b) continue;
        if (a.id !== nodes[i].id && b.id !== nodes[i].id) continue;
        const other = a.id === nodes[i].id ? b : a;
        const dx = other.x - nodes[i].x;
        const dy = other.y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        fx += dx * attraction * edge.strength;
        fy += dy * attraction * edge.strength;
      }

      // Gravity toward center
      fx -= nodes[i].x * centerGravity;
      fy -= nodes[i].y * centerGravity;

      // Gentle oscillation when processing
      if (isProcessing) {
        fx += Math.sin(t * 2 + i) * 0.3;
        fy += Math.cos(t * 2 + i * 0.7) * 0.3;
      }

      nodes[i].vx = (nodes[i].vx + fx) * damping;
      nodes[i].vy = (nodes[i].vy + fy) * damping;
      nodes[i].x += nodes[i].vx;
      nodes[i].y += nodes[i].vy;
    }

    // --- Draw ---
    ctx.clearRect(0, 0, W, H);

    // Background glow at center
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.5);
    grad.addColorStop(0, 'rgba(193, 95, 60, 0.04)');
    grad.addColorStop(1, 'rgba(193, 95, 60, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Edges
    for (const edge of edges) {
      const a = nodes.find((n) => n.id === edge.source);
      const b = nodes.find((n) => n.id === edge.target);
      if (!a || !b) continue;

      ctx.beginPath();
      ctx.moveTo(cx + a.x, cy + a.y);
      ctx.lineTo(cx + b.x, cy + b.y);
      ctx.strokeStyle = `rgba(107, 92, 231, ${0.08 + edge.strength * 0.12})`;
      ctx.lineWidth = 1 + edge.strength;
      ctx.stroke();

      // Flowing particle along edge
      const phase = (t * 0.5 + edge.strength) % 1;
      const px = a.x + (b.x - a.x) * phase;
      const py = a.y + (b.y - a.y) * phase;
      ctx.beginPath();
      ctx.arc(cx + px, cy + py, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(107, 92, 231, ${0.3 + Math.sin(t * 4) * 0.15})`;
      ctx.fill();
    }

    // Nodes
    for (const node of nodes) {
      const nx = cx + node.x;
      const ny = cy + node.y;
      const pulse = node.isCenter ? Math.sin(t * 2) * 3 : Math.sin(t * 1.5 + node.x * 0.01) * 2;
      const r = node.radius + pulse;

      // Glow
      const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, r * 2.5);
      glow.addColorStop(0, node.color + '30');
      glow.addColorStop(1, node.color + '00');
      ctx.fillStyle = glow;
      ctx.fillRect(nx - r * 3, ny - r * 3, r * 6, r * 6);

      // Circle
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.fillStyle = node.color + (node.isCenter ? 'E0' : '40');
      ctx.fill();
      ctx.strokeStyle = node.color + '80';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      ctx.fillStyle = node.isCenter ? '#FFFFFF' : node.color;
      ctx.font = `${node.isCenter ? '600' : '500'} ${node.isCenter ? 11 : 9}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = node.label.length > 16 ? node.label.slice(0, 15) + '\u2026' : node.label;
      ctx.fillText(label, nx, ny);
    }

    // Harmony aura ring
    if (harmonyKeyDistance > 0) {
      const auraR = 60 + nodes.length * 15;
      ctx.beginPath();
      ctx.arc(cx, cy, auraR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(34, 197, 94, ${0.08 + (1 - harmonyKeyDistance) * 0.12})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    animRef.current = requestAnimationFrame(draw);
  }, [isProcessing, harmonyKeyDistance]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-xl bg-background/50"
      style={{ height: expanded ? 'calc(100vh - 120px)' : '500px' }}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ConceptAtlasPage() {
  const ready = useSetupGuard();
  const activeConcepts = usePFCStore((s) => s.activeConcepts);
  const confidence = usePFCStore((s) => s.confidence);
  const entropy = usePFCStore((s) => s.entropy);
  const harmonyKeyDistance = usePFCStore((s) => s.harmonyKeyDistance);
  const activeChordProduct = usePFCStore((s) => s.activeChordProduct);
  const isProcessing = usePFCStore((s) => s.isProcessing);
  const [expanded, setExpanded] = useState(false);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-full px-3 py-1 -ml-3 hover:bg-muted"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            <span className="text-xs">Back</span>
          </Link>

          <div className="flex items-center gap-2 ml-1">
            <BrainIcon className="h-5 w-5 text-pfc-violet" />
            <h1 className="text-lg font-semibold tracking-tight">Concept Atlas</h1>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-mono gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-pfc-violet inline-block" />
              {activeConcepts.length} concepts
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono">
              Harmony {(1 - harmonyKeyDistance).toFixed(2)}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ShrinkIcon className="h-4 w-4" /> : <ExpandIcon className="h-4 w-4" />}
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className={cn('mx-auto px-4 py-4 sm:px-6', expanded ? 'max-w-full' : 'max-w-6xl')}>
        {/* Live concept canvas */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="relative rounded-xl border bg-card/50 overflow-hidden"
        >
          {activeConcepts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <BrainIcon className="h-10 w-10 text-muted-foreground/20 mb-4" />
              <p className="text-sm text-muted-foreground/50">No active concepts yet</p>
              <p className="text-xs text-muted-foreground/30 mt-1">Ask a research question to see concepts map out in real time</p>
            </div>
          ) : (
            <ConceptCanvas
              concepts={activeConcepts}
              confidence={confidence}
              entropy={entropy}
              harmonyKeyDistance={harmonyKeyDistance}
              isProcessing={isProcessing}
              expanded={expanded}
            />
          )}

          {/* Processing indicator overlay */}
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
        </motion.div>

        {/* Concept list below canvas */}
        {activeConcepts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="mt-4 flex flex-wrap gap-2"
          >
            {activeConcepts.map((concept) => (
              <Badge
                key={concept}
                variant="secondary"
                className="bg-pfc-violet/10 text-pfc-violet border-pfc-violet/20 text-xs"
              >
                {concept}
              </Badge>
            ))}
            <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
              Chord: {activeChordProduct.toFixed(3)}
            </Badge>
          </motion.div>
        )}
      </main>
    </div>
  );
}
