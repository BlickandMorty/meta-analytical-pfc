'use client';

import { memo, useRef, useEffect, useCallback, useState } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import { select, pointer } from 'd3-selection';
import {
  zoom,
  zoomIdentity,
  type ZoomTransform,
  type D3ZoomEvent,
} from 'd3-zoom';
import { drag, type D3DragEvent } from 'd3-drag';
import { useTheme } from 'next-themes';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import type { NotePage, PageLink } from '@/lib/notes/types';

// ═══════════════════════════════════════════════════════════════════
// Graph View — SiYuan-inspired force-directed knowledge graph
// Canvas-based rendering for performance with d3 force simulation
// ═══════════════════════════════════════════════════════════════════

// ── Node / Link types for d3 simulation ──

interface GraphSimNode extends SimulationNodeDatum {
  id: string;
  label: string;
  isJournal: boolean;
  isActive: boolean;
  radius: number;
}

interface GraphSimLink extends SimulationLinkDatum<GraphSimNode> {
  source: GraphSimNode | string;
  target: GraphSimNode | string;
}

// ── Color constants ──

const COLOR_ACTIVE = 'var(--pfc-accent)';
const COLOR_JOURNAL = '#34D399';
const COLOR_REGULAR = 'rgba(var(--pfc-accent-rgb), 0.6)';
const NODE_RADIUS = 8;
const ACTIVE_RADIUS = 12;
const LABEL_FONT = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// ── Component ──

