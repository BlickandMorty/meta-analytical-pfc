'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainIcon,
  ZapIcon,
  ExpandIcon,
  ShrinkIcon,
} from 'lucide-react';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { GlassBubbleButton } from '@/components/glass-bubble-button';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { PageShell, GlassSection } from '@/components/page-shell';
import { PixelBook } from '@/components/pixel-book';

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

  nodes.push({
    id: '__center__',
    label: 'PFC Core',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 26,
    color: CENTER_COLOR,
    isCenter: true,
    orbitAngle: 0,
    orbitSpeed: 0,
  });

  concepts.forEach((concept, i) => {
    const rand = seededRandom(concept);
    const angle = (Math.PI * 2 * i) / Math.max(concepts.length, 1);
    const dist = 110 + rand() * 70;
    nodes.push({
      id: concept,
      label: concept,
      x: Math.cos(angle) * dist + (rand() - 0.5) * 30,
      y: Math.sin(angle) * dist + (rand() - 0.5) * 30,
      vx: 0,
      vy: 0,
      radius: 14 + rand() * 10,
      color: PALETTE[i % PALETTE.length],
      isCenter: false,
      orbitAngle: angle,
      orbitSpeed: 0.0003 + rand() * 0.0005,
    });

    edges.push({ source: '__center__', target: concept, strength: 0.4 + confidence * 0.6 });

    if (i > 0) {
      edges.push({ source: concepts[i - 1], target: concept, strength: 0.2 + entropy * 0.4 });
    }
  });

  if (concepts.length > 2) {
    edges.push({ source: concepts[concepts.length - 1], target: concepts[0], strength: 0.15 });
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

    // ── Force simulation step ──
    const repulsion = 3500;
    const attraction = 0.004;
    const damping = 0.9;
    const centerGravity = 0.008;

    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].isCenter) continue;
      let fx = 0, fy = 0;

      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }

      for (const edge of edges) {
        const a = nodeMap.get(edge.source);
        const b = nodeMap.get(edge.target);
        if (!a || !b) continue;
        if (a.id !== nodes[i].id && b.id !== nodes[i].id) continue;
        const other = a.id === nodes[i].id ? b : a;
        const dx = other.x - nodes[i].x;
        const dy = other.y - nodes[i].y;
        fx += dx * attraction * edge.strength;
        fy += dy * attraction * edge.strength;
      }

      fx -= nodes[i].x * centerGravity;
      fy -= nodes[i].y * centerGravity;

      // Ambient orbital drift
      nodes[i].orbitAngle += nodes[i].orbitSpeed;
      fx += Math.cos(nodes[i].orbitAngle + t * 0.1) * 0.08;
      fy += Math.sin(nodes[i].orbitAngle + t * 0.1) * 0.08;

      if (isProcessing) {
        fx += Math.sin(t * 2.5 + i) * 0.5;
        fy += Math.cos(t * 2.5 + i * 0.7) * 0.5;
      }

      nodes[i].vx = (nodes[i].vx + fx) * damping;
      nodes[i].vy = (nodes[i].vy + fy) * damping;
      nodes[i].x += nodes[i].vx;
      nodes[i].y += nodes[i].vy;
    }

    // ══════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════

    ctx.clearRect(0, 0, W, H);

    // ── Layer 0: Subtle dot grid ──
    const gridSize = 32;
    ctx.fillStyle = 'rgba(128,128,128,0.04)';
    for (let gx = gridSize / 2; gx < W; gx += gridSize) {
      for (let gy = gridSize / 2; gy < H; gy += gridSize) {
        ctx.beginPath();
        ctx.arc(gx, gy, 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Concentric guide rings ──
    for (let ring = 1; ring <= 3; ring++) {
      const ringR = ring * 80 + nodes.length * 8;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(128,128,128,0.03)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Ambient radial glow removed for performance

    // ── Layer 1: Edges (quadratic bezier with gradient + particles) ──
    for (const edge of edges) {
      const a = nodeMap.get(edge.source);
      const b = nodeMap.get(edge.target);
      if (!a || !b) continue;

      const ax = cx + a.x, ay = cy + a.y;
      const bx = cx + b.x, by = cy + b.y;

      // Control point for curve
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const perpX = -(by - ay) * 0.08;
      const perpY = (bx - ax) * 0.08;
      const cpx = mx + perpX;
      const cpy = my + perpY;

      // Edge line with gradient
      const edgeGrad = ctx.createLinearGradient(ax, ay, bx, by);
      edgeGrad.addColorStop(0, a.color + '30');
      edgeGrad.addColorStop(1, b.color + '30');

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cpx, cpy, bx, by);
      ctx.strokeStyle = edgeGrad;
      ctx.lineWidth = 0.8 + edge.strength * 1.5;
      ctx.stroke();

      // Flowing particles along edge
      const particleCount = isProcessing ? 3 : 2;
      const speed = isProcessing ? 0.4 : 0.25;
      for (let pi = 0; pi < particleCount; pi++) {
        const phase = ((t * speed + edge.strength * 2 + pi * (1 / particleCount)) % 1);
        const pt = phase;
        const px = (1 - pt) * (1 - pt) * ax + 2 * (1 - pt) * pt * cpx + pt * pt * bx;
        const py = (1 - pt) * (1 - pt) * ay + 2 * (1 - pt) * pt * cpy + pt * pt * by;

        const particleR = 1.5 + edge.strength * 0.8;
        ctx.beginPath();
        ctx.arc(px, py, particleR, 0, Math.PI * 2);
        ctx.fillStyle = a.color + 'CC';
        ctx.fill();
      }
    }

    // ── Layer 2: Nodes (gradient fill + glow halo + label) ──
    for (const node of nodes) {
      const nx = cx + node.x;
      const ny = cy + node.y;
      const pulse = node.isCenter ? Math.sin(t * 2) * 3 : Math.sin(t * 1.5 + node.x * 0.01) * 1.5;
      const r = node.radius + pulse;

      // Node body (solid fill — avoids per-frame gradient creation)
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.fillStyle = node.color + (node.isCenter ? 'DD' : '99');
      ctx.fill();

      // Border ring
      ctx.strokeStyle = node.color + '90';
      ctx.lineWidth = node.isCenter ? 2 : 1.2;
      ctx.stroke();

      // Center node orbital ring
      if (node.isCenter) {
        ctx.beginPath();
        ctx.arc(nx, ny, r + 8, 0, Math.PI * 2);
        ctx.strokeStyle = CENTER_COLOR + '25';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Label
      const label = node.label.length > 18 ? node.label.slice(0, 17) + '\u2026' : node.label;
      const fontSize = node.isCenter ? 10 : 8.5;
      ctx.font = `${node.isCenter ? 600 : 500} ${fontSize}px -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Draw label inside node for center, below for others
      if (node.isCenter) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(label, nx, ny);
      } else {
        const labelY = ny + r + 10;
        const tw = ctx.measureText(label).width;
        const pillW = tw + 10;
        const pillH = 14;

        // Pill background
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        const pLeft = nx - pillW / 2;
        const pTop = labelY - pillH / 2;
        const pR = pillH / 2;
        ctx.moveTo(pLeft + pR, pTop);
        ctx.arcTo(pLeft + pillW, pTop, pLeft + pillW, pTop + pillH, pR);
        ctx.arcTo(pLeft + pillW, pTop + pillH, pLeft, pTop + pillH, pR);
        ctx.arcTo(pLeft, pTop + pillH, pLeft, pTop, pR);
        ctx.arcTo(pLeft, pTop, pLeft + pillW, pTop, pR);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.9;
        ctx.fillText(label, nx, labelY);
        ctx.globalAlpha = 1;
      }
    }

    // ── Harmony aura ring ──
    if (harmonyKeyDistance > 0) {
      const auraR = 70 + nodes.length * 14;
      ctx.beginPath();
      ctx.arc(cx, cy, auraR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(34,197,94,${0.06 + (1 - harmonyKeyDistance) * 0.1})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    queueNextFrame();
  }, [isProcessing, harmonyKeyDistance]);

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;

    // Cache canvas dimensions via ResizeObserver — avoids getBoundingClientRect per frame
    const resizeObs = canvas
      ? new ResizeObserver(([entry]) => {
          const { width, height } = entry.contentRect;
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
        height: expanded ? 'calc(100vh - 120px)' : '520px',
        background: 'rgba(0,0,0,0.02)',
      }}
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
      <div className="flex h-screen items-center justify-center bg-[var(--chat-surface)]">
        <PixelBook size={40} />
      </div>
    );
  }

  return (
    <PageShell icon={BrainIcon} iconColor="var(--color-pfc-violet)" title="Concept Atlas" subtitle="Live force-directed concept mapping">
      <GlassSection title="Force Graph" className={cn('mb-6', expanded ? 'max-w-full' : '')}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-mono gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-pfc-violet inline-block" />
              {activeConcepts.length} concepts
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono">
              Harmony {(1 - harmonyKeyDistance).toFixed(2)}
            </Badge>
          </div>
          <GlassBubbleButton
            color="violet"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ShrinkIcon className="h-3.5 w-3.5" /> : <ExpandIcon className="h-3.5 w-3.5" />}
          </GlassBubbleButton>
        </div>

        <div className="relative rounded-xl overflow-hidden">
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

      {activeConcepts.length > 0 && (
        <GlassSection title="Active Concepts" className="">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="flex flex-wrap gap-2"
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
        </GlassSection>
      )}
    </PageShell>
  );
}
