'use client';

import { useMemo, useRef, useCallback, useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { min, max, bisector } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import { line, area, curveMonotoneX } from 'd3-shape';
import { select } from 'd3-selection';
import { brushX } from 'd3-brush';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force';
import {
  BarChart3Icon,
  RadarIcon,
  NetworkIcon,
  TrendingUpIcon,
  TargetIcon,
  BrainIcon,
  ActivityIcon,
  RotateCcwIcon,
  GridIcon,
} from 'lucide-react';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { cn } from '@/lib/utils';
import { PageShell, GlassSection } from '@/components/page-shell';
import { PixelBook } from '@/components/pixel-book';
import { GlassBubbleButton } from '@/components/glass-bubble-button';

// ---------------------------------------------------------------------------
// Constants & Brand Colors
// ---------------------------------------------------------------------------

const EMBER = '#C15F3C';
const VIOLET = '#6B5CE7';
const GREEN = '#22C55E';
const YELLOW = '#EAB308';
const RED = '#EF4444';
const CYAN = '#06B6D4';
const PINK = '#EC4899';
const TEAL = '#14B8A6';

const STATUS_COLOR: Record<string, string> = {
  idle: '#6B7280',
  active: EMBER,
  complete: GREEN,
  error: RED,
};

const CUP: [number, number, number, number] = [0.32, 0.72, 0, 1];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function valToRadius(v: number, max: number) {
  return 20 + Math.max(0, Math.min(1, v)) * (max - 20);
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ---------------------------------------------------------------------------
// AIM-inspired: useResizeObserver hook (from AIM's hooks)
// ---------------------------------------------------------------------------

function useResizeObserver(
  ref: React.RefObject<HTMLDivElement | null>,
  callback: (entry: ResizeObserverEntry) => void,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      if (entries[0]) callback(entries[0]);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, callback]);
}

// ---------------------------------------------------------------------------
// AIM-inspired: D3 Interactive Line Chart (Metrics Explorer pattern)
// Supports: hover crosshair, brush zoom, multi-line, smooth curves
// ---------------------------------------------------------------------------

interface LineChartSeries {
  key: string;
  label: string;
  color: string;
  data: [number, number][]; // [x, y]
}