export const GraphView = memo(function GraphView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const simulationRef = useRef<Simulation<GraphSimNode, GraphSimLink> | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number>(0);

  const [hoveredNode, setHoveredNode] = useState<GraphSimNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const notePages = usePFCStore((s) => s.notePages);
  const pageLinks = usePFCStore((s) => s.pageLinks);
  const activePageId = usePFCStore((s) => s.activePageId);
  const setActivePage = usePFCStore((s) => s.setActivePage);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark' || resolvedTheme === 'oled' || resolvedTheme === 'navy' || resolvedTheme === 'cosmic';

  // ── Build graph data ──

  const buildGraph = useCallback((): {
    nodes: GraphSimNode[];
    links: GraphSimLink[];
  } => {
    const nodes: GraphSimNode[] = notePages.map((page: NotePage) => ({
      id: page.id,
      label: page.title,
      isJournal: page.isJournal,
      isActive: page.id === activePageId,
      radius: page.id === activePageId ? ACTIVE_RADIUS : NODE_RADIUS,
    }));

    const pageIdSet = new Set(notePages.map((p: NotePage) => p.id));

    const links: GraphSimLink[] = pageLinks
      .filter(
        (link: PageLink) =>
          pageIdSet.has(link.sourcePageId) && pageIdSet.has(link.targetPageId),
      )
      .map((link: PageLink) => ({
        source: link.sourcePageId,
        target: link.targetPageId,
      }));

    return { nodes, links };
  }, [notePages, pageLinks, activePageId]);

  // ── Hit-test: find node under cursor ──

  const hitTest = useCallback(
    (
      canvasX: number,
      canvasY: number,
      nodes: GraphSimNode[],
    ): GraphSimNode | null => {
      const t = transformRef.current;
      // Convert canvas pixel coords to simulation coords
      const simX = (canvasX - t.x) / t.k;
      const simY = (canvasY - t.y) / t.k;

      // Check nodes in reverse order (top-most first)
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i]!;
        const dx = simX - (node.x ?? 0);
        const dy = simY - (node.y ?? 0);
        const hitRadius = node.radius + 4; // slight padding for easier clicking
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
          return node;
        }
      }
      return null;
    },
    [],
  );

  // ── Canvas draw ──

  const draw = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      nodes: GraphSimNode[],
      links: GraphSimLink[],
      width: number,
      height: number,
    ) => {
      const t = transformRef.current;

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      // ── Draw edges ──
      const edgeColor = isDark
        ? 'rgba(var(--pfc-accent-rgb), 0.15)'
        : 'rgba(120,100,80,0.15)';

      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const link of links) {
        const src = link.source as GraphSimNode;
        const tgt = link.target as GraphSimNode;
        if (src.x != null && src.y != null && tgt.x != null && tgt.y != null) {
          ctx.moveTo(src.x, src.y);
          ctx.lineTo(tgt.x, tgt.y);
        }
      }
      ctx.stroke();

      // ── Draw nodes ──
      for (const node of nodes) {
        if (node.x == null || node.y == null) continue;

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

        if (node.isActive) {
          ctx.fillStyle = COLOR_ACTIVE;
          ctx.shadowColor = COLOR_ACTIVE;
          ctx.shadowBlur = 12;
        } else if (node.isJournal) {
          ctx.fillStyle = COLOR_JOURNAL;
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = COLOR_REGULAR;
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }
        ctx.fill();

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      // ── Draw labels (only when zoomed in enough) ──
      if (t.k > 0.5) {
        ctx.font = LABEL_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const labelColor = isDark
          ? 'rgba(218,212,200,0.8)'
          : 'rgba(50,45,40,0.8)';
        ctx.fillStyle = labelColor;

        for (const node of nodes) {
          if (node.x == null || node.y == null) continue;
          const label =
            node.label.length > 24
              ? node.label.slice(0, 22) + '\u2026'
              : node.label;
          ctx.fillText(label, node.x, node.y + node.radius + 4);
        }
      }

      ctx.restore();
    },
    [isDark],
  );

  // ── Main effect: setup simulation, canvas interactions, zoom, drag ──

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { nodes, links } = buildGraph();

    // Nothing to render
    if (nodes.length === 0) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, rect.width, rect.height);
      }
      return;
    }

    // ── Canvas sizing ──
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // ── Force simulation ──
    const simulation = forceSimulation<GraphSimNode>(nodes)
      .force(
        'link',
        forceLink<GraphSimNode, GraphSimLink>(links)
          .id((d) => d.id)
          .distance(80),
      )
      .force('charge', forceManyBody().strength(-200))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collision', forceCollide<GraphSimNode>().radius((d) => d.radius + 4))
      .alphaDecay(0.02);

    simulationRef.current = simulation;

    // ── Tick handler ──
    const tick = () => {
      draw(ctx, nodes, links, width, height);
    };

    simulation.on('tick', () => {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(tick);
    });

    // ── d3 zoom ──
    const canvasSelection = select<HTMLCanvasElement, unknown>(canvas);

    const zoomBehavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 6])
      .on('zoom', (event: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        transformRef.current = event.transform;
        tick();
      });

    canvasSelection.call(zoomBehavior);

    // ── d3 drag ──
    let draggedNode: GraphSimNode | null = null;

    const dragBehavior = drag<HTMLCanvasElement, unknown, GraphSimNode | undefined>()
      .subject((event: D3DragEvent<HTMLCanvasElement, unknown, GraphSimNode | undefined>) => {
        const [cx, cy] = pointer(event, canvas);
        const found = hitTest(cx, cy, nodes);
        if (!found) return undefined;
        found.x = found.x ?? 0;
        found.y = found.y ?? 0;
        return found;
      })
      .on('start', (event: D3DragEvent<HTMLCanvasElement, unknown, GraphSimNode | undefined>) => {
        const subject = event.subject;
        if (!subject) return;
        if (!event.active) simulation.alphaTarget(0.3).restart();
        draggedNode = subject;
        draggedNode.fx = draggedNode.x;
        draggedNode.fy = draggedNode.y;
      })
      .on('drag', (event: D3DragEvent<HTMLCanvasElement, unknown, GraphSimNode | undefined>) => {
        if (!draggedNode) return;
        const t = transformRef.current;
        draggedNode.fx = (event.sourceEvent.offsetX - t.x) / t.k;
        draggedNode.fy = (event.sourceEvent.offsetY - t.y) / t.k;
      })
      .on('end', (event: D3DragEvent<HTMLCanvasElement, unknown, GraphSimNode | undefined>) => {
        if (!event.active) simulation.alphaTarget(0);
        if (draggedNode) {
          draggedNode.fx = null;
          draggedNode.fy = null;
          draggedNode = null;
        }
      });

    canvasSelection.call(dragBehavior);

    // ── Click handler ──
    const handleClick = (event: MouseEvent) => {
      // Ignore if this was a drag
      if (event.defaultPrevented) return;
      const [cx, cy] = [event.offsetX, event.offsetY];
      const found = hitTest(cx, cy, nodes);
      if (found) {
        setActivePage(found.id);
      }
    };

    canvas.addEventListener('click', handleClick);

    // ── Hover / tooltip ──
    const handleMouseMove = (event: MouseEvent) => {
      const [cx, cy] = [event.offsetX, event.offsetY];
      const found = hitTest(cx, cy, nodes);
      if (found) {
        canvas.style.cursor = 'pointer';
        setHoveredNode(found);
        setTooltipPos({ x: event.offsetX, y: event.offsetY });
      } else {
        canvas.style.cursor = 'default';
        setHoveredNode(null);
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    const handleMouseLeave = () => {
      setHoveredNode(null);
      canvas.style.cursor = 'default';
    };

    canvas.addEventListener('mouseleave', handleMouseLeave);

    // ── Resize observer ──
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        const newDpr = window.devicePixelRatio || 1;
        canvas.width = w * newDpr;
        canvas.height = h * newDpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        const newCtx = canvas.getContext('2d');
        if (newCtx) {
          newCtx.scale(newDpr, newDpr);
          draw(newCtx, nodes, links, w, h);
        }
        simulation.force('center', forceCenter(w / 2, h / 2));
        simulation.alpha(0.1).restart();
      }
    });

    resizeObserver.observe(container);

    // ── Cleanup ──
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      simulation.stop();
      simulationRef.current = null;
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      resizeObserver.disconnect();
      canvasSelection.on('.zoom', null);
      canvasSelection.on('.drag', null);
    };
  }, [buildGraph, draw, hitTest, setActivePage]);

  // ── Render ──

  const bgColor = isDark ? 'rgba(20,19,17,0.96)' : 'rgba(218,212,200,0.96)';
  const borderColor = isDark ? 'rgba(79,69,57,0.25)' : 'rgba(208,196,180,0.25)';
  const hasContent = notePages.length > 0;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 300,
        background: bgColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        backdropFilter: 'blur(12px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
        overflow: 'hidden',
      }}
    >
      {hasContent ? (
        <>
          <canvas
            ref={canvasRef}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
            }}
          />

          {/* Tooltip */}
          {hoveredNode && (
            <div
              ref={tooltipRef}
              style={{
                position: 'absolute',
                left: tooltipPos.x + 12,
                top: tooltipPos.y - 30,
                padding: '4px 10px',
                borderRadius: 6,
                background: isDark
                  ? 'rgba(40,37,33,0.95)'
                  : 'rgba(255,252,248,0.95)',
                border: `1px solid ${borderColor}`,
                color: isDark
                  ? 'rgba(218,212,200,0.9)'
                  : 'rgba(50,45,40,0.9)',
                fontSize: 12,
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                zIndex: 'var(--z-dropdown)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                boxShadow: isDark
                  ? '0 2px 8px rgba(0,0,0,0.4)'
                  : '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              {hoveredNode.label}
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            minHeight: 300,
            color: isDark
              ? 'rgba(218,212,200,0.4)'
              : 'rgba(50,45,40,0.4)',
            fontSize: 14,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            userSelect: 'none',
          }}
        >
          No connections yet
        </div>
      )}
    </div>
  );
});
