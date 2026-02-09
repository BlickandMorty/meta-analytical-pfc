'use client';

import {
  useRef,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import { useChartSync } from '@/lib/viz/chart-sync';
import { useBrushZoom } from '@/lib/viz/brush-zoom';
import type { Domain } from '@/lib/viz/brush-zoom';
import type { SignalHistoryEntry } from '@/lib/store/use-pfc-store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CUPERTINO_EASE = [0.32, 0.72, 0, 1] as const;
const PADDING = { top: 20, right: 16, bottom: 28, left: 44 };
const POINT_RADIUS = 3;
const HOVER_RADIUS = 5;
const GRID_LINES = 5;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SignalChartProps {
  /** Unique id used for cross-chart hover sync */
  chartId: string;
  /** Array of signal history entries to visualise */
  data: SignalHistoryEntry[];
  /** Which numeric key to plot on the Y axis */
  dataKey: keyof Pick<SignalHistoryEntry, 'confidence' | 'entropy' | 'dissonance' | 'healthScore' | 'riskScore'>;
  /** Stroke / fill colour for this series */
  color: string;
  /** Human-readable label shown in the top-left corner */
  label: string;
  /** SVG height in px (default 200) */
  height?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPath(
  points: { x: number; y: number }[],
): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    // Smooth cubic bezier between points for organic feel
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function buildAreaPath(
  points: { x: number; y: number }[],
  bottomY: number,
): string {
  if (points.length === 0) return '';
  const line = buildPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatValue(v: number): string {
  return v.toFixed(3);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SignalChart({
  chartId,
  data,
  dataKey,
  color,
  label,
  height = 200,
}: SignalChartProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? resolvedTheme === 'dark' : true;

  // ---- Responsive width via ResizeObserver ----
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- Chart dimensions ----
  const plotW = width - PADDING.left - PADDING.right;
  const plotH = height - PADDING.top - PADDING.bottom;

  // ---- Compute initial domain from data ----
  const initialDomain = useMemo<Domain>(() => {
    if (data.length === 0) return { min: 0, max: 1 };
    const timestamps = data.map((d) => d.timestamp);
    return { min: Math.min(...timestamps), max: Math.max(...timestamps) };
  }, [data]);

  // ---- Brush zoom ----
  const {
    domain,
    brushState,
    brushStart,
    brushMove,
    brushEnd,
    canUndo,
    undo,
    resetZoom,
  } = useBrushZoom(initialDomain);

  // ---- Cross-chart sync ----
  const { onHover, onLeave, hoveredPoint } = useChartSync(chartId);

  // ---- Filter data to current domain ----
  const visibleData = useMemo(
    () => data.filter((d) => d.timestamp >= domain.min && d.timestamp <= domain.max),
    [data, domain],
  );

  // ---- Y-axis domain (auto-scale with padding) ----
  const yDomain = useMemo(() => {
    if (visibleData.length === 0) return { min: 0, max: 1 };
    const values = visibleData.map((d) => d[dataKey] as number);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = (hi - lo) * 0.1 || 0.05;
    return { min: Math.max(0, lo - pad), max: Math.min(1, hi + pad) };
  }, [visibleData, dataKey]);

  // ---- Scale functions ----
  const scaleX = useCallback(
    (ts: number) => {
      const t = (ts - domain.min) / (domain.max - domain.min || 1);
      return PADDING.left + t * plotW;
    },
    [domain, plotW],
  );

  const scaleY = useCallback(
    (v: number) => {
      const t = (v - yDomain.min) / (yDomain.max - yDomain.min || 1);
      return PADDING.top + plotH - t * plotH;
    },
    [yDomain, plotH],
  );

  const invertX = useCallback(
    (px: number) => {
      const t = (px - PADDING.left) / plotW;
      return domain.min + t * (domain.max - domain.min);
    },
    [domain, plotW],
  );

  // ---- Build SVG points ----
  const points = useMemo(
    () =>
      visibleData.map((d) => ({
        x: scaleX(d.timestamp),
        y: scaleY(d[dataKey] as number),
        entry: d,
      })),
    [visibleData, scaleX, scaleY, dataKey],
  );

  const linePath = useMemo(() => buildPath(points), [points]);
  const areaPath = useMemo(
    () => buildAreaPath(points, PADDING.top + plotH),
    [points, plotH],
  );

  // ---- Find nearest point to a hover index ----
  const hoveredIdx = hoveredPoint?.dataIndex ?? null;
  const nearestPoint = useMemo(() => {
    if (hoveredIdx === null || points.length === 0) return null;
    // Clamp index to visible range
    const idx = Math.max(0, Math.min(hoveredIdx, points.length - 1));
    return points[idx] ?? null;
  }, [hoveredIdx, points]);

  // ---- Mouse event handlers (brush + hover) ----
  const svgRef = useRef<SVGSVGElement>(null);
  const isBrushingRef = useRef(false);

  const getSvgX = useCallback(
    (e: React.MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return 0;
      const rect = svg.getBoundingClientRect();
      return e.clientX - rect.left;
    },
    [],
  );

  const findNearestIndex = useCallback(
    (px: number) => {
      if (points.length === 0) return 0;
      let minDist = Infinity;
      let minIdx = 0;
      for (let i = 0; i < points.length; i++) {
        const dist = Math.abs(points[i].x - px);
        if (dist < minDist) {
          minDist = dist;
          minIdx = i;
        }
      }
      return minIdx;
    },
    [points],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only brush on primary button and within plot area
      if (e.button !== 0) return;
      const px = getSvgX(e);
      if (px < PADDING.left || px > PADDING.left + plotW) return;

      isBrushingRef.current = true;
      const domainX = invertX(px);
      brushStart(domainX);

      // Capture pointer for reliable drag
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [getSvgX, invertX, brushStart, plotW],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const px = getSvgX(e);

      if (isBrushingRef.current) {
        const domainX = invertX(Math.max(PADDING.left, Math.min(px, PADDING.left + plotW)));
        brushMove(domainX);
      } else {
        // Hover — find nearest data point
        if (px >= PADDING.left && px <= PADDING.left + plotW && points.length > 0) {
          const idx = findNearestIndex(px);
          onHover(idx, points[idx].x, points[idx].y);
        }
      }
    },
    [getSvgX, invertX, brushMove, plotW, points, findNearestIndex, onHover],
  );

  const handlePointerUp = useCallback(() => {
    if (isBrushingRef.current) {
      isBrushingRef.current = false;
      brushEnd();
    }
  }, [brushEnd]);

  const handlePointerLeave = useCallback(() => {
    if (!isBrushingRef.current) {
      onLeave();
    }
  }, [onLeave]);

  // ---- Grid + axis tick values ----
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= GRID_LINES; i++) {
      ticks.push(yDomain.min + (i / GRID_LINES) * (yDomain.max - yDomain.min));
    }
    return ticks;
  }, [yDomain]);

  const xTicks = useMemo(() => {
    const count = Math.min(6, visibleData.length);
    if (count < 2) return visibleData.map((d) => d.timestamp);
    const step = Math.floor((visibleData.length - 1) / (count - 1));
    const ticks: number[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.min(i * step, visibleData.length - 1);
      ticks.push(visibleData[idx].timestamp);
    }
    return ticks;
  }, [visibleData]);

  // ---- Brush overlay rect ----
  const brushRect = useMemo(() => {
    if (!brushState.active) return null;
    const x1 = scaleX(Math.min(brushState.startX, brushState.endX));
    const x2 = scaleX(Math.max(brushState.startX, brushState.endX));
    return {
      x: Math.max(PADDING.left, x1),
      width: Math.min(x2 - x1, plotW),
    };
  }, [brushState, scaleX, plotW]);

  // ---- Style tokens ----
  const gridColor = isDark ? 'rgba(62,61,57,0.3)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.4)';
  const labelColor = isDark ? 'rgba(232,228,222,0.8)' : 'rgba(0,0,0,0.75)';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        background: isDark ? 'rgba(196,149,106,0.02)' : 'rgba(0,0,0,0.015)',
        border: `1px solid ${isDark ? 'rgba(62,61,57,0.3)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      {/* ── Header row: label + zoom controls ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.75rem 0',
        }}
      >
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: labelColor,
          }}
        >
          {label}
        </span>

        {canUndo && (
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            <button
              onClick={undo}
              style={{
                fontSize: '0.625rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                border: 'none',
                background: isDark ? 'rgba(196,149,106,0.06)' : 'rgba(0,0,0,0.03)',
                color: textColor,
                cursor: 'pointer',
                backdropFilter: 'blur(12px)',
              }}
            >
              Undo zoom
            </button>
            <button
              onClick={resetZoom}
              style={{
                fontSize: '0.625rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                border: 'none',
                background: isDark ? 'rgba(196,149,106,0.06)' : 'rgba(0,0,0,0.03)',
                color: textColor,
                cursor: 'pointer',
                backdropFilter: 'blur(12px)',
              }}
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* ── SVG chart ── */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{
          display: 'block',
          cursor: brushState.active ? 'col-resize' : 'crosshair',
          touchAction: 'none',
          userSelect: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        {/* ── Grid lines ── */}
        {yTicks.map((tick, i) => {
          const y = scaleY(tick);
          return (
            <g key={`y-${i}`}>
              <line
                x1={PADDING.left}
                x2={PADDING.left + plotW}
                y1={y}
                y2={y}
                stroke={gridColor}
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 6}
                y={y + 3}
                textAnchor="end"
                fill={textColor}
                fontSize={9}
                fontFamily="inherit"
              >
                {tick.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* ── X-axis labels ── */}
        {xTicks.map((ts, i) => (
          <text
            key={`x-${i}`}
            x={scaleX(ts)}
            y={PADDING.top + plotH + 16}
            textAnchor="middle"
            fill={textColor}
            fontSize={9}
            fontFamily="inherit"
          >
            {formatTimestamp(ts)}
          </text>
        ))}

        {/* ── Gradient fill under the line ── */}
        <defs>
          <linearGradient
            id={`area-grad-${chartId}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={color} stopOpacity={isDark ? 0.2 : 0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* ── Area ── */}
        {areaPath && (
          <path
            d={areaPath}
            fill={`url(#area-grad-${chartId})`}
            style={{
              transition: `d 0.3s cubic-bezier(${CUPERTINO_EASE.join(',')})`,
            }}
          />
        )}

        {/* ── Line ── */}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transition: `d 0.3s cubic-bezier(${CUPERTINO_EASE.join(',')})`,
              filter: isDark ? `drop-shadow(0 0 4px ${color}40)` : 'none',
            }}
          />
        )}

        {/* ── Data points ── */}
        {points.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={POINT_RADIUS}
            fill={color}
            opacity={0.7}
            style={{
              transition: `cx 0.3s cubic-bezier(${CUPERTINO_EASE.join(',')}), cy 0.3s cubic-bezier(${CUPERTINO_EASE.join(',')})`,
            }}
          />
        ))}

        {/* ── Brush selection overlay ── */}
        {brushRect && (
          <rect
            x={brushRect.x}
            y={PADDING.top}
            width={brushRect.width}
            height={plotH}
            fill={color}
            opacity={0.12}
            rx={2}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* ── Hover crosshair + highlighted point ── */}
        {nearestPoint && !brushState.active && (
          <g style={{ pointerEvents: 'none' }}>
            {/* Vertical crosshair */}
            <line
              x1={nearestPoint.x}
              x2={nearestPoint.x}
              y1={PADDING.top}
              y2={PADDING.top + plotH}
              stroke={isDark ? 'rgba(155,150,137,0.2)' : 'rgba(0,0,0,0.12)'}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {/* Horizontal crosshair */}
            <line
              x1={PADDING.left}
              x2={PADDING.left + plotW}
              y1={nearestPoint.y}
              y2={nearestPoint.y}
              stroke={isDark ? 'rgba(155,150,137,0.15)' : 'rgba(0,0,0,0.08)'}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {/* Outer glow ring */}
            <circle
              cx={nearestPoint.x}
              cy={nearestPoint.y}
              r={HOVER_RADIUS + 3}
              fill="none"
              stroke={color}
              strokeWidth={1}
              opacity={0.3}
            />
            {/* Highlighted point */}
            <circle
              cx={nearestPoint.x}
              cy={nearestPoint.y}
              r={HOVER_RADIUS}
              fill={color}
              stroke={isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.9)'}
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {/* ── Glass-morphism tooltip ── */}
      <AnimatePresence>
        {nearestPoint && !brushState.active && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{
              duration: 0.18,
              ease: CUPERTINO_EASE as [number, number, number, number],
            }}
            style={{
              position: 'absolute',
              // Position tooltip above the hovered point, clamped to container
              left: Math.min(
                Math.max(nearestPoint.x - 60, 8),
                width - 140,
              ),
              top: Math.max(nearestPoint.y - 64, 8),
              pointerEvents: 'none',
              padding: '0.375rem 0.625rem',
              borderRadius: '0.625rem',
              background: isDark
                ? 'rgba(43, 42, 39, 0.92)'
                : 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(12px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
              border: `1px solid ${isDark ? 'rgba(62,61,57,0.3)' : 'rgba(0,0,0,0.06)'}`,
              zIndex: 10,
              minWidth: '7rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                marginBottom: '0.125rem',
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: labelColor,
                  letterSpacing: '-0.01em',
                }}
              >
                {label}
              </span>
            </div>
            <div
              style={{
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: color,
                letterSpacing: '-0.02em',
              }}
            >
              {formatValue(nearestPoint.entry[dataKey] as number)}
            </div>
            <div
              style={{
                fontSize: '0.5625rem',
                color: textColor,
                marginTop: '0.125rem',
              }}
            >
              {formatTimestamp(nearestPoint.entry.timestamp)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
