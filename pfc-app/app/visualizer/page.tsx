'use client';

import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BarChart3Icon,
  ArrowLeftIcon,
  RadarIcon,
  NetworkIcon,
  TrendingUpIcon,
  TargetIcon,
  BrainIcon,
  ActivityIcon,
  RotateCcwIcon,
  GripIcon,
} from 'lucide-react';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { InfoButton, VISUALIZER_INFO, AnimatedSuggestions, VISUALIZER_SUGGESTIONS } from '@/components/info-panel';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMBER = '#C15F3C';
const VIOLET = '#6B5CE7';
const GREEN = '#22C55E';
const YELLOW = '#EAB308';
const RED = '#EF4444';
const CYAN = '#06B6D4';

const STATUS_COLOR: Record<string, string> = {
  idle: '#6B7280',
  active: EMBER,
  complete: GREEN,
  error: RED,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a 0-1 value to a radius between 20 (min visible) and `max`. */
function valToRadius(v: number, max: number) {
  return 20 + Math.max(0, Math.min(1, v)) * (max - 20);
}

/** Polar to cartesian, angle in degrees where 0 = top. */
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** Deterministic pseudo-random from a seed string (for concept layout). */
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

// ---------------------------------------------------------------------------
// 1 - Interactive Signal Radar (drag to edit)
// ---------------------------------------------------------------------------

const SIGNAL_KEYS = ['confidence', 'entropy', 'dissonance', 'healthScore'] as const;
type SignalKey = typeof SIGNAL_KEYS[number];

function InteractiveSignalRadar({
  confidence,
  entropy,
  dissonance,
  healthScore,
  overrides,
  onSignalChange,
}: {
  confidence: number;
  entropy: number;
  dissonance: number;
  healthScore: number;
  overrides: { confidence: number | null; entropy: number | null; dissonance: number | null; healthScore: number | null };
  onSignalChange: (signal: SignalKey, value: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  const cx = 150;
  const cy = 150;
  const maxR = 120;
  const axes = [
    { label: 'Confidence', key: 'confidence' as SignalKey, value: overrides.confidence ?? confidence, autoValue: confidence, angle: 0, isOverridden: overrides.confidence !== null },
    { label: 'Entropy', key: 'entropy' as SignalKey, value: Math.min(1, overrides.entropy ?? entropy), autoValue: Math.min(1, entropy), angle: 90, isOverridden: overrides.entropy !== null },
    { label: 'Dissonance', key: 'dissonance' as SignalKey, value: Math.min(1, overrides.dissonance ?? dissonance), autoValue: Math.min(1, dissonance), angle: 180, isOverridden: overrides.dissonance !== null },
    { label: 'Health', key: 'healthScore' as SignalKey, value: overrides.healthScore ?? healthScore, autoValue: healthScore, angle: 270, isOverridden: overrides.healthScore !== null },
  ];

  // Auto (ghost) polygon
  const autoPoints = axes.map((a) => {
    const r = valToRadius(a.autoValue, maxR);
    return polar(cx, cy, r, a.angle);
  });
  const autoPolygon = autoPoints.map((p) => `${p.x},${p.y}`).join(' ');

  // Active (effective) polygon
  const points = axes.map((a) => {
    const r = valToRadius(a.value, maxR);
    return polar(cx, cy, r, a.angle);
  });
  const polygon = points.map((p) => `${p.x},${p.y}`).join(' ');

  const rings = [0.25, 0.5, 0.75, 1];

  const hasAnyOverride = axes.some((a) => a.isOverridden);

  // Convert mouse/touch position to signal value
  const getSvgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    // Map client coords to SVG viewBox coords (-50, -30, 400, 360)
    const viewBoxX = -50;
    const viewBoxY = -30;
    const viewBoxW = 400;
    const viewBoxH = 360;
    const svgX = viewBoxX + ((clientX - rect.left) / rect.width) * viewBoxW;
    const svgY = viewBoxY + ((clientY - rect.top) / rect.height) * viewBoxH;
    return { x: svgX, y: svgY };
  }, []);

  const handlePointerDown = useCallback((index: number, e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as SVGElement).setPointerCapture(e.pointerId);
    setDragging(index);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragging === null) return;
    const pt = getSvgPoint(e.clientX, e.clientY);
    if (!pt) return;

    const axis = axes[dragging];
    // Calculate distance from center
    const dx = pt.x - cx;
    const dy = pt.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Convert distance to 0-1 value (inverse of valToRadius)
    const minR = 20;
    const value = Math.max(0, Math.min(1, (dist - minR) / (maxR - minR)));

    onSignalChange(axis.key, Math.round(value * 100) / 100);
  }, [dragging, axes, cx, cy, maxR, getSvgPoint, onSignalChange]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox="-50 -30 400 360"
      overflow="visible"
      className={cn('w-full max-w-md mx-auto', dragging !== null ? 'cursor-grabbing' : '')}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ touchAction: 'none' }}
    >
      {/* Grid rings */}
      {rings.map((r) => (
        <circle
          key={r}
          cx={cx}
          cy={cy}
          r={20 + r * (maxR - 20)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={1}
        />
      ))}

      {/* Ring value labels */}
      {rings.map((r) => (
        <text
          key={`ring-${r}`}
          x={cx + 4}
          y={cy - (20 + r * (maxR - 20)) + 3}
          fontSize={7}
          className="fill-muted-foreground"
          fillOpacity={0.4}
        >
          {r.toFixed(2)}
        </text>
      ))}

      {/* Axis lines */}
      {axes.map((a) => {
        const end = polar(cx, cy, maxR + 4, a.angle);
        return (
          <line
            key={a.label}
            x1={cx}
            y1={cy}
            x2={end.x}
            y2={end.y}
            stroke="currentColor"
            strokeOpacity={0.15}
            strokeWidth={1}
          />
        );
      })}

      {/* Ghost polygon (auto values) — only show when there are overrides */}
      {hasAnyOverride && (
        <polygon
          points={autoPolygon}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}

      {/* Active polygon fill */}
      <polygon
        points={polygon}
        fill={EMBER}
        fillOpacity={0.2}
        stroke={EMBER}
        strokeWidth={2}
      />

      {/* Ghost data points (auto values) — show when overridden */}
      {hasAnyOverride && autoPoints.map((p, i) => (
        axes[i].isOverridden ? (
          <circle key={`ghost-${i}`} cx={p.x} cy={p.y} r={3} fill="currentColor" fillOpacity={0.2} />
        ) : null
      ))}

      {/* Draggable data points */}
      {points.map((p, i) => {
        const isHovered = hoveredPoint === i;
        const isDragging = dragging === i;
        const isOverridden = axes[i].isOverridden;

        return (
          <g key={i}>
            {/* Larger invisible hit area for easier dragging */}
            <circle
              cx={p.x}
              cy={p.y}
              r={20}
              fill="transparent"
              className="cursor-grab"
              onPointerDown={(e) => handlePointerDown(i, e)}
              onPointerEnter={() => setHoveredPoint(i)}
              onPointerLeave={() => setHoveredPoint(null)}
              style={{ touchAction: 'none' }}
            />
            {/* Pulse ring when hovered or dragging */}
            {(isHovered || isDragging) && (
              <circle
                cx={p.x}
                cy={p.y}
                r={isDragging ? 10 : 8}
                fill={EMBER}
                fillOpacity={0.15}
                stroke={EMBER}
                strokeOpacity={0.3}
                strokeWidth={1}
              />
            )}
            {/* Override indicator ring */}
            {isOverridden && (
              <circle
                cx={p.x}
                cy={p.y}
                r={7}
                fill="none"
                stroke={VIOLET}
                strokeWidth={1.5}
                strokeDasharray="2 2"
              />
            )}
            {/* Main point */}
            <circle
              cx={p.x}
              cy={p.y}
              r={isDragging ? 6 : isHovered ? 5.5 : 4}
              fill={isOverridden ? VIOLET : EMBER}
              className="cursor-grab transition-all"
              style={{ filter: isDragging ? 'drop-shadow(0 0 6px rgba(107, 92, 231, 0.5))' : undefined }}
            />
          </g>
        );
      })}

      {/* Labels */}
      {axes.map((a) => {
        const labelR = maxR + 30;
        const pos = polar(cx, cy, labelR, a.angle);
        return (
          <text
            key={a.label}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted-foreground"
            fontSize={11}
            fontWeight={500}
          >
            {a.label}
            {a.isOverridden && ' ✎'}
          </text>
        );
      })}

      {/* Value labels */}
      {axes.map((a, i) => {
        const pos = points[i];
        return (
          <text
            key={`v-${a.label}`}
            x={pos.x}
            y={pos.y - 12}
            textAnchor="middle"
            fontSize={9}
            fill={a.isOverridden ? VIOLET : EMBER}
            fontWeight={600}
          >
            {a.value.toFixed(2)}
            {a.isOverridden && (
              <tspan fontSize={7} fillOpacity={0.6}>{` (auto: ${a.autoValue.toFixed(2)})`}</tspan>
            )}
          </text>
        );
      })}

      {/* Drag instruction hint */}
      <text
        x={cx}
        y={cy + maxR + 55}
        textAnchor="middle"
        fontSize={9}
        className="fill-muted-foreground"
        fillOpacity={0.5}
      >
        Drag points to manually set signals
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 2 - Pipeline Flow
// ---------------------------------------------------------------------------

function PipelineFlow({
  stages,
}: {
  stages: { stage: string; status: string; summary: string }[];
}) {
  const nodeR = 18;
  const spacing = 64;
  const startX = 40;
  const midY = 50;

  const totalW = startX * 2 + (stages.length - 1) * spacing;

  return (
    <svg
      viewBox={`0 0 ${totalW} 100`}
      className="w-full"
      overflow="visible"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Connecting lines */}
      {stages.slice(0, -1).map((_, i) => (
        <line
          key={`line-${i}`}
          x1={startX + i * spacing + nodeR}
          y1={midY}
          x2={startX + (i + 1) * spacing - nodeR}
          y2={midY}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={2}
        />
      ))}

      {/* Nodes */}
      {stages.map((s, i) => {
        const cx = startX + i * spacing;
        const color = STATUS_COLOR[s.status] || STATUS_COLOR.idle;
        const isActive = s.status === 'active';

        return (
          <g key={s.stage}>
            {/* Pulse ring for active */}
            {isActive && (
              <circle
                cx={cx}
                cy={midY}
                r={nodeR + 4}
                fill="none"
                stroke={color}
                strokeWidth={2}
                opacity={0.5}
              >
                <animate
                  attributeName="r"
                  from={String(nodeR + 2)}
                  to={String(nodeR + 10)}
                  dur="1.5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  from="0.6"
                  to="0"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
            <circle
              cx={cx}
              cy={midY}
              r={nodeR}
              fill={color}
              fillOpacity={s.status === 'idle' ? 0.25 : 0.85}
              stroke={color}
              strokeWidth={s.status === 'idle' ? 1 : 2}
            />
            <text
              x={cx}
              y={midY + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={8}
              fontWeight={600}
              fill="white"
            >
              {i + 1}
            </text>
            <text
              x={cx}
              y={midY + nodeR + 14}
              textAnchor="middle"
              fontSize={8}
              className="fill-muted-foreground"
            >
              {s.summary.length > 16
                ? s.summary.slice(0, 15) + '\u2026'
                : s.summary}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 3 - Confidence History (simulated)
// ---------------------------------------------------------------------------

function ConfidenceHistory({ confidence }: { confidence: number }) {
  const bars = useMemo(() => {
    const result: number[] = [];
    // Simulate 9 prior values drifting toward current
    let val = Math.max(0, Math.min(1, confidence - 0.15 + Math.random() * 0.1));
    for (let i = 0; i < 9; i++) {
      result.push(val);
      val += (confidence - val) * 0.3 + (Math.random() - 0.5) * 0.08;
      val = Math.max(0, Math.min(1, val));
    }
    result.push(confidence);
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confidence]);

  const barW = 24;
  const gap = 8;
  const chartH = 140;
  const totalW = bars.length * (barW + gap) + gap;

  return (
    <svg
      viewBox={`0 0 ${totalW} ${chartH + 40}`}
      overflow="visible"
      className="w-full max-w-lg mx-auto"
    >
      {/* Horizontal grid lines */}
      {[0.25, 0.5, 0.75, 1].map((v) => {
        const y = chartH - v * chartH + 10;
        return (
          <g key={v}>
            <line
              x1={0}
              y1={y}
              x2={totalW}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
            <text
              x={2}
              y={y - 3}
              fontSize={8}
              className="fill-muted-foreground"
            >
              {v.toFixed(2)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {bars.map((v, i) => {
        const x = gap + i * (barW + gap);
        const h = Math.max(2, v * chartH);
        const y = chartH - h + 10;
        const isLast = i === bars.length - 1;

        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={4}
              fill={isLast ? EMBER : CYAN}
              fillOpacity={isLast ? 0.9 : 0.4}
            />
            <text
              x={x + barW / 2}
              y={chartH + 24}
              textAnchor="middle"
              fontSize={8}
              className="fill-muted-foreground"
            >
              {isLast ? 'Now' : `t-${bars.length - 1 - i}`}
            </text>
            {isLast && (
              <text
                x={x + barW / 2}
                y={y - 5}
                textAnchor="middle"
                fontSize={9}
                fill={EMBER}
                fontWeight={700}
              >
                {v.toFixed(2)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 4 - TDA Landscape
// ---------------------------------------------------------------------------

function TDALandscape({
  betti0,
  betti1,
  persistenceEntropy,
  maxPersistence,
}: {
  betti0: number;
  betti1: number;
  persistenceEntropy: number;
  maxPersistence: number;
}) {
  const barW = 48;
  const gap = 24;
  const chartH = 140;
  const labels = ['Betti-0', 'Betti-1', 'Max Pers.'];
  const values = [betti0, betti1, maxPersistence];
  const maxVal = Math.max(1, ...values);
  const totalW = labels.length * (barW + gap) + gap + 160;

  // Persistence entropy as radial indicator
  const entCx = labels.length * (barW + gap) + gap + 80;
  const entCy = 90;
  const entR = 45;
  const entAngle = Math.min(1, persistenceEntropy) * 360;

  function arcPath(angle: number) {
    const startA = -90;
    const endA = startA + angle;
    const startRad = (startA * Math.PI) / 180;
    const endRad = (endA * Math.PI) / 180;
    const x1 = entCx + entR * Math.cos(startRad);
    const y1 = entCy + entR * Math.sin(startRad);
    const x2 = entCx + entR * Math.cos(endRad);
    const y2 = entCy + entR * Math.sin(endRad);
    const largeArc = angle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${entR} ${entR} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  return (
    <svg
      viewBox={`0 0 ${totalW} ${chartH + 40}`}
      overflow="visible"
      className="w-full max-w-xl mx-auto"
    >
      {/* Betti bars */}
      {values.map((v, i) => {
        const x = gap + i * (barW + gap);
        const h = Math.max(2, (v / maxVal) * chartH);
        const y = chartH - h + 10;
        return (
          <g key={labels[i]}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={4}
              fill={VIOLET}
              fillOpacity={0.7}
            />
            <text
              x={x + barW / 2}
              y={y - 5}
              textAnchor="middle"
              fontSize={10}
              fill={VIOLET}
              fontWeight={600}
            >
              {v}
            </text>
            <text
              x={x + barW / 2}
              y={chartH + 24}
              textAnchor="middle"
              fontSize={9}
              className="fill-muted-foreground"
            >
              {labels[i]}
            </text>
          </g>
        );
      })}

      {/* Persistence Entropy radial */}
      <circle
        cx={entCx}
        cy={entCy}
        r={entR}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.1}
        strokeWidth={6}
      />
      {entAngle > 0 && (
        <path
          d={arcPath(entAngle)}
          fill="none"
          stroke={CYAN}
          strokeWidth={6}
          strokeLinecap="round"
        />
      )}
      <text
        x={entCx}
        y={entCy - 4}
        textAnchor="middle"
        fontSize={14}
        fill={CYAN}
        fontWeight={700}
      >
        {persistenceEntropy.toFixed(3)}
      </text>
      <text
        x={entCx}
        y={entCy + 12}
        textAnchor="middle"
        fontSize={9}
        className="fill-muted-foreground"
      >
        Pers. Entropy
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 5 - Concept Map
// ---------------------------------------------------------------------------

function ConceptMap({ concepts }: { concepts: string[] }) {
  if (concepts.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No active concepts
      </div>
    );
  }

  const cx = 200;
  const cy = 150;
  const ringR = 100;

  // Position concepts in a circle
  const nodes = concepts.map((c, i) => {
    const rand = seededRandom(c);
    const angle = (360 / concepts.length) * i;
    const jitter = (rand() - 0.5) * 20;
    const r = ringR + jitter;
    const pos = polar(cx, cy, r, angle);
    return { label: c, ...pos };
  });

  return (
    <svg viewBox="0 0 400 300" overflow="visible" className="w-full max-w-lg mx-auto">
      {/* Connections between adjacent concepts */}
      {nodes.map((n, i) => {
        const next = nodes[(i + 1) % nodes.length];
        return (
          <line
            key={`edge-${i}`}
            x1={n.x}
            y1={n.y}
            x2={next.x}
            y2={next.y}
            stroke={VIOLET}
            strokeOpacity={0.2}
            strokeWidth={1}
          />
        );
      })}

      {/* Connect each to center */}
      {nodes.map((n, i) => (
        <line
          key={`center-${i}`}
          x1={cx}
          y1={cy}
          x2={n.x}
          y2={n.y}
          stroke={VIOLET}
          strokeOpacity={0.1}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ))}

      {/* Center node */}
      <circle cx={cx} cy={cy} r={8} fill={EMBER} fillOpacity={0.6} />

      {/* Concept nodes */}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={22} fill={VIOLET} fillOpacity={0.15} stroke={VIOLET} strokeWidth={1.5} />
          <text
            x={n.x}
            y={n.y + 1}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={8}
            fill={VIOLET}
            fontWeight={500}
          >
            {n.label.length > 14 ? n.label.slice(0, 13) + '\u2026' : n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 6 - Risk Matrix
// ---------------------------------------------------------------------------

function RiskMatrix({
  riskScore,
  confidence,
}: {
  riskScore: number;
  confidence: number;
}) {
  const size = 260;
  const pad = 40;
  const gridSize = size - pad * 2;
  const half = gridSize / 2;

  // Quadrant colors
  const quadrants = [
    { x: 0, y: 0, color: GREEN, label: 'Low Risk\nHigh Conf', opacity: 0.15 },
    { x: 1, y: 0, color: '#F97316', label: 'High Risk\nHigh Conf', opacity: 0.15 },
    { x: 0, y: 1, color: YELLOW, label: 'Low Risk\nLow Conf', opacity: 0.15 },
    { x: 1, y: 1, color: RED, label: 'High Risk\nLow Conf', opacity: 0.15 },
  ];

  // Dot position: x = riskScore (0-1), y = 1 - confidence (0-1)
  const dotX = pad + Math.min(1, Math.max(0, riskScore)) * gridSize;
  const dotY = pad + Math.min(1, Math.max(0, 1 - confidence)) * gridSize;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} overflow="visible" className="w-full max-w-sm mx-auto">
      {/* Quadrant fills */}
      {quadrants.map((q, i) => (
        <rect
          key={i}
          x={pad + q.x * half}
          y={pad + q.y * half}
          width={half}
          height={half}
          fill={q.color}
          fillOpacity={q.opacity}
          rx={4}
        />
      ))}

      {/* Grid border */}
      <rect
        x={pad}
        y={pad}
        width={gridSize}
        height={gridSize}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.2}
        strokeWidth={1}
      />

      {/* Center lines */}
      <line
        x1={pad + half}
        y1={pad}
        x2={pad + half}
        y2={pad + gridSize}
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={1}
      />
      <line
        x1={pad}
        y1={pad + half}
        x2={pad + gridSize}
        y2={pad + half}
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={1}
      />

      {/* Quadrant labels */}
      {quadrants.map((q, i) => {
        const lines = q.label.split('\n');
        const tx = pad + q.x * half + half / 2;
        const ty = pad + q.y * half + half / 2;
        return (
          <g key={`label-${i}`}>
            {lines.map((line, li) => (
              <text
                key={li}
                x={tx}
                y={ty + (li - 0.5) * 12}
                textAnchor="middle"
                fontSize={8}
                className="fill-muted-foreground"
                fontWeight={500}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}

      {/* Axis labels */}
      <text
        x={pad + gridSize / 2}
        y={size - 4}
        textAnchor="middle"
        fontSize={10}
        className="fill-muted-foreground"
        fontWeight={600}
      >
        Risk Score
      </text>
      <text
        x={10}
        y={pad + gridSize / 2}
        textAnchor="middle"
        fontSize={10}
        className="fill-muted-foreground"
        fontWeight={600}
        transform={`rotate(-90, 10, ${pad + gridSize / 2})`}
      >
        Uncertainty
      </text>

      {/* Current position dot */}
      <circle cx={dotX} cy={dotY} r={8} fill={EMBER} fillOpacity={0.3}>
        <animate
          attributeName="r"
          values="8;12;8"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx={dotX} cy={dotY} r={5} fill={EMBER} />
      <text
        x={dotX}
        y={dotY - 12}
        textAnchor="middle"
        fontSize={8}
        fill={EMBER}
        fontWeight={700}
      >
        ({riskScore.toFixed(2)}, {(1 - confidence).toFixed(2)})
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 7 - Harmony Spectrum
// ---------------------------------------------------------------------------

function HarmonySpectrum({
  harmonyKeyDistance,
  activeChordProduct,
}: {
  harmonyKeyDistance: number;
  activeChordProduct: number;
}) {
  const w = 400;
  const h = 100;
  const barY = 35;
  const barH = 24;
  const barX = 30;
  const barW = w - 60;
  const gradId = 'harmony-grad';

  // Normalise harmony to 0-1 (assume 0 is perfect harmony, higher is worse)
  const normHarmony = Math.min(1, Math.max(0, harmonyKeyDistance));
  const markerX = barX + normHarmony * barW;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} overflow="visible" className="w-full max-w-lg mx-auto">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={GREEN} />
          <stop offset="50%" stopColor={YELLOW} />
          <stop offset="100%" stopColor={RED} />
        </linearGradient>
      </defs>

      {/* Spectrum bar */}
      <rect
        x={barX}
        y={barY}
        width={barW}
        height={barH}
        rx={barH / 2}
        fill={`url(#${gradId})`}
        fillOpacity={0.7}
      />

      {/* Track outline */}
      <rect
        x={barX}
        y={barY}
        width={barW}
        height={barH}
        rx={barH / 2}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeWidth={1}
      />

      {/* Marker */}
      <circle
        cx={markerX}
        cy={barY + barH / 2}
        r={barH / 2 + 4}
        fill="var(--background)"
        stroke={EMBER}
        strokeWidth={3}
      />
      <circle cx={markerX} cy={barY + barH / 2} r={4} fill={EMBER} />

      {/* Labels */}
      <text
        x={barX}
        y={barY - 8}
        fontSize={9}
        fill={GREEN}
        fontWeight={600}
      >
        Harmonious
      </text>
      <text
        x={barX + barW}
        y={barY - 8}
        textAnchor="end"
        fontSize={9}
        fill={RED}
        fontWeight={600}
      >
        Dissonant
      </text>

      {/* Value readout */}
      <text
        x={markerX}
        y={barY + barH + 20}
        textAnchor="middle"
        fontSize={10}
        fill={EMBER}
        fontWeight={700}
      >
        Key Distance: {harmonyKeyDistance.toFixed(3)}
      </text>

      {/* Chord product */}
      <text
        x={w / 2}
        y={barY + barH + 36}
        textAnchor="middle"
        fontSize={9}
        className="fill-muted-foreground"
      >
        Active Chord Product: {activeChordProduct.toFixed(4)}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TAB_DEFS = [
  { value: 'radar', label: 'Signal Radar', icon: RadarIcon },
  { value: 'pipeline', label: 'Pipeline', icon: NetworkIcon },
  { value: 'confidence', label: 'Confidence', icon: TrendingUpIcon },
  { value: 'tda', label: 'TDA', icon: ActivityIcon },
  { value: 'concepts', label: 'Concepts', icon: BrainIcon },
  { value: 'risk', label: 'Risk Matrix', icon: TargetIcon },
  { value: 'harmony', label: 'Harmony', icon: ActivityIcon },
] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VisualizerPage() {
  const ready = useSetupGuard();
  const confidence = usePFCStore((s) => s.confidence);
  const entropy = usePFCStore((s) => s.entropy);
  const dissonance = usePFCStore((s) => s.dissonance);
  const healthScore = usePFCStore((s) => s.healthScore);
  const pipelineStages = usePFCStore((s) => s.pipelineStages);
  const tda = usePFCStore((s) => s.tda);
  const activeConcepts = usePFCStore((s) => s.activeConcepts);
  const riskScore = usePFCStore((s) => s.riskScore);
  const harmonyKeyDistance = usePFCStore((s) => s.harmonyKeyDistance);
  const activeChordProduct = usePFCStore((s) => s.activeChordProduct);
  const userSignalOverrides = usePFCStore((s) => s.userSignalOverrides);
  const setSignalOverride = usePFCStore((s) => s.setSignalOverride);
  const resetAllSignalOverrides = usePFCStore((s) => s.resetAllSignalOverrides);

  const hasOverrides = userSignalOverrides.confidence !== null ||
    userSignalOverrides.entropy !== null ||
    userSignalOverrides.dissonance !== null ||
    userSignalOverrides.healthScore !== null;

  const handleSignalChange = useCallback((signal: SignalKey, value: number) => {
    setSignalOverride(signal, value);
  }, [setSignalOverride]);

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
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-full px-3 py-1 -ml-3 hover:bg-muted"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            <span className="text-xs">Back</span>
          </Link>

          <div className="flex items-center gap-2 ml-1">
            <BarChart3Icon className="h-5 w-5 text-pfc-ember" />
            <h1 className="text-lg font-semibold tracking-tight">
              Visualizer
            </h1>
          </div>

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-xs font-mono hidden sm:inline-flex">
              Confidence {confidence.toFixed(2)}
            </Badge>
            <Badge variant="outline" className="text-xs font-mono hidden sm:inline-flex">
              Health {healthScore.toFixed(2)}
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </motion.header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Animated suggestions */}
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-2 font-medium">
            Quick Guide — What is this used for?
          </p>
          <AnimatedSuggestions suggestions={VISUALIZER_SUGGESTIONS} />
        </div>

        <Tabs defaultValue="radar" className="w-full">
          {/* Tab triggers - scrollable row */}
          <TabsList className="mb-6 flex w-full overflow-x-auto">
            {TAB_DEFS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="flex items-center gap-1.5 shrink-0"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* 1 - Signal Radar (Interactive) */}
          <TabsContent value="radar">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <RadarIcon className="h-4 w-4 text-pfc-ember" />
                      Signal Radar
                      <InfoButton info={VISUALIZER_INFO.radar} compact />
                      {hasOverrides && (
                        <Badge variant="outline" className="ml-2 text-[10px] border-pfc-violet/40 text-pfc-violet">
                          Manual Override Active
                        </Badge>
                      )}
                    </CardTitle>
                    {hasOverrides && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs border-pfc-violet/30 text-pfc-violet hover:bg-pfc-violet/10"
                        onClick={resetAllSignalOverrides}
                      >
                        <RotateCcwIcon className="h-3 w-3" />
                        Reset to Auto
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag the data points to manually override signal values.
                    Overridden signals are shown in purple. The dashed outline shows the auto-calculated values.
                  </p>

                  {/* Override status indicators */}
                  {hasOverrides && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {SIGNAL_KEYS.map((key) => {
                        const override = userSignalOverrides[key];
                        if (override === null) return null;
                        const autoVal = key === 'entropy' ? Math.min(1, entropy) : key === 'dissonance' ? Math.min(1, dissonance) : key === 'confidence' ? confidence : healthScore;
                        return (
                          <button
                            key={key}
                            onClick={() => setSignalOverride(key, null)}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]',
                              'border border-pfc-violet/30 bg-pfc-violet/5 text-pfc-violet',
                              'hover:bg-pfc-violet/15 transition-colors cursor-pointer',
                            )}
                          >
                            <span className="font-medium capitalize">{key === 'healthScore' ? 'Health' : key}</span>
                            <span className="font-mono">{override.toFixed(2)}</span>
                            <span className="text-[9px] opacity-60">(auto: {autoVal.toFixed(2)})</span>
                            <span className="ml-0.5 text-pfc-violet/60">✕</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <InteractiveSignalRadar
                    confidence={confidence}
                    entropy={entropy}
                    dissonance={dissonance}
                    healthScore={healthScore}
                    overrides={userSignalOverrides}
                    onSignalChange={handleSignalChange}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* 2 - Pipeline Flow */}
          <TabsContent value="pipeline">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <NetworkIcon className="h-4 w-4 text-pfc-ember" />
                    Pipeline Flow
                    <InfoButton info={VISUALIZER_INFO.pipeline} compact />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    The 10-stage analytical pipeline. Nodes pulse when active
                    and turn green on completion.
                  </p>
                  <PipelineFlow stages={pipelineStages} />
                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-muted-foreground">
                    {Object.entries(STATUS_COLOR).map(([status, color]) => (
                      <span key={status} className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* 3 - Confidence History */}
          <TabsContent value="confidence">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUpIcon className="h-4 w-4 text-pfc-ember" />
                    Confidence History
                    <InfoButton info={VISUALIZER_INFO.confidence} compact />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Simulated trajectory showing how confidence has evolved.
                    The final bar is the current live value.
                  </p>
                  <ConfidenceHistory confidence={confidence} />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* 4 - TDA Landscape */}
          <TabsContent value="tda">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ActivityIcon className="h-4 w-4 text-pfc-violet" />
                    TDA Landscape
                    <InfoButton info={VISUALIZER_INFO.tda} compact />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Topological Data Analysis snapshot. Betti numbers indicate
                    connected components and loops; persistence entropy measures
                    topological complexity.
                  </p>
                  <TDALandscape
                    betti0={tda.betti0}
                    betti1={tda.betti1}
                    persistenceEntropy={tda.persistenceEntropy}
                    maxPersistence={tda.maxPersistence}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* 5 - Concept Map */}
          <TabsContent value="concepts">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BrainIcon className="h-4 w-4 text-pfc-violet" />
                    Concept Map
                    <InfoButton info={VISUALIZER_INFO.concepts} compact />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Active concepts extracted from the reasoning pipeline,
                    displayed as an interconnected node graph.
                  </p>
                  <ConceptMap concepts={activeConcepts} />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* 6 - Risk Matrix */}
          <TabsContent value="risk">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TargetIcon className="h-4 w-4 text-pfc-red" />
                    Risk Matrix
                    <InfoButton info={VISUALIZER_INFO.risk} compact />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    2x2 risk/uncertainty matrix. The pulsing dot shows the
                    current analytical position based on risk score and
                    confidence.
                  </p>
                  <RiskMatrix riskScore={riskScore} confidence={confidence} />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* 7 - Harmony Spectrum */}
          <TabsContent value="harmony">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ActivityIcon className="h-4 w-4 text-pfc-green" />
                    Harmony Spectrum
                    <InfoButton info={VISUALIZER_INFO.harmony} compact />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Concept chord harmony visualised as a spectrum. The marker
                    shows how far the current key distance is from perfect
                    harmonic alignment.
                  </p>
                  <HarmonySpectrum
                    harmonyKeyDistance={harmonyKeyDistance}
                    activeChordProduct={activeChordProduct}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