const D3LineChart = memo(function D3LineChart({
  series,
  xLabel = 'Step',
  yLabel = 'Value',
  height = 280,
}: {
  series: LineChartSeries[];
  xLabel?: string;
  yLabel?: string;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height });
  const [zoomDomain, setZoomDomain] = useState<{ x: [number, number]; y: [number, number] } | null>(null);
  const brushingRef = useRef(false);

  const margin = { top: 20, right: 20, bottom: 40, left: 56 };

  const resizeCb = useCallback((entry: ResizeObserverEntry) => {
    const w = entry.contentRect.width;
    if (w > 0) setDimensions({ width: w, height });
  }, [height]);

  useResizeObserver(containerRef, resizeCb);

  // Compute scales
  const { xScale, yScale, plotW, plotH } = useMemo(() => {
    const pw = dimensions.width - margin.left - margin.right;
    const ph = dimensions.height - margin.top - margin.bottom;

    const allX = series.flatMap((s) => s.data.map((d) => d[0]));
    const allY = series.flatMap((s) => s.data.map((d) => d[1]));

    const xDomain = zoomDomain?.x ?? [min(allX) ?? 0, max(allX) ?? 1];
    const yDomain = zoomDomain?.y ?? [
      Math.max(0, (min(allY) ?? 0) - 0.05),
      Math.min(1.5, (max(allY) ?? 1) + 0.05),
    ];

    return {
      xScale: scaleLinear().domain(xDomain).range([0, pw]),
      yScale: scaleLinear().domain(yDomain).range([ph, 0]),
      plotW: pw,
      plotH: ph,
    };
  }, [series, dimensions, margin.left, margin.right, margin.top, margin.bottom, zoomDomain]);

  // Generate line paths
  const linePaths = useMemo(() => {
    const lineGen = line<[number, number]>()
      .x((d) => xScale(d[0]))
      .y((d) => yScale(d[1]))
      .curve(curveMonotoneX);

    return series.map((s) => ({
      ...s,
      path: lineGen(s.data) ?? '',
    }));
  }, [series, xScale, yScale]);

  // Area fills (AIM-style gradient areas under lines)
  const areaGen = useMemo(() => {
    return area<[number, number]>()
      .x((d) => xScale(d[0]))
      .y0(plotH)
      .y1((d) => yScale(d[1]))
      .curve(curveMonotoneX);
  }, [xScale, yScale, plotH]);

  // D3 brush (AIM's zoom pattern)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const plotGroup = select(svg).select<SVGGElement>('.brush-group');
    plotGroup.selectAll('.brush').remove();

    const brush = brushX()
      .extent([[0, 0], [plotW, plotH]])
      .on('start', () => { brushingRef.current = true; })
      .on('end', (event) => {
        brushingRef.current = false;
        if (!event.selection) return;
        const [x0, x1] = event.selection as [number, number];
        const newXDomain: [number, number] = [xScale.invert(x0), xScale.invert(x1)];

        // Filter Y to visible X range
        const visibleY = series.flatMap((s) =>
          s.data.filter((d) => d[0] >= newXDomain[0] && d[0] <= newXDomain[1]).map((d) => d[1])
        );
        const yMin = Math.max(0, (min(visibleY) ?? 0) - 0.03);
        const yMax = Math.min(1.5, (max(visibleY) ?? 1) + 0.03);

        setZoomDomain({ x: newXDomain, y: [yMin, yMax] });
        plotGroup.select<SVGGElement>('.brush').call(brush.move, null);
      });

    plotGroup.append('g').attr('class', 'brush').call(brush);

    return () => { plotGroup.selectAll('.brush').remove(); };
  }, [plotW, plotH, xScale, series]);

  // Hover crosshair handler
  const [hover, setHover] = useState<{ x: number; values: { label: string; color: string; value: number }[] } | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (brushingRef.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - margin.left;
    const xVal = xScale.invert(mouseX);

    const values = series.map((s) => {
      const bisect = bisector((d: [number, number]) => d[0]).left;
      const idx = bisect(s.data, xVal);
      const d0 = s.data[idx - 1];
      const d1 = s.data[idx];
      const nearest = !d0 ? d1 : !d1 ? d0 : (xVal - d0[0] > d1[0] - xVal ? d1 : d0);
      return { label: s.label, color: s.color, value: nearest?.[1] ?? 0 };
    });

    setHover({ x: mouseX, values });
  }, [series, xScale, margin.left]);

  const xTicks = xScale.ticks(6);
  const yTicks = yScale.ticks(5);

  return (
    <div ref={containerRef} className="w-full relative" style={{ contain: 'layout style', transform: 'translateZ(0)' }}>
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {series.map((s) => (
            <linearGradient key={`grad-${s.key}`} id={`area-grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
          <clipPath id="plot-clip">
            <rect x={0} y={0} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Y axis grid */}
          {yTicks.map((t) => (
            <line key={`yg-${t}`} x1={0} y1={yScale(t)} x2={plotW} y2={yScale(t)} stroke="currentColor" strokeOpacity={0.06} />
          ))}
          {/* X axis grid */}
          {xTicks.map((t) => (
            <line key={`xg-${t}`} x1={xScale(t)} y1={0} x2={xScale(t)} y2={plotH} stroke="currentColor" strokeOpacity={0.04} />
          ))}

          {/* Area fills */}
          {series.map((s) => (
            <path key={`area-${s.key}`} d={areaGen(s.data) ?? ''} fill={`url(#area-grad-${s.key})`} clipPath="url(#plot-clip)" />
          ))}

          {/* Lines */}
          {linePaths.map((lp) => (
            <path key={`line-${lp.key}`} d={lp.path} fill="none" stroke={lp.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" clipPath="url(#plot-clip)" />
          ))}

          {/* Hover crosshair */}
          {hover && hover.x >= 0 && hover.x <= plotW && (
            <>
              <line x1={hover.x} y1={0} x2={hover.x} y2={plotH} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="4 3" />
              {hover.values.map((v, i) => {
                const cy = yScale(v.value);
                return (
                  <g key={i}>
                    <circle cx={hover.x} cy={cy} r={5} fill={v.color} fillOpacity={0.2} />
                    <circle cx={hover.x} cy={cy} r={3} fill={v.color} />
                  </g>
                );
              })}
            </>
          )}

          {/* Y axis labels */}
          {yTicks.map((t) => (
            <text key={`yt-${t}`} x={-8} y={yScale(t) + 3} textAnchor="end" fontSize={9} className="fill-muted-foreground" fillOpacity={0.6}>{t.toFixed(2)}</text>
          ))}
          {/* X axis labels */}
          {xTicks.map((t) => (
            <text key={`xt-${t}`} x={xScale(t)} y={plotH + 18} textAnchor="middle" fontSize={9} className="fill-muted-foreground" fillOpacity={0.6}>{t}</text>
          ))}

          <text x={plotW / 2} y={plotH + 34} textAnchor="middle" fontSize={10} className="fill-muted-foreground" fontWeight={500}>{xLabel}</text>
          <text x={-plotH / 2} y={-42} textAnchor="middle" fontSize={10} className="fill-muted-foreground" fontWeight={500} transform="rotate(-90)">{yLabel}</text>

          {/* Brush group */}
          <g className="brush-group" />
        </g>
      </svg>

      {/* Hover tooltip */}
      {hover && hover.x >= 0 && hover.x <= plotW && (
        <div
          className="absolute pointer-events-none bg-card/90 backdrop-blur-sm border border-border/40 rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(hover.x + margin.left + 12, dimensions.width - 140), top: margin.top + 8, transform: 'translateZ(0)' }}
        >
          <div className="font-mono text-muted-foreground/60 mb-1">Step {xScale.invert(hover.x).toFixed(0)}</div>
          {hover.values.map((v, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
              <span className="text-muted-foreground">{v.label}</span>
              <span className="font-mono font-medium ml-auto" style={{ color: v.color }}>{v.value.toFixed(4)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Zoom reset */}
      {zoomDomain && (
        <button
          onClick={() => setZoomDomain(null)}
          className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md bg-card/80 border border-border/30 text-[10px] text-muted-foreground hover:text-pfc-violet hover:border-pfc-violet/30 transition-colors cursor-pointer"
        >
          <RotateCcwIcon className="h-3 w-3" /> Reset Zoom
        </button>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 px-2">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-[10px]">
            <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
          </div>
        ))}
        <span className="text-[9px] text-muted-foreground/40 ml-auto">Drag to zoom</span>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// AIM-inspired: D3 Scatter Plot (Scatters Explorer pattern)
// ---------------------------------------------------------------------------

interface ScatterPoint {
  x: number;
  y: number;
  label: string;
  color: string;
  r?: number;
}

const D3ScatterPlot = memo(function D3ScatterPlot({
  points,
  xLabel = 'X',
  yLabel = 'Y',
  height = 300,
}: {
  points: ScatterPoint[];
  xLabel?: string;
  yLabel?: string;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const margin = { top: 20, right: 30, bottom: 44, left: 56 };

  const resizeCb = useCallback((entry: ResizeObserverEntry) => {
    const w = entry.contentRect.width;
    if (w > 0) setDimensions({ width: w, height });
  }, [height]);

  useResizeObserver(containerRef, resizeCb);

  const { xScale, yScale, plotW, plotH } = useMemo(() => {
    const pw = dimensions.width - margin.left - margin.right;
    const ph = dimensions.height - margin.top - margin.bottom;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const pad = 0.05;

    return {
      xScale: scaleLinear().domain([(min(xs) ?? 0) - pad, (max(xs) ?? 1) + pad]).range([0, pw]),
      yScale: scaleLinear().domain([(min(ys) ?? 0) - pad, (max(ys) ?? 1) + pad]).range([ph, 0]),
      plotW: pw,
      plotH: ph,
    };
  }, [points, dimensions, margin.left, margin.right, margin.top, margin.bottom]);

  const xTicks = xScale.ticks(6);
  const yTicks = yScale.ticks(5);

  return (
    <div ref={containerRef} className="w-full relative" style={{ contain: 'layout style', transform: 'translateZ(0)' }}>
      <svg width={dimensions.width} height={dimensions.height} className="select-none">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {yTicks.map((t) => <line key={`yg-${t}`} x1={0} y1={yScale(t)} x2={plotW} y2={yScale(t)} stroke="currentColor" strokeOpacity={0.06} />)}
          {xTicks.map((t) => <line key={`xg-${t}`} x1={xScale(t)} y1={0} x2={xScale(t)} y2={plotH} stroke="currentColor" strokeOpacity={0.04} />)}

          {points.map((p, i) => {
            const cx = xScale(p.x), cy = yScale(p.y);
            const isHovered = hoveredIdx === i;
            const r = p.r ?? 6;
            return (
              <g key={i} onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)} className="cursor-pointer">
                {isHovered && <circle cx={cx} cy={cy} r={r + 6} fill={p.color} fillOpacity={0.12} />}
                <circle cx={cx} cy={cy} r={isHovered ? r + 1 : r} fill={p.color} fillOpacity={0.7} stroke={p.color} strokeWidth={isHovered ? 2 : 1} strokeOpacity={0.4} />
                {isHovered && <text x={cx} y={cy - r - 6} textAnchor="middle" fontSize={9} fill={p.color} fontWeight={600}>{p.label}</text>}
              </g>
            );
          })}

          {yTicks.map((t) => <text key={`yt-${t}`} x={-8} y={yScale(t) + 3} textAnchor="end" fontSize={9} className="fill-muted-foreground" fillOpacity={0.6}>{t.toFixed(2)}</text>)}
          {xTicks.map((t) => <text key={`xt-${t}`} x={xScale(t)} y={plotH + 18} textAnchor="middle" fontSize={9} className="fill-muted-foreground" fillOpacity={0.6}>{t.toFixed(2)}</text>)}

          <text x={plotW / 2} y={plotH + 36} textAnchor="middle" fontSize={10} className="fill-muted-foreground" fontWeight={500}>{xLabel}</text>
          <text x={-plotH / 2} y={-42} textAnchor="middle" fontSize={10} className="fill-muted-foreground" fontWeight={500} transform="rotate(-90)">{yLabel}</text>

          <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="currentColor" strokeOpacity={0.15} />
          <line x1={0} y1={0} x2={0} y2={plotH} stroke="currentColor" strokeOpacity={0.15} />
        </g>
      </svg>

      {hoveredIdx !== null && points[hoveredIdx] && (
        <div className="absolute pointer-events-none bg-card/90 backdrop-blur-sm border border-border/40 rounded-lg px-3 py-2 text-xs shadow-lg"
          style={{ left: xScale(points[hoveredIdx].x) + margin.left + 14, top: yScale(points[hoveredIdx].y) + margin.top - 10, transform: 'translateZ(0)' }}>
          <div className="font-medium" style={{ color: points[hoveredIdx].color }}>{points[hoveredIdx].label}</div>
          <div className="text-muted-foreground/60 font-mono">({points[hoveredIdx].x.toFixed(3)}, {points[hoveredIdx].y.toFixed(3)})</div>
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// AIM-inspired: D3 Force-Directed Concept Graph
// ---------------------------------------------------------------------------

const D3ForceGraph = memo(function D3ForceGraph({
  concepts,
  height = 320,
}: {
  concepts: string[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height });
  const [nodes, setNodes] = useState<Array<{ id: string; x: number; y: number; color: string }>>([]);
  const [links, setLinks] = useState<Array<{ source: string; target: string }>>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const COLORS = [EMBER, VIOLET, GREEN, CYAN, YELLOW, PINK, TEAL, RED];

  const resizeCb = useCallback((entry: ResizeObserverEntry) => {
    const w = entry.contentRect.width;
    if (w > 0) setDimensions({ width: w, height });
  }, [height]);

  useResizeObserver(containerRef, resizeCb);

  useEffect(() => {
    if (concepts.length === 0) return;

    const simNodes = concepts.map((c, i) => ({
      id: c,
      x: dimensions.width / 2 + (Math.random() - 0.5) * 100,
      y: dimensions.height / 2 + (Math.random() - 0.5) * 100,
      color: COLORS[i % COLORS.length],
    }));

    const simLinks: Array<{ source: string; target: string }> = [];
    for (let i = 0; i < concepts.length; i++) {
      const next = (i + 1) % concepts.length;
      simLinks.push({ source: concepts[i], target: concepts[next] });
      if (concepts.length > 3) {
        const skip = (i + 2) % concepts.length;
        simLinks.push({ source: concepts[i], target: concepts[skip] });
      }
    }

    const sim = forceSimulation(simNodes as any)
      .force('link', forceLink(simLinks as any).id((d: any) => d.id).distance(80).strength(0.3))
      .force('charge', forceManyBody().strength(-200))
      .force('center', forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force('collision', forceCollide().radius(30))
      .on('tick', () => {
        setNodes([...simNodes as any]);
        setLinks([...simLinks]);
      });

    const timer = setTimeout(() => sim.alphaTarget(0).restart(), 3000);

    return () => {
      clearTimeout(timer);
      sim.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concepts.join('|'), dimensions.width, dimensions.height]);

  if (concepts.length === 0) {
    return <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No active concepts</div>;
  }

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <div ref={containerRef} className="w-full" style={{ contain: 'layout style', transform: 'translateZ(0)' }}>
      <svg width={dimensions.width} height={dimensions.height} className="select-none">
        {links.map((l, i) => {
          const s = nodeMap[typeof l.source === 'string' ? l.source : (l.source as any).id];
          const t = nodeMap[typeof l.target === 'string' ? l.target : (l.target as any).id];
          if (!s || !t) return null;
          const isHighlighted = hoveredNode === s.id || hoveredNode === t.id;
          return <line key={`link-${i}`} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={isHighlighted ? VIOLET : 'currentColor'} strokeOpacity={isHighlighted ? 0.4 : 0.08} strokeWidth={isHighlighted ? 2 : 1} />;
        })}

        {nodes.map((n) => {
          const isHovered = hoveredNode === n.id;
          return (
            <g key={n.id} onMouseEnter={() => setHoveredNode(n.id)} onMouseLeave={() => setHoveredNode(null)} className="cursor-pointer">
              {isHovered && <circle cx={n.x} cy={n.y} r={28} fill={n.color} fillOpacity={0.1} />}
              <circle cx={n.x} cy={n.y} r={isHovered ? 18 : 14} fill={n.color} fillOpacity={isHovered ? 0.25 : 0.15} stroke={n.color} strokeWidth={isHovered ? 2 : 1.5} />
              <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="central" fontSize={isHovered ? 9 : 8} fill={n.color} fontWeight={isHovered ? 600 : 500}>
                {n.id.length > 12 ? n.id.slice(0, 11) + '\u2026' : n.id}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Interactive Signal Radar
// ---------------------------------------------------------------------------

const SIGNAL_KEYS = ['confidence', 'entropy', 'dissonance', 'healthScore'] as const;
type SignalKey = typeof SIGNAL_KEYS[number];

function InteractiveSignalRadar({
  confidence, entropy, dissonance, healthScore, overrides, onSignalChange,
}: {
  confidence: number; entropy: number; dissonance: number; healthScore: number;
  overrides: { confidence: number | null; entropy: number | null; dissonance: number | null; healthScore: number | null };
  onSignalChange: (signal: SignalKey, value: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  const cx = 150, cy = 150, maxR = 120;
  const axes = [
    { label: 'Confidence', key: 'confidence' as SignalKey, value: overrides.confidence ?? confidence, autoValue: confidence, angle: 0, isOverridden: overrides.confidence !== null },
    { label: 'Entropy', key: 'entropy' as SignalKey, value: Math.min(1, overrides.entropy ?? entropy), autoValue: Math.min(1, entropy), angle: 90, isOverridden: overrides.entropy !== null },
    { label: 'Dissonance', key: 'dissonance' as SignalKey, value: Math.min(1, overrides.dissonance ?? dissonance), autoValue: Math.min(1, dissonance), angle: 180, isOverridden: overrides.dissonance !== null },
    { label: 'Health', key: 'healthScore' as SignalKey, value: overrides.healthScore ?? healthScore, autoValue: healthScore, angle: 270, isOverridden: overrides.healthScore !== null },
  ];

  const autoPoints = axes.map((a) => polar(cx, cy, valToRadius(a.autoValue, maxR), a.angle));
  const autoPolygon = autoPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const points = axes.map((a) => polar(cx, cy, valToRadius(a.value, maxR), a.angle));
  const polygon = points.map((p) => `${p.x},${p.y}`).join(' ');
  const rings = [0.25, 0.5, 0.75, 1];
  const hasAnyOverride = axes.some((a) => a.isOverridden);

  const getSvgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return { x: -50 + ((clientX - rect.left) / rect.width) * 400, y: -30 + ((clientY - rect.top) / rect.height) * 360 };
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
    const dx = pt.x - cx, dy = pt.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const value = Math.max(0, Math.min(1, (dist - 20) / (maxR - 20)));
    onSignalChange(axes[dragging].key, Math.round(value * 100) / 100);
  }, [dragging, axes, getSvgPoint, onSignalChange, cx, cy, maxR]);

  return (
    <svg ref={svgRef} viewBox="-50 -30 400 360" overflow="visible"
      className={cn('w-full max-w-md mx-auto', dragging !== null ? 'cursor-grabbing' : '')}
      onPointerMove={handlePointerMove} onPointerUp={() => setDragging(null)} onPointerLeave={() => setDragging(null)}
      style={{ touchAction: 'none' }}>
      {rings.map((r) => <circle key={r} cx={cx} cy={cy} r={20 + r * (maxR - 20)} fill="none" stroke="currentColor" strokeOpacity={0.1} />)}
      {rings.map((r) => <text key={`r${r}`} x={cx + 4} y={cy - (20 + r * (maxR - 20)) + 3} fontSize={7} className="fill-muted-foreground" fillOpacity={0.4}>{r.toFixed(2)}</text>)}
      {axes.map((a) => { const end = polar(cx, cy, maxR + 4, a.angle); return <line key={a.label} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="currentColor" strokeOpacity={0.15} />; })}
      {hasAnyOverride && <polygon points={autoPolygon} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={1.5} strokeDasharray="4 3" />}
      <polygon points={polygon} fill={EMBER} fillOpacity={0.2} stroke={EMBER} strokeWidth={2} />
      {hasAnyOverride && autoPoints.map((p, i) => axes[i].isOverridden ? <circle key={`g${i}`} cx={p.x} cy={p.y} r={3} fill="currentColor" fillOpacity={0.2} /> : null)}
      {points.map((p, i) => {
        const isHovered = hoveredPoint === i, isDragging = dragging === i, isOverridden = axes[i].isOverridden;
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={20} fill="transparent" className="cursor-grab"
              onPointerDown={(e) => handlePointerDown(i, e)} onPointerEnter={() => setHoveredPoint(i)} onPointerLeave={() => setHoveredPoint(null)}
              style={{ touchAction: 'none' }} />
            {(isHovered || isDragging) && <circle cx={p.x} cy={p.y} r={isDragging ? 10 : 8} fill={EMBER} fillOpacity={0.15} stroke={EMBER} strokeOpacity={0.3} />}
            {isOverridden && <circle cx={p.x} cy={p.y} r={7} fill="none" stroke={VIOLET} strokeWidth={1.5} strokeDasharray="2 2" />}
            <circle cx={p.x} cy={p.y} r={isDragging ? 6 : isHovered ? 5.5 : 4} fill={isOverridden ? VIOLET : EMBER} className="cursor-grab" />
          </g>
        );
      })}
      {axes.map((a) => { const pos = polar(cx, cy, maxR + 30, a.angle); return <text key={a.label} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground" fontSize={11} fontWeight={500}>{a.label}{a.isOverridden && ' \u270E'}</text>; })}
      {axes.map((a, i) => <text key={`v${i}`} x={points[i].x} y={points[i].y - 12} textAnchor="middle" fontSize={9} fill={a.isOverridden ? VIOLET : EMBER} fontWeight={600}>{a.value.toFixed(2)}{a.isOverridden && <tspan fontSize={7} fillOpacity={0.6}>{` (auto: ${a.autoValue.toFixed(2)})`}</tspan>}</text>)}
      <text x={cx} y={cy + maxR + 55} textAnchor="middle" fontSize={9} className="fill-muted-foreground" fillOpacity={0.5}>Drag points to manually set signals</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Pipeline Flow
// ---------------------------------------------------------------------------

function PipelineFlow({ stages }: { stages: { stage: string; status: string; summary: string }[] }) {
  const nodeR = 18, spacing = 64, startX = 40, midY = 50;
  const totalW = startX * 2 + (stages.length - 1) * spacing;
  return (
    <svg viewBox={`0 0 ${totalW} 100`} className="w-full" overflow="visible" preserveAspectRatio="xMidYMid meet">
      {stages.slice(0, -1).map((_, i) => <line key={`l${i}`} x1={startX + i * spacing + nodeR} y1={midY} x2={startX + (i + 1) * spacing - nodeR} y2={midY} stroke="currentColor" strokeOpacity={0.2} strokeWidth={2} />)}
      {stages.map((s, i) => {
        const nodeCx = startX + i * spacing;
        const color = STATUS_COLOR[s.status] || STATUS_COLOR.idle;
        const isActive = s.status === 'active';
        return (
          <g key={s.stage}>
            {isActive && <circle cx={nodeCx} cy={midY} r={nodeR + 4} fill="none" stroke={color} strokeWidth={2} opacity={0.5}><animate attributeName="r" from={String(nodeR + 2)} to={String(nodeR + 10)} dur="1.5s" repeatCount="indefinite" /><animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" /></circle>}
            <circle cx={nodeCx} cy={midY} r={nodeR} fill={color} fillOpacity={s.status === 'idle' ? 0.25 : 0.85} stroke={color} strokeWidth={s.status === 'idle' ? 1 : 2} />
            <text x={nodeCx} y={midY + 1} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={600} fill="white">{i + 1}</text>
            <text x={nodeCx} y={midY + nodeR + 14} textAnchor="middle" fontSize={8} className="fill-muted-foreground">{s.summary.length > 16 ? s.summary.slice(0, 15) + '\u2026' : s.summary}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// TDA Landscape
// ---------------------------------------------------------------------------

function TDALandscape({ betti0, betti1, persistenceEntropy, maxPersistence }: { betti0: number; betti1: number; persistenceEntropy: number; maxPersistence: number }) {
  const barW = 48, gap = 24, chartH = 140;
  const labels = ['Betti-0', 'Betti-1', 'Max Pers.'];
  const values = [betti0, betti1, maxPersistence];
  const maxVal = Math.max(1, ...values);
  const totalW = labels.length * (barW + gap) + gap + 160;
  const entCx = labels.length * (barW + gap) + gap + 80, entCy = 90, entR = 45;
  const entAngle = Math.min(1, persistenceEntropy) * 360;

  function arcPath(angle: number) {
    const startRad = (-90 * Math.PI) / 180;
    const endRad = ((-90 + angle) * Math.PI) / 180;
    const x1 = entCx + entR * Math.cos(startRad), y1 = entCy + entR * Math.sin(startRad);
    const x2 = entCx + entR * Math.cos(endRad), y2 = entCy + entR * Math.sin(endRad);
    return `M ${x1} ${y1} A ${entR} ${entR} 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  }

  return (
    <svg viewBox={`0 0 ${totalW} ${chartH + 40}`} overflow="visible" className="w-full max-w-xl mx-auto">
      {values.map((v, i) => { const x = gap + i * (barW + gap); const h = Math.max(2, (v / maxVal) * chartH); const y = chartH - h + 10; return (
        <g key={labels[i]}><rect x={x} y={y} width={barW} height={h} rx={4} fill={VIOLET} fillOpacity={0.7} /><text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={10} fill={VIOLET} fontWeight={600}>{v}</text><text x={x + barW / 2} y={chartH + 24} textAnchor="middle" fontSize={9} className="fill-muted-foreground">{labels[i]}</text></g>
      ); })}
      <circle cx={entCx} cy={entCy} r={entR} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={6} />
      {entAngle > 0 && <path d={arcPath(entAngle)} fill="none" stroke={CYAN} strokeWidth={6} strokeLinecap="round" />}
      <text x={entCx} y={entCy - 4} textAnchor="middle" fontSize={14} fill={CYAN} fontWeight={700}>{persistenceEntropy.toFixed(3)}</text>
      <text x={entCx} y={entCy + 12} textAnchor="middle" fontSize={9} className="fill-muted-foreground">Pers. Entropy</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Risk Matrix
// ---------------------------------------------------------------------------

function RiskMatrix({ riskScore, confidence }: { riskScore: number; confidence: number }) {
  const size = 260, pad = 40, gridSize = size - pad * 2, half = gridSize / 2;
  const quadrants = [
    { x: 0, y: 0, color: GREEN, label: 'Low Risk\nHigh Conf', opacity: 0.15 },
    { x: 1, y: 0, color: '#F97316', label: 'High Risk\nHigh Conf', opacity: 0.15 },
    { x: 0, y: 1, color: YELLOW, label: 'Low Risk\nLow Conf', opacity: 0.15 },
    { x: 1, y: 1, color: RED, label: 'High Risk\nLow Conf', opacity: 0.15 },
  ];
  const dotX = pad + Math.min(1, Math.max(0, riskScore)) * gridSize;
  const dotY = pad + Math.min(1, Math.max(0, 1 - confidence)) * gridSize;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} overflow="visible" className="w-full max-w-sm mx-auto">
      {quadrants.map((q, i) => <rect key={i} x={pad + q.x * half} y={pad + q.y * half} width={half} height={half} fill={q.color} fillOpacity={q.opacity} rx={4} />)}
      <rect x={pad} y={pad} width={gridSize} height={gridSize} fill="none" stroke="currentColor" strokeOpacity={0.2} />
      <line x1={pad + half} y1={pad} x2={pad + half} y2={pad + gridSize} stroke="currentColor" strokeOpacity={0.15} />
      <line x1={pad} y1={pad + half} x2={pad + gridSize} y2={pad + half} stroke="currentColor" strokeOpacity={0.15} />
      {quadrants.map((q, i) => { const lines = q.label.split('\n'); const tx = pad + q.x * half + half / 2; const ty = pad + q.y * half + half / 2; return <g key={`l${i}`}>{lines.map((line, li) => <text key={li} x={tx} y={ty + (li - 0.5) * 12} textAnchor="middle" fontSize={8} className="fill-muted-foreground" fontWeight={500}>{line}</text>)}</g>; })}
      <text x={pad + gridSize / 2} y={size - 4} textAnchor="middle" fontSize={10} className="fill-muted-foreground" fontWeight={600}>Risk Score</text>
      <text x={10} y={pad + gridSize / 2} textAnchor="middle" fontSize={10} className="fill-muted-foreground" fontWeight={600} transform={`rotate(-90, 10, ${pad + gridSize / 2})`}>Uncertainty</text>
      <circle cx={dotX} cy={dotY} r={8} fill={EMBER} fillOpacity={0.3}><animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite" /></circle>
      <circle cx={dotX} cy={dotY} r={5} fill={EMBER} />
      <text x={dotX} y={dotY - 12} textAnchor="middle" fontSize={8} fill={EMBER} fontWeight={700}>({riskScore.toFixed(2)}, {(1 - confidence).toFixed(2)})</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Harmony Spectrum
// ---------------------------------------------------------------------------

function HarmonySpectrum({ harmonyKeyDistance, activeChordProduct }: { harmonyKeyDistance: number; activeChordProduct: number }) {
  const w = 400, h = 100, barY = 35, barH = 24, barX = 30, barW = w - 60;
  const normHarmony = Math.min(1, Math.max(0, harmonyKeyDistance));
  const markerX = barX + normHarmony * barW;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} overflow="visible" className="w-full max-w-lg mx-auto">
      <defs><linearGradient id="harmony-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={GREEN} /><stop offset="50%" stopColor={YELLOW} /><stop offset="100%" stopColor={RED} /></linearGradient></defs>
      <rect x={barX} y={barY} width={barW} height={barH} rx={barH / 2} fill="url(#harmony-grad)" fillOpacity={0.7} />
      <rect x={barX} y={barY} width={barW} height={barH} rx={barH / 2} fill="none" stroke="currentColor" strokeOpacity={0.15} />
      <circle cx={markerX} cy={barY + barH / 2} r={barH / 2 + 4} fill="var(--background)" stroke={EMBER} strokeWidth={3} />
      <circle cx={markerX} cy={barY + barH / 2} r={4} fill={EMBER} />
      <text x={barX} y={barY - 8} fontSize={9} fill={GREEN} fontWeight={600}>Harmonious</text>
      <text x={barX + barW} y={barY - 8} textAnchor="end" fontSize={9} fill={RED} fontWeight={600}>Dissonant</text>
      <text x={markerX} y={barY + barH + 20} textAnchor="middle" fontSize={10} fill={EMBER} fontWeight={700}>Key Distance: {harmonyKeyDistance.toFixed(3)}</text>
      <text x={w / 2} y={barY + barH + 36} textAnchor="middle" fontSize={9} className="fill-muted-foreground">Active Chord Product: {activeChordProduct.toFixed(4)}</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Card wrapper (AIM-inspired chart panel)
// ---------------------------------------------------------------------------

function DashCard({ title, icon: Icon, iconColor, children, className, span = 1 }: {
  title: string; icon: React.ComponentType<{ className?: string }>; iconColor?: string;
  children: React.ReactNode; className?: string; span?: 1 | 2;
}) {
  return (
    <div className={cn('rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm overflow-hidden', span === 2 && 'md:col-span-2', className)}
      style={{ contain: 'layout style', transform: 'translateZ(0)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/10">
        <span style={{ color: iconColor }}><Icon className="h-3.5 w-3.5 shrink-0" /></span>
        <span className="text-xs font-semibold tracking-wide">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TAB_DEFS = [
  { value: 'dashboard', label: 'Dashboard', icon: GridIcon },
  { value: 'metrics', label: 'Metrics Explorer', icon: TrendingUpIcon },
  { value: 'scatter', label: 'Scatter Plot', icon: TargetIcon },
  { value: 'radar', label: 'Signal Radar', icon: RadarIcon },
  { value: 'pipeline', label: 'Pipeline', icon: NetworkIcon },
  { value: 'concepts', label: 'Force Graph', icon: BrainIcon },
  { value: 'tda', label: 'TDA', icon: ActivityIcon },
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

  // Generate simulated time-series data (AIM Metrics Explorer style)
  const signalHistory = useMemo(() => {
    const steps = 50;
    const confData: [number, number][] = [];
    const entData: [number, number][] = [];
    const dissData: [number, number][] = [];
    const healthData: [number, number][] = [];

    let c = Math.max(0.1, confidence - 0.2 + Math.random() * 0.1);
    let e = Math.max(0.05, entropy * 0.5 + Math.random() * 0.2);
    let di = Math.max(0.05, dissonance * 0.3 + Math.random() * 0.15);
    let h = Math.max(0.2, healthScore - 0.15 + Math.random() * 0.1);

    for (let i = 0; i < steps; i++) {
      confData.push([i, c]);
      entData.push([i, Math.min(1, e)]);
      dissData.push([i, Math.min(1, di)]);
      healthData.push([i, h]);

      c += (confidence - c) * 0.06 + (Math.random() - 0.5) * 0.04;
      c = Math.max(0, Math.min(1, c));
      e += (entropy - e) * 0.06 + (Math.random() - 0.5) * 0.05;
      e = Math.max(0, Math.min(1.5, e));
      di += (dissonance - di) * 0.06 + (Math.random() - 0.5) * 0.03;
      di = Math.max(0, Math.min(1, di));
      h += (healthScore - h) * 0.06 + (Math.random() - 0.5) * 0.04;
      h = Math.max(0, Math.min(1, h));
    }

    return [
      { key: 'confidence', label: 'Confidence', color: EMBER, data: confData },
      { key: 'entropy', label: 'Entropy', color: CYAN, data: entData },
      { key: 'dissonance', label: 'Dissonance', color: RED, data: dissData },
      { key: 'health', label: 'Health', color: GREEN, data: healthData },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confidence, entropy, dissonance, healthScore]);

  // Generate scatter plot data (AIM Scatter Explorer style)
  const scatterPoints = useMemo(() => {
    const pts: ScatterPoint[] = [];
    const signals = [
      { label: 'Confidence', x: confidence, y: healthScore, color: EMBER },
      { label: 'Entropy', x: entropy, y: 1 - dissonance, color: CYAN },
      { label: 'Risk', x: riskScore, y: confidence, color: RED },
      { label: 'Harmony', x: 1 - harmonyKeyDistance, y: healthScore, color: GREEN },
    ];
    for (const s of signals) pts.push({ ...s, r: 8 });
    for (let i = 0; i < 20; i++) {
      const base = signals[i % signals.length];
      pts.push({
        label: `Run ${i + 1}`,
        x: base.x + (Math.random() - 0.5) * 0.3,
        y: base.y + (Math.random() - 0.5) * 0.3,
        color: base.color,
        r: 4,
      });
    }
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confidence, entropy, dissonance, healthScore, riskScore, harmonyKeyDistance]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--chat-surface)]">
        <PixelBook size={40} />
      </div>
    );
  }

  return (
    <PageShell icon={BarChart3Icon} iconColor="var(--color-pfc-ember)" title="Visualizer" subtitle="AIM-fused interactive visualization dashboard">
      {/* Live signal badges */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Badge variant="outline" className="text-xs font-mono">Confidence {confidence.toFixed(2)}</Badge>
        <Badge variant="outline" className="text-xs font-mono">Health {healthScore.toFixed(2)}</Badge>
        <Badge variant="outline" className="text-xs font-mono">Entropy {entropy.toFixed(3)}</Badge>
        <Badge variant="outline" className="text-xs font-mono">Risk {riskScore.toFixed(2)}</Badge>
        {hasOverrides && (
          <GlassBubbleButton color="violet" size="sm" onClick={resetAllSignalOverrides}>
            <RotateCcwIcon className="h-3 w-3" /> Reset Overrides
          </GlassBubbleButton>
        )}
      </div>

      <GlassSection title="Visualizations" className="">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="mb-6 flex w-full overflow-x-auto">
            {TAB_DEFS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.value} value={t.value} className="flex items-center gap-1.5 shrink-0">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* DASHBOARD — AIM-style grid overview */}
          <TabsContent value="dashboard">
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, ease: CUP }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ contain: 'layout', transform: 'translateZ(0)' }}>
                <DashCard title="Signal History" icon={TrendingUpIcon} iconColor={EMBER} span={2}>
                  <D3LineChart series={signalHistory} xLabel="Step" yLabel="Value" height={240} />
                </DashCard>
                <DashCard title="Signal Radar" icon={RadarIcon} iconColor={EMBER}>
                  <InteractiveSignalRadar confidence={confidence} entropy={entropy} dissonance={dissonance} healthScore={healthScore} overrides={userSignalOverrides} onSignalChange={handleSignalChange} />
                </DashCard>
                <DashCard title="Risk Matrix" icon={TargetIcon} iconColor={RED}>
                  <RiskMatrix riskScore={riskScore} confidence={confidence} />
                </DashCard>
                <DashCard title="Pipeline Flow" icon={NetworkIcon} iconColor={EMBER} span={2}>
                  <PipelineFlow stages={pipelineStages} />
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-3">
                    {Object.entries(STATUS_COLOR).map(([status, color]) => (
                      <span key={status} className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    ))}
                  </div>
                </DashCard>
                <DashCard title="TDA Landscape" icon={ActivityIcon} iconColor={VIOLET}>
                  <TDALandscape betti0={tda.betti0} betti1={tda.betti1} persistenceEntropy={tda.persistenceEntropy} maxPersistence={tda.maxPersistence} />
                </DashCard>
                <DashCard title="Harmony Spectrum" icon={ActivityIcon} iconColor={GREEN}>
                  <HarmonySpectrum harmonyKeyDistance={harmonyKeyDistance} activeChordProduct={activeChordProduct} />
                </DashCard>
              </div>
            </motion.div>
          </TabsContent>

          {/* METRICS EXPLORER — AIM-style D3 line chart */}
          <TabsContent value="metrics">
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, ease: CUP }}>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUpIcon className="h-4 w-4 text-pfc-ember" />
                  <h3 className="text-base font-semibold">Metrics Explorer</h3>
                  <Badge variant="outline" className="text-[10px]">D3-powered</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Interactive signal time-series with hover crosshairs and brush-to-zoom.
                  Drag across the chart to zoom into a region.
                </p>
                <D3LineChart series={signalHistory} xLabel="Analysis Step" yLabel="Signal Value" height={360} />
              </div>
            </motion.div>
          </TabsContent>

          {/* SCATTER PLOT — AIM-style D3 scatter */}
          <TabsContent value="scatter">
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, ease: CUP }}>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <TargetIcon className="h-4 w-4 text-pfc-violet" />
                  <h3 className="text-base font-semibold">Scatter Plot</h3>
                  <Badge variant="outline" className="text-[10px]">D3-powered</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Multi-signal scatter plot showing relationships between analytical dimensions. Hover for details.
                </p>
                <D3ScatterPlot points={scatterPoints} xLabel="Primary Signal" yLabel="Secondary Signal" height={400} />
              </div>
            </motion.div>
          </TabsContent>

          {/* Signal Radar */}
          <TabsContent value="radar">
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, ease: CUP }}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RadarIcon className="h-4 w-4 text-pfc-ember" />
                    <h3 className="text-base font-semibold">Signal Radar</h3>
                    {hasOverrides && <Badge variant="outline" className="ml-2 text-[10px] border-pfc-violet/40 text-pfc-violet">Manual Override Active</Badge>}
                  </div>
                  {hasOverrides && (
                    <GlassBubbleButton color="violet" size="sm" onClick={resetAllSignalOverrides}>
                      <RotateCcwIcon className="h-3 w-3" /> Reset to Auto
                    </GlassBubbleButton>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">Drag the data points to manually override signal values.</p>
                {hasOverrides && (
                  <div className="flex flex-wrap gap-2">
                    {SIGNAL_KEYS.map((key) => {
                      const override = userSignalOverrides[key];
                      if (override === null) return null;
                      const autoVal = key === 'entropy' ? Math.min(1, entropy) : key === 'dissonance' ? Math.min(1, dissonance) : key === 'confidence' ? confidence : healthScore;
                      return (
                        <button key={key} onClick={() => setSignalOverride(key, null)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border border-pfc-violet/30 bg-pfc-violet/5 text-pfc-violet hover:bg-pfc-violet/15 transition-colors cursor-pointer">
                          <span className="font-medium capitalize">{key === 'healthScore' ? 'Health' : key}</span>
                          <span className="font-mono">{override.toFixed(2)}</span>
                          <span className="text-[9px] opacity-60">(auto: {autoVal.toFixed(2)})</span>
                          <span className="ml-0.5 text-pfc-violet/60">{'\u2715'}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <InteractiveSignalRadar confidence={confidence} entropy={entropy} dissonance={dissonance} healthScore={healthScore} overrides={userSignalOverrides} onSignalChange={handleSignalChange} />
              </div>
            </motion.div>
          </TabsContent>

          {/* Pipeline */}
          <TabsContent value="pipeline">
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, ease: CUP }}>
              <div className="space-y-4">
                <div className="flex items-center gap-2"><NetworkIcon className="h-4 w-4 text-pfc-ember" /><h3 className="text-base font-semibold">Pipeline Flow</h3></div>
                <PipelineFlow stages={pipelineStages} />
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  {Object.entries(STATUS_COLOR).map(([status, color]) => (
                    <span key={status} className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          </TabsContent>

          {/* Force Graph */}
          <TabsContent value="concepts">
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, ease: CUP }}>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <BrainIcon className="h-4 w-4 text-pfc-violet" />
                  <h3 className="text-base font-semibold">Concept Force Graph</h3>
                  <Badge variant="outline" className="text-[10px]">D3-powered</Badge>
                </div>
                <p className="text-sm text-muted-foreground">D3 force-directed concept network. Hover to highlight connections.</p>
                <D3ForceGraph concepts={activeConcepts} height={400} />
              </div>
            </motion.div>
          </TabsContent>

          {/* TDA */}
          <TabsContent value="tda">
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, ease: CUP }}>
              <div className="space-y-4">
                <div className="flex items-center gap-2"><ActivityIcon className="h-4 w-4 text-pfc-violet" /><h3 className="text-base font-semibold">TDA Landscape</h3></div>
                <p className="text-sm text-muted-foreground">Topological Data Analysis snapshot. Betti numbers indicate connected components and loops.</p>
                <TDALandscape betti0={tda.betti0} betti1={tda.betti1} persistenceEntropy={tda.persistenceEntropy} maxPersistence={tda.maxPersistence} />
              </div>
            </motion.div>
          </TabsContent>

          {/* Risk Matrix */}
          <TabsContent value="risk">
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, ease: CUP }}>
              <div className="space-y-4">
                <div className="flex items-center gap-2"><TargetIcon className="h-4 w-4 text-pfc-red" /><h3 className="text-base font-semibold">Risk Matrix</h3></div>
                <RiskMatrix riskScore={riskScore} confidence={confidence} />
              </div>
            </motion.div>
          </TabsContent>

          {/* Harmony */}
          <TabsContent value="harmony">
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, ease: CUP }}>
              <div className="space-y-4">
                <div className="flex items-center gap-2"><ActivityIcon className="h-4 w-4 text-pfc-green" /><h3 className="text-base font-semibold">Harmony Spectrum</h3></div>
                <HarmonySpectrum harmonyKeyDistance={harmonyKeyDistance} activeChordProduct={activeChordProduct} />
              </div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </GlassSection>
    </PageShell>
  );
}
