'use client';

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { usePFCStore } from '@/lib/store/use-pfc-store';
import {
  GripHorizontalIcon,
  XIcon,
  TypeIcon,
  PlusIcon,
  ZoomInIcon,
  ZoomOutIcon,
  MaximizeIcon,
  FileTextIcon,
  StickyNoteIcon,
  LinkIcon,
  Undo2Icon,
  Redo2Icon,
  MapIcon,
} from 'lucide-react';
import type { NotePage } from '@/lib/notes/types';

// ═══════════════════════════════════════════════════════════════════
// Obsidian × Freeform Canvas Engine
//
// Architecture: tldraw-inspired flat store, CSS transform camera,
// viewport culling (AABB), diff-based undo/redo with marks,
// inertial panning (Freeform physics), marquee selection,
// snap alignment guides, LOD at low zoom, minimap.
// ═══════════════════════════════════════════════════════════════════

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const GRID_SIZE = 24;
const SNAP_THRESHOLD = 8;
const VIEWPORT_PADDING = 200; // px beyond viewport to keep rendered
const INERTIA_FRICTION = 0.92;
const INERTIA_MIN_V = 0.5;

// ── Color presets (Obsidian-inspired) ──
const CARD_COLORS = [
  { id: 'default', label: 'Default', bg: '', border: '' },
  { id: 'red', label: 'Red', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.3)' },
  { id: 'orange', label: 'Orange', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)' },
  { id: 'yellow', label: 'Yellow', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.3)' },
  { id: 'green', label: 'Green', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.3)' },
  { id: 'cyan', label: 'Cyan', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.3)' },
  { id: 'purple', label: 'Purple', bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.3)' },
] as const;

type CardColorId = (typeof CARD_COLORS)[number]['id'];

// ── Types ──

export interface CanvasCard {
  id: string;
  type: 'text' | 'note' | 'group' | 'paper';
  x: number;
  y: number;
  width: number;
  height: number;
  color: CardColorId;
  header: string;
  body: string;
  linkedPageId?: string;
  label?: string;
  createdAt: number;
  updatedAt: number;
  /** Paper cards: random rotation seed for loose-paper aesthetic */
  paperRotation?: number;
}

export interface CanvasEdge {
  id: string;
  fromCardId: string;
  toCardId: string;
  fromSide: 'top' | 'right' | 'bottom' | 'left';
  toSide: 'top' | 'right' | 'bottom' | 'left';
  label?: string;
  color: CardColorId;
}

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

interface CanvasData {
  cards: CanvasCard[];
  edges: CanvasEdge[];
}

// ── Undo/Redo — diff-based with marks (tldraw pattern) ──

interface CanvasSnapshot {
  cards: CanvasCard[];
  edges: CanvasEdge[];
}

interface UndoStack {
  past: CanvasSnapshot[];
  future: CanvasSnapshot[];
}

// ── Snap Guide ──

interface SnapGuide {
  type: 'x' | 'y';
  pos: number; // world coordinate of the guide line
}

// ── Helpers ──

function uid(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function snap(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function loadCanvas(vaultId: string, pageId: string): CanvasData {
  try {
    const raw = localStorage.getItem(`pfc-canvas-${vaultId}-${pageId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { cards: parsed.cards || parsed || [], edges: parsed.edges || [] };
    }
  } catch { /* ignore */ }
  return { cards: [], edges: [] };
}

function saveCanvas(vaultId: string, pageId: string, data: CanvasData) {
  try {
    localStorage.setItem(`pfc-canvas-${vaultId}-${pageId}`, JSON.stringify(data));
  } catch { /* ignore */ }
}

function getAnchor(card: CanvasCard, side: 'top' | 'right' | 'bottom' | 'left') {
  switch (side) {
    case 'top': return { x: card.x + card.width / 2, y: card.y };
    case 'bottom': return { x: card.x + card.width / 2, y: card.y + card.height };
    case 'left': return { x: card.x, y: card.y + card.height / 2 };
    case 'right': return { x: card.x + card.width, y: card.y + card.height / 2 };
  }
}

function buildEdgePath(from: { x: number; y: number }, to: { x: number; y: number }, fromSide: string, toSide: string): string {
  const offset = Math.max(Math.abs(to.x - from.x) * 0.5, Math.abs(to.y - from.y) * 0.5, 50);
  let cp1x = from.x, cp1y = from.y, cp2x = to.x, cp2y = to.y;
  if (fromSide === 'right') cp1x += offset;
  else if (fromSide === 'left') cp1x -= offset;
  else if (fromSide === 'bottom') cp1y += offset;
  else cp1y -= offset;
  if (toSide === 'right') cp2x += offset;
  else if (toSide === 'left') cp2x -= offset;
  else if (toSide === 'bottom') cp2y += offset;
  else cp2y -= offset;
  return `M ${from.x} ${from.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${to.x} ${to.y}`;
}

function closestSide(card: CanvasCard, px: number, py: number): 'top' | 'right' | 'bottom' | 'left' {
  const cx = card.x + card.width / 2;
  const cy = card.y + card.height / 2;
  const dx = px - cx;
  const dy = py - cy;
  const ratio = card.width / card.height;
  if (Math.abs(dx) * (1 / ratio) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
}

// ── AABB viewport culling ──

function isCardVisible(card: CanvasCard, camera: Camera, viewW: number, viewH: number): boolean {
  const pad = VIEWPORT_PADDING / camera.zoom;
  const vx = -camera.x / camera.zoom - pad;
  const vy = -camera.y / camera.zoom - pad;
  const vw = viewW / camera.zoom + 2 * pad;
  const vh = viewH / camera.zoom + 2 * pad;
  return card.x + card.width >= vx && card.x <= vx + vw && card.y + card.height >= vy && card.y <= vy + vh;
}

// ── Snap alignment guides ──

function computeSnapGuides(
  movingIds: Set<string>,
  movingBounds: { x: number; y: number; w: number; h: number },
  allCards: CanvasCard[],
): { guides: SnapGuide[]; snapDx: number; snapDy: number } {
  const guides: SnapGuide[] = [];
  let snapDx = 0;
  let snapDy = 0;
  const mx = movingBounds.x, my = movingBounds.y;
  const mw = movingBounds.w, mh = movingBounds.h;
  const mCx = mx + mw / 2, mCy = my + mh / 2;
  const mR = mx + mw, mB = my + mh;

  let bestDx = Infinity, bestDy = Infinity;

  for (const c of allCards) {
    if (movingIds.has(c.id)) continue;
    const cCx = c.x + c.width / 2, cCy = c.y + c.height / 2;
    const cR = c.x + c.width, cB = c.y + c.height;

    // X alignment checks: left-left, right-right, center-center, left-right, right-left
    const xPairs: Array<[number, number]> = [
      [mx, c.x], [mR, cR], [mCx, cCx], [mx, cR], [mR, c.x],
    ];
    for (const [a, b] of xPairs) {
      const d = b - a;
      if (Math.abs(d) < SNAP_THRESHOLD && Math.abs(d) < Math.abs(bestDx)) {
        bestDx = d;
      }
    }

    // Y alignment checks: top-top, bottom-bottom, center-center, top-bottom, bottom-top
    const yPairs: Array<[number, number]> = [
      [my, c.y], [mB, cB], [mCy, cCy], [my, cB], [mB, c.y],
    ];
    for (const [a, b] of yPairs) {
      const d = b - a;
      if (Math.abs(d) < SNAP_THRESHOLD && Math.abs(d) < Math.abs(bestDy)) {
        bestDy = d;
      }
    }
  }

  if (Math.abs(bestDx) < SNAP_THRESHOLD) {
    snapDx = bestDx;
    // Find which guide lines to draw
    for (const c of allCards) {
      if (movingIds.has(c.id)) continue;
      const cR = c.x + c.width, cCx = c.x + c.width / 2;
      const adjusted = mx + snapDx;
      const adjustedR = mR + snapDx;
      const adjustedC = mCx + snapDx;
      if (Math.abs(adjusted - c.x) < 1) guides.push({ type: 'x', pos: c.x });
      if (Math.abs(adjustedR - cR) < 1) guides.push({ type: 'x', pos: cR });
      if (Math.abs(adjustedC - cCx) < 1) guides.push({ type: 'x', pos: cCx });
      if (Math.abs(adjusted - cR) < 1) guides.push({ type: 'x', pos: cR });
      if (Math.abs(adjustedR - c.x) < 1) guides.push({ type: 'x', pos: c.x });
    }
  }

  if (Math.abs(bestDy) < SNAP_THRESHOLD) {
    snapDy = bestDy;
    for (const c of allCards) {
      if (movingIds.has(c.id)) continue;
      const cB = c.y + c.height, cCy = c.y + c.height / 2;
      const adjusted = my + snapDy;
      const adjustedB = mB + snapDy;
      const adjustedC = mCy + snapDy;
      if (Math.abs(adjusted - c.y) < 1) guides.push({ type: 'y', pos: c.y });
      if (Math.abs(adjustedB - cB) < 1) guides.push({ type: 'y', pos: cB });
      if (Math.abs(adjustedC - cCy) < 1) guides.push({ type: 'y', pos: cCy });
      if (Math.abs(adjusted - cB) < 1) guides.push({ type: 'y', pos: cB });
      if (Math.abs(adjustedB - c.y) < 1) guides.push({ type: 'y', pos: c.y });
    }
  }

  return { guides, snapDx: Math.abs(bestDx) < SNAP_THRESHOLD ? snapDx : 0, snapDy: Math.abs(bestDy) < SNAP_THRESHOLD ? snapDy : 0 };
}

// ═══════════════════════════════════════════════════════════════════
// CanvasCardView
// ═══════════════════════════════════════════════════════════════════

interface CardViewProps {
  card: CanvasCard;
  isDark: boolean;
  isSelected: boolean;
  zoom: number;
  lod: 'full' | 'reduced' | 'dot'; // LOD level
  onSelect: (id: string, multi: boolean) => void;
  onUpdate: (id: string, updates: Partial<CanvasCard>) => void;
  onDelete: (id: string) => void;
  onStartEdge: (cardId: string, side: 'top' | 'right' | 'bottom' | 'left') => void;
  onDragStart: (cardId: string, e: React.MouseEvent) => void;
  linkedPage?: NotePage | null;
  onNavigateToPage?: (pageId: string) => void;
}

const CanvasCardView = memo(function CanvasCardView({
  card, isDark, isSelected, zoom, lod, onSelect, onUpdate, onDelete, onStartEdge, onDragStart, linkedPage, onNavigateToPage,
}: CardViewProps) {
  const [hovered, setHovered] = useState(false);
  const [resizing, setResizing] = useState<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0, w: 0, h: 0 });
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const cp = CARD_COLORS.find((c) => c.id === card.color) || CARD_COLORS[0];
  const isGroup = card.type === 'group';
  const isNote = card.type === 'note';
  const cardBg = cp.bg || (isDark ? 'rgba(28,26,23,0.92)' : 'rgba(255,255,255,0.92)');
  const cardBorder = cp.border || (isDark ? 'rgba(79,69,57,0.35)' : 'rgba(208,196,180,0.4)');
  const textColor = isDark ? 'rgba(237,224,212,0.95)' : 'rgba(0,0,0,0.85)';
  const mutedColor = isDark ? 'rgba(156,143,128,0.4)' : 'rgba(0,0,0,0.25)';

  // ── LOD: dot mode — just show a colored rectangle ──
  if (lod === 'dot') {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onSelect(card.id, e.shiftKey); }}
        style={{
          position: 'absolute',
          left: card.x, top: card.y, width: card.width, height: card.height,
          background: isGroup ? (cp.bg || (isDark ? 'rgba(28,26,23,0.3)' : 'rgba(255,255,255,0.3)')) : cardBg,
          border: `${isSelected ? 2 : 1}px ${isGroup ? 'dashed' : 'solid'} ${isSelected ? '#C4956A' : cardBorder}`,
          borderRadius: isGroup ? 12 : 10,
          zIndex: isSelected ? 10 : isGroup ? 0 : 1,
        }}
      />
    );
  }

  // ── LOD: reduced — show header only, no body editing ──
  if (lod === 'reduced') {
    return (
      <div
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDragStart(card.id, e); }}
        onClick={(e) => { e.stopPropagation(); onSelect(card.id, e.shiftKey); }}
        style={{
          position: 'absolute',
          left: card.x, top: card.y, width: card.width, height: card.height,
          display: 'flex', flexDirection: 'column',
          background: isGroup ? (cp.bg || (isDark ? 'rgba(28,26,23,0.4)' : 'rgba(255,255,255,0.4)')) : cardBg,
          border: `${isSelected ? 2 : 1.5}px ${isGroup ? 'dashed' : 'solid'} ${isSelected ? '#C4956A' : cardBorder}`,
          borderRadius: isGroup ? 12 : 10,
          cursor: 'grab',
          zIndex: isSelected ? 10 : isGroup ? 0 : 1,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '6px 10px', fontSize: '0.75rem', fontWeight: 600, color: textColor, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {card.header || (isGroup ? (card.label || 'Group') : 'Untitled')}
        </div>
      </div>
    );
  }

  // ── Resize ──
  const onResizeStart = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(handle);
    dragStart.current = { x: e.clientX, y: e.clientY, cx: card.x, cy: card.y, w: card.width, h: card.height };
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - dragStart.current.x) / zoom;
      const dy = (ev.clientY - dragStart.current.y) / zoom;
      const u: Partial<CanvasCard> = {};
      if (handle.includes('e')) u.width = snap(Math.max(120, dragStart.current.w + dx));
      if (handle.includes('w')) { const nw = snap(Math.max(120, dragStart.current.w - dx)); u.width = nw; u.x = snap(dragStart.current.cx + dragStart.current.w - nw); }
      if (handle.includes('s')) u.height = snap(Math.max(60, dragStart.current.h + dy));
      if (handle.includes('n')) { const nh = snap(Math.max(60, dragStart.current.h - dy)); u.height = nh; u.y = snap(dragStart.current.cy + dragStart.current.h - nh); }
      onUpdate(card.id, u);
    };
    const onUp = () => { setResizing(null); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const showAnchors = hovered && !resizing;
  const anchors: Array<{ side: 'top' | 'right' | 'bottom' | 'left'; css: React.CSSProperties }> = [
    { side: 'top', css: { top: -4, left: '50%', transform: 'translateX(-50%)' } },
    { side: 'right', css: { top: '50%', right: -4, transform: 'translateY(-50%)' } },
    { side: 'bottom', css: { bottom: -4, left: '50%', transform: 'translateX(-50%)' } },
    { side: 'left', css: { top: '50%', left: -4, transform: 'translateY(-50%)' } },
  ];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); onSelect(card.id, e.shiftKey); }}
      style={{
        position: 'absolute',
        left: card.x, top: card.y, width: card.width, height: card.height,
        display: 'flex', flexDirection: 'column',
        background: isGroup ? (cp.bg || (isDark ? 'rgba(28,26,23,0.4)' : 'rgba(255,255,255,0.4)')) : cardBg,
        border: `${isSelected ? 2 : 1.5}px ${isGroup ? 'dashed' : 'solid'} ${isSelected ? '#C4956A' : cardBorder}`,
        borderRadius: isGroup ? 12 : 10,
        boxShadow: isSelected
          ? `0 0 0 2px ${isDark ? 'rgba(196,149,106,0.15)' : 'rgba(196,149,106,0.12)'}, 0 8px 32px rgba(0,0,0,0.12)`
          : hovered ? '0 4px 20px rgba(0,0,0,0.1)' : '0 2px 12px rgba(0,0,0,0.06)',
        transition: 'border-color 0.15s, box-shadow 0.2s',
        zIndex: isSelected ? 10 : hovered ? 5 : isGroup ? 0 : 1,
        contain: 'layout', overflow: 'hidden',
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDragStart(card.id, e); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isGroup ? '6px 10px' : '4px 8px 0',
          cursor: 'grab', height: isGroup ? 28 : 20, flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <GripHorizontalIcon style={{ width: 12, height: 12, color: mutedColor, opacity: hovered || isSelected ? 1 : 0.3, transition: 'opacity 0.15s' }} />
          {isNote && linkedPage && (
            <span
              onClick={(e) => { e.stopPropagation(); if (onNavigateToPage && linkedPage) onNavigateToPage(linkedPage.id); }}
              style={{ fontSize: '0.625rem', fontWeight: 600, color: '#C4956A', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
            >
              <LinkIcon style={{ width: 9, height: 9 }} />
              {linkedPage.title}
            </span>
          )}
          {isGroup && <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: mutedColor, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{card.label || 'Group'}</span>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 16, height: 16, borderRadius: 4,
            background: 'transparent', border: 'none', color: mutedColor,
            cursor: 'pointer', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
          }}
        >
          <XIcon style={{ width: 10, height: 10 }} />
        </button>
      </div>

      {/* Text card content */}
      {card.type === 'text' && (
        <>
          <div
            ref={headerRef}
            contentEditable suppressContentEditableWarning
            data-placeholder="Heading"
            onInput={(e) => onUpdate(card.id, { header: e.currentTarget.textContent || '', updatedAt: Date.now() })}
            onFocus={() => onSelect(card.id, false)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); bodyRef.current?.focus(); } }}
            style={{
              padding: '6px 14px 2px', fontSize: '1.0625rem', fontWeight: 700,
              letterSpacing: '-0.02em', lineHeight: 1.35, color: textColor,
              outline: 'none', fontFamily: 'var(--font-display, var(--font-sans))',
              minHeight: '1.5rem', wordBreak: 'break-word',
            }}
            dangerouslySetInnerHTML={{ __html: card.header || '' }}
          />
          <div style={{ height: 1, margin: '2px 14px 4px', background: isSelected ? '#C4956A30' : cardBorder, transition: 'background 0.15s' }} />
          <div
            ref={bodyRef}
            contentEditable suppressContentEditableWarning
            data-placeholder="Type here..."
            onInput={(e) => onUpdate(card.id, { body: e.currentTarget.innerHTML || '', updatedAt: Date.now() })}
            onFocus={() => onSelect(card.id, false)}
            style={{
              padding: '2px 14px 12px', fontSize: '0.875rem', fontWeight: 400,
              lineHeight: 1.65, color: textColor, outline: 'none',
              fontFamily: 'var(--font-sans)', minHeight: '2rem',
              wordBreak: 'break-word', flex: 1,
            }}
            dangerouslySetInnerHTML={{ __html: card.body || '' }}
          />
        </>
      )}

      {isNote && !linkedPage && (
        <div style={{ padding: '8px 14px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: mutedColor }}>Linked page not found</span>
        </div>
      )}

      <style>{`[data-placeholder]:empty::before { content: attr(data-placeholder); color: ${isDark ? 'rgba(156,143,128,0.3)' : 'rgba(0,0,0,0.2)'}; pointer-events: none; }`}</style>

      {/* Resize handles */}
      {isSelected && !isGroup && ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'].map((h) => {
        const corner = h.length === 2;
        const s: React.CSSProperties = { position: 'absolute', background: 'transparent', zIndex: 20 };
        if (h.includes('n')) { s.top = -3; s.height = 6; s.cursor = corner ? `${h}-resize` : 'n-resize'; }
        if (h.includes('s')) { s.bottom = -3; s.height = 6; s.cursor = corner ? `${h}-resize` : 's-resize'; }
        if (h.includes('e')) { s.right = -3; s.width = 6; s.cursor = corner ? `${h}-resize` : 'e-resize'; }
        if (h.includes('w')) { s.left = -3; s.width = 6; s.cursor = corner ? `${h}-resize` : 'w-resize'; }
        if (!corner) { if (h === 'n' || h === 's') { s.left = 0; s.width = '100%'; } else { s.top = 0; s.height = '100%'; } }
        if (corner) { s.width = 10; s.height = 10; }
        return <div key={h} style={s} onMouseDown={(e) => onResizeStart(e, h)} />;
      })}

      {/* Edge anchor dots */}
      {showAnchors && anchors.map(({ side, css }) => (
        <div
          key={side}
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onStartEdge(card.id, side); }}
          style={{
            position: 'absolute', ...css,
            width: 8, height: 8, borderRadius: '50%',
            background: '#C4956A',
            border: `2px solid ${isDark ? 'rgba(28,26,23,0.9)' : 'rgba(255,255,255,0.9)'}`,
            cursor: 'crosshair', zIndex: 25,
          }}
        />
      ))}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// PaperCard — loose paper with tap-to-unfold animation
//
// Visual: slightly rotated, paper texture, folded corner, shadow.
// On tap: spring zoom + unfold into full card. After animation,
// the card transitions from type 'paper' → 'text'.
// ═══════════════════════════════════════════════════════════════════

interface PaperCardProps {
  card: CanvasCard;
  isDark: boolean;
  isSelected: boolean;
  zoom: number;
  onSelect: (id: string, multi: boolean) => void;
  onUpdate: (id: string, updates: Partial<CanvasCard>) => void;
  onDragStart: (cardId: string, e: React.MouseEvent) => void;
  onUnfold: (cardId: string) => void;
}

const PAPER_SPRING = { type: 'spring' as const, stiffness: 260, damping: 24, mass: 0.8 };
const UNFOLD_SPRING = { type: 'spring' as const, stiffness: 180, damping: 22, mass: 1.0 };

const PaperCard = memo(function PaperCard({
  card, isDark, isSelected, zoom, onSelect, onUpdate, onDragStart, onUnfold,
}: PaperCardProps) {
  const [phase, setPhase] = useState<'idle' | 'hover' | 'unfolding' | 'done'>('idle');
  const rotation = card.paperRotation ?? ((card.createdAt % 13) - 6); // -6° to +6°

  const paperBg = isDark
    ? 'linear-gradient(135deg, rgba(52,48,42,0.95) 0%, rgba(42,38,33,0.92) 100%)'
    : 'linear-gradient(135deg, rgba(255,252,245,0.98) 0%, rgba(248,241,228,0.95) 100%)';

  const shadowIdle = isDark
    ? '2px 3px 12px rgba(0,0,0,0.4), 1px 1px 4px rgba(0,0,0,0.3)'
    : '2px 3px 16px rgba(0,0,0,0.08), 1px 1px 6px rgba(0,0,0,0.04)';

  const shadowHover = isDark
    ? '3px 5px 20px rgba(0,0,0,0.5), 2px 2px 8px rgba(0,0,0,0.35)'
    : '3px 5px 24px rgba(0,0,0,0.12), 2px 2px 8px rgba(0,0,0,0.06)';

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (phase === 'unfolding' || phase === 'done') return;
    setPhase('unfolding');
    onSelect(card.id, false);
    onUnfold(card.id);
  }, [phase, card.id, onSelect, onUnfold]);

  // After unfold animation completes, convert to text card
  const handleUnfoldComplete = useCallback(() => {
    if (phase !== 'unfolding') return;
    setPhase('done');
    onUpdate(card.id, { type: 'text', paperRotation: undefined });
  }, [phase, card.id, onUpdate]);

  const isUnfolding = phase === 'unfolding';
  const foldedCornerSize = isUnfolding ? 0 : 16;

  return (
    <div
      onMouseDown={(e) => {
        if (phase !== 'unfolding') {
          e.preventDefault();
          e.stopPropagation();
          onDragStart(card.id, e);
        }
      }}
      onClick={handleClick}
      onMouseEnter={() => { if (phase === 'idle') setPhase('hover'); }}
      onMouseLeave={() => { if (phase === 'hover') setPhase('idle'); }}
      onTransitionEnd={handleUnfoldComplete}
      style={{
        position: 'absolute',
        left: card.x,
        top: card.y,
        width: card.width,
        height: card.height,
        transformOrigin: 'center center',
        transform: isUnfolding
          ? 'rotate(0deg) scale(1.08)'
          : `rotate(${rotation}deg) scale(${phase === 'hover' ? 1.04 : 1})`,
        transition: isUnfolding
          ? 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease'
          : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease',
        background: paperBg,
        borderRadius: isUnfolding ? 10 : 6,
        border: `1.5px solid ${isSelected ? '#C4956A' : (isDark ? 'rgba(79,69,57,0.3)' : 'rgba(208,196,180,0.35)')}`,
        boxShadow: phase === 'hover' || isUnfolding ? shadowHover : shadowIdle,
        cursor: isUnfolding ? 'default' : 'pointer',
        zIndex: isUnfolding ? 50 : isSelected ? 10 : 2,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Folded corner — triangle in top-right, disappears on unfold */}
      {foldedCornerSize > 0 && (
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 0,
          height: 0,
          borderStyle: 'solid',
          borderWidth: `0 ${foldedCornerSize}px ${foldedCornerSize}px 0`,
          borderColor: `transparent ${isDark ? 'rgba(28,25,20,0.9)' : 'rgba(232,224,212,0.95)'} transparent transparent`,
          filter: isDark ? 'drop-shadow(-1px 1px 2px rgba(0,0,0,0.3))' : 'drop-shadow(-1px 1px 2px rgba(0,0,0,0.06))',
          transition: 'opacity 0.3s ease',
          opacity: isUnfolding ? 0 : 1,
          zIndex: 2,
        }} />
      )}

      {/* Paper lines — decorative ruled lines */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: isDark ? 0.06 : 0.08,
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 23px, ${isDark ? 'rgba(196,149,106,1)' : 'rgba(120,100,80,1)'} 23px, transparent 24px)`,
        backgroundPosition: '0 28px',
        pointerEvents: 'none',
      }} />

      {/* Paper content */}
      <div style={{
        flex: 1,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: isDark ? 'rgba(196,149,106,0.7)' : 'rgba(120,90,60,0.65)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}>
          {card.header || 'Loose Paper'}
        </div>
        {card.body && (
          <div style={{
            fontSize: '0.6875rem',
            color: isDark ? 'rgba(156,143,128,0.5)' : 'rgba(0,0,0,0.35)',
            lineHeight: 1.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical' as const,
          }}>
            {card.body}
          </div>
        )}
      </div>

      {/* "Tap to open" hint */}
      {phase !== 'unfolding' && phase !== 'done' && (
        <div style={{
          padding: '4px 12px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          opacity: phase === 'hover' ? 0.7 : 0.35,
          transition: 'opacity 0.2s ease',
        }}>
          <FileTextIcon style={{ width: 10, height: 10, color: isDark ? 'rgba(196,149,106,0.5)' : 'rgba(120,90,60,0.4)' }} />
          <span style={{
            fontSize: '0.5625rem',
            fontWeight: 500,
            color: isDark ? 'rgba(196,149,106,0.5)' : 'rgba(120,90,60,0.4)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            Tap to open
          </span>
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// Minimap
// ═══════════════════════════════════════════════════════════════════

const Minimap = memo(function Minimap({
  cards, camera, viewW, viewH, isDark, onJump,
}: {
  cards: CanvasCard[];
  camera: Camera;
  viewW: number; viewH: number;
  isDark: boolean;
  onJump: (x: number, y: number) => void;
}) {
  const W = 140, H = 100;
  if (cards.length === 0) return null;

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of cards) {
    x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x + c.width); y1 = Math.max(y1, c.y + c.height);
  }
  const pad = 100;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const cw = x1 - x0, ch = y1 - y0;
  const scale = Math.min(W / cw, H / ch);

  // Viewport rect in world coords
  const vx = -camera.x / camera.zoom;
  const vy = -camera.y / camera.zoom;
  const vw = viewW / camera.zoom;
  const vh = viewH / camera.zoom;

  return (
    <div
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / scale + x0;
        const my = (e.clientY - rect.top) / scale + y0;
        onJump(mx, my);
      }}
      style={{
        position: 'absolute', bottom: '4.5rem', left: '1rem', zIndex: 20,
        width: W, height: H, borderRadius: 8, overflow: 'hidden',
        background: isDark ? 'rgba(22,21,19,0.65)' : 'rgba(237,232,222,0.6)',
        border: `1px solid ${isDark ? 'rgba(50,49,45,0.25)' : 'rgba(190,183,170,0.3)'}`,
        cursor: 'pointer',
      }}
    >
      <svg width={W} height={H}>
        {cards.map((c) => (
          <rect
            key={c.id}
            x={(c.x - x0) * scale}
            y={(c.y - y0) * scale}
            width={c.width * scale}
            height={c.height * scale}
            fill={isDark ? 'rgba(196,149,106,0.3)' : 'rgba(196,149,106,0.25)'}
            rx={2}
          />
        ))}
        <rect
          x={(vx - x0) * scale}
          y={(vy - y0) * scale}
          width={vw * scale}
          height={vh * scale}
          fill="none"
          stroke={isDark ? 'rgba(196,149,106,0.6)' : 'rgba(196,149,106,0.5)'}
          strokeWidth={1.5}
          rx={2}
        />
      </svg>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// Canvas Controls — zoom, add, fit, undo/redo, minimap toggle
// ═══════════════════════════════════════════════════════════════════

function CanvasControls({ isDark, zoom, canUndo, canRedo, showMinimap, onZoomIn, onZoomOut, onFitView, onAddCard, onAddPaper, onAddGroup, onUndo, onRedo, onToggleMinimap }: {
  isDark: boolean; zoom: number; canUndo: boolean; canRedo: boolean; showMinimap: boolean;
  onZoomIn: () => void; onZoomOut: () => void; onFitView: () => void;
  onAddCard: () => void; onAddPaper: () => void; onAddGroup: () => void;
  onUndo: () => void; onRedo: () => void; onToggleMinimap: () => void;
}) {
  const btn = (disabled?: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: disabled ? 'default' : 'pointer',
    background: 'transparent',
    color: disabled ? (isDark ? 'rgba(155,150,137,0.25)' : 'rgba(0,0,0,0.15)') : (isDark ? 'rgba(155,150,137,0.7)' : 'rgba(0,0,0,0.4)'),
    transition: 'color 0.15s, background 0.15s',
    opacity: disabled ? 0.5 : 1,
  });
  const sep: React.CSSProperties = {
    height: 1, width: 16,
    background: isDark ? 'rgba(79,69,57,0.3)' : 'rgba(190,183,170,0.3)',
    margin: '2px 0',
  };

  return (
    <div style={{
      position: 'absolute', bottom: '4.5rem', right: '1rem', zIndex: 20,
      display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center',
      borderRadius: '9999px', padding: '0.25rem',
      background: isDark ? 'rgba(22,21,19,0.65)' : 'rgba(237,232,222,0.6)',
      border: `1px solid ${isDark ? 'rgba(50,49,45,0.25)' : 'rgba(190,183,170,0.3)'}`,
      boxShadow: isDark ? '0 2px 12px -2px rgba(0,0,0,0.3)' : '0 2px 16px -2px rgba(0,0,0,0.06)',
    }}>
      <button onClick={onAddCard} style={btn()} title="Add text card"><PlusIcon style={{ width: 14, height: 14 }} /></button>
      <button onClick={onAddPaper} style={btn()} title="Add loose paper"><StickyNoteIcon style={{ width: 12, height: 12 }} /></button>
      <button onClick={onAddGroup} style={btn()} title="Add group"><FileTextIcon style={{ width: 12, height: 12 }} /></button>
      <div style={sep} />
      <button onClick={onUndo} style={btn(!canUndo)} title="Undo (Cmd+Z)" disabled={!canUndo}><Undo2Icon style={{ width: 13, height: 13 }} /></button>
      <button onClick={onRedo} style={btn(!canRedo)} title="Redo (Cmd+Shift+Z)" disabled={!canRedo}><Redo2Icon style={{ width: 13, height: 13 }} /></button>
      <div style={sep} />
      <button onClick={onZoomIn} style={btn()} title="Zoom in"><ZoomInIcon style={{ width: 14, height: 14 }} /></button>
      <span style={{ fontSize: '0.5625rem', fontWeight: 600, color: isDark ? 'rgba(155,150,137,0.5)' : 'rgba(0,0,0,0.25)', fontFamily: 'var(--font-mono, monospace)' }}>
        {Math.round(zoom * 100)}%
      </span>
      <button onClick={onZoomOut} style={btn()} title="Zoom out"><ZoomOutIcon style={{ width: 14, height: 14 }} /></button>
      <div style={sep} />
      <button onClick={onFitView} style={btn()} title="Fit view"><MaximizeIcon style={{ width: 12, height: 12 }} /></button>
      <button onClick={onToggleMinimap} style={{ ...btn(), background: showMinimap ? (isDark ? 'rgba(196,149,106,0.12)' : 'rgba(196,149,106,0.08)') : 'transparent' }} title="Toggle minimap"><MapIcon style={{ width: 12, height: 12 }} /></button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NoteCanvas — main component
// ═══════════════════════════════════════════════════════════════════

interface NoteCanvasProps {
  pageId: string;
  vaultId: string;
  onFormatAction?: (format: string) => void;
}

export const NoteCanvas = memo(function NoteCanvas({ pageId, vaultId }: NoteCanvasProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? (resolvedTheme === 'dark' || resolvedTheme === 'oled') : true;

  const notePages = usePFCStore((s) => s.notePages);
  const setActivePage = usePFCStore((s) => s.setActivePage);

  const [cards, setCards] = useState<CanvasCard[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [edgeDraft, setEdgeDraft] = useState<{ fromId: string; fromSide: 'top' | 'right' | 'bottom' | 'left'; mx: number; my: number } | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [showMinimap, setShowMinimap] = useState(false);
  const [viewSize, setViewSize] = useState({ w: 800, h: 600 });

  const canvasRef = useRef<HTMLDivElement>(null);
  const panStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 });
  const undoStackRef = useRef<UndoStack>({ past: [], future: [] });
  const inertiaRef = useRef<{ vx: number; vy: number; raf: number | null }>({ vx: 0, vy: 0, raf: null });
  const lastPanPos = useRef({ x: 0, y: 0, t: 0 });
  const isDraggingCards = useRef(false);

  // ── Track container size ──
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setViewSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Load ──
  useEffect(() => {
    const data = loadCanvas(vaultId, pageId);
    setCards(data.cards);
    setEdges(data.edges);
    setSelectedIds(new Set());
    setCamera({ x: 0, y: 0, zoom: 1 });
    undoStackRef.current = { past: [], future: [] };
  }, [pageId, vaultId]);

  // ── Auto-save ──
  const saveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (cards.length === 0 && edges.length === 0 && !localStorage.getItem(`pfc-canvas-${vaultId}-${pageId}`)) return;
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => saveCanvas(vaultId, pageId, { cards, edges }), 400);
    return () => { if (saveRef.current) clearTimeout(saveRef.current); };
  }, [cards, edges, vaultId, pageId]);

  // ── Undo/Redo ──

  const pushUndo = useCallback(() => {
    undoStackRef.current.past.push({ cards: JSON.parse(JSON.stringify(cards)), edges: JSON.parse(JSON.stringify(edges)) });
    if (undoStackRef.current.past.length > 50) undoStackRef.current.past.shift();
    undoStackRef.current.future = [];
  }, [cards, edges]);

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.past.length === 0) return;
    stack.future.push({ cards: JSON.parse(JSON.stringify(cards)), edges: JSON.parse(JSON.stringify(edges)) });
    const prev = stack.past.pop()!;
    setCards(prev.cards);
    setEdges(prev.edges);
  }, [cards, edges]);

  const redo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.future.length === 0) return;
    stack.past.push({ cards: JSON.parse(JSON.stringify(cards)), edges: JSON.parse(JSON.stringify(edges)) });
    const next = stack.future.pop()!;
    setCards(next.cards);
    setEdges(next.edges);
  }, [cards, edges]);

  // ── Wheel zoom (toward cursor) ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const delta = e.ctrlKey ? -e.deltaY * 0.01 : -e.deltaY * 0.001;
    setCamera((cam) => {
      const nz = clamp(cam.zoom * (1 + delta), MIN_ZOOM, MAX_ZOOM);
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const s = nz / cam.zoom;
      return { x: mx - s * (mx - cam.x), y: my - s * (my - cam.y), zoom: nz };
    });
  }, []);

  // ── Inertial panning (Freeform physics) ──
  const startInertia = useCallback(() => {
    const now = performance.now();
    const dt = now - lastPanPos.current.t;
    if (dt > 0 && dt < 150) {
      inertiaRef.current.vx = (panStart.current.cx - lastPanPos.current.x) / dt * 16;
      inertiaRef.current.vy = (panStart.current.cy - lastPanPos.current.y) / dt * 16;
      // Note: vx/vy are per-frame estimates
    }

    if (inertiaRef.current.raf) cancelAnimationFrame(inertiaRef.current.raf);

    const animate = () => {
      const { vx, vy } = inertiaRef.current;
      if (Math.abs(vx) < INERTIA_MIN_V && Math.abs(vy) < INERTIA_MIN_V) {
        inertiaRef.current.raf = null;
        return;
      }
      setCamera((c) => ({
        ...c,
        x: c.x + vx,
        y: c.y + vy,
      }));
      inertiaRef.current.vx *= INERTIA_FRICTION;
      inertiaRef.current.vy *= INERTIA_FRICTION;
      inertiaRef.current.raf = requestAnimationFrame(animate);
    };

    if (Math.abs(inertiaRef.current.vx) > INERTIA_MIN_V || Math.abs(inertiaRef.current.vy) > INERTIA_MIN_V) {
      inertiaRef.current.raf = requestAnimationFrame(animate);
    }
  }, []);

  const stopInertia = useCallback(() => {
    if (inertiaRef.current.raf) {
      cancelAnimationFrame(inertiaRef.current.raf);
      inertiaRef.current.raf = null;
    }
    inertiaRef.current.vx = 0;
    inertiaRef.current.vy = 0;
  }, []);

  // ── Pan (Space+drag, alt+drag, or middle-click) ──
  const startPan = useCallback((e: React.MouseEvent | MouseEvent) => {
    stopInertia();
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y };
    lastPanPos.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    const onMove = (ev: MouseEvent) => {
      const nx = panStart.current.cx + (ev.clientX - panStart.current.x);
      const ny = panStart.current.cy + (ev.clientY - panStart.current.y);
      // Track velocity for inertia
      lastPanPos.current = { x: panStart.current.cx, y: panStart.current.cy, t: performance.now() };
      panStart.current.cx = nx;
      panStart.current.cy = ny;
      setCamera((c) => ({ ...c, x: nx, y: ny }));
    };
    const onUp = () => {
      setIsPanning(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      startInertia();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [camera.x, camera.y, stopInertia, startInertia]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.canvasGrid) return;

    // Space+drag or middle-click or alt/meta+click => pan
    if (spaceDown || e.button === 1 || (e.button === 0 && (e.altKey || e.metaKey))) {
      e.preventDefault();
      startPan(e);
      return;
    }

    // Left-click on background => start marquee selection
    if (e.button === 0) {
      if (!e.shiftKey) setSelectedIds(new Set());
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const wx = (e.clientX - rect.left - camera.x) / camera.zoom;
      const wy = (e.clientY - rect.top - camera.y) / camera.zoom;
      setMarquee({ x0: wx, y0: wy, x1: wx, y1: wy });
      const onMove = (ev: MouseEvent) => {
        const ewx = (ev.clientX - rect.left - camera.x) / camera.zoom;
        const ewy = (ev.clientY - rect.top - camera.y) / camera.zoom;
        setMarquee((m) => m ? { ...m, x1: ewx, y1: ewy } : null);
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setMarquee((m) => {
          if (!m) return null;
          const sx = Math.min(m.x0, m.x1), sy = Math.min(m.y0, m.y1);
          const sw = Math.abs(m.x1 - m.x0), sh = Math.abs(m.y1 - m.y0);
          if (sw < 5 && sh < 5) return null; // too small, treat as click-deselect
          // Select cards intersecting the marquee
          setSelectedIds((prev) => {
            const ids = new Set(e.shiftKey ? prev : []);
            for (const c of cards) {
              if (c.x + c.width >= sx && c.x <= sx + sw && c.y + c.height >= sy && c.y <= sy + sh) {
                ids.add(c.id);
              }
            }
            return ids;
          });
          return null;
        });
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
  }, [camera, spaceDown, startPan, cards]);

  // ── Double-click to create ──
  const handleDblClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.canvasGrid) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const wx = (e.clientX - rect.left - camera.x) / camera.zoom;
    const wy = (e.clientY - rect.top - camera.y) / camera.zoom;
    pushUndo();
    const id = uid();
    setCards((p) => [...p, { id, type: 'text', x: snap(wx - 140), y: snap(wy - 40), width: 280, height: 160, color: 'default', header: '', body: '', createdAt: Date.now(), updatedAt: Date.now() }]);
    setSelectedIds(new Set([id]));
  }, [camera, pushUndo]);

  const handleSelect = useCallback((id: string, multi: boolean) => {
    setSelectedIds((p) => {
      if (multi) { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }
      return new Set([id]);
    });
  }, []);

  const handleUpdateCard = useCallback((id: string, u: Partial<CanvasCard>) => {
    setCards((p) => p.map((c) => c.id === id ? { ...c, ...u } : c));
  }, []);

  const handleDeleteCard = useCallback((id: string) => {
    pushUndo();
    setCards((p) => p.filter((c) => c.id !== id));
    setEdges((p) => p.filter((e) => e.fromCardId !== id && e.toCardId !== id));
    setSelectedIds((p) => { const n = new Set(p); n.delete(id); return n; });
  }, [pushUndo]);

  // ── Card drag with snap alignment guides ──
  const handleCardDragStart = useCallback((cardId: string, e: React.MouseEvent) => {
    // If card isn't selected, select it
    const ids = selectedIds.has(cardId) ? selectedIds : new Set([cardId]);
    if (!selectedIds.has(cardId)) setSelectedIds(ids);

    pushUndo();
    isDraggingCards.current = true;
    const startX = e.clientX, startY = e.clientY;

    // Snapshot positions of all selected cards
    const startPositions = new Map<string, { x: number; y: number }>();
    for (const c of cards) {
      if (ids.has(c.id)) startPositions.set(c.id, { x: c.x, y: c.y });
    }

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / camera.zoom;
      const dy = (ev.clientY - startY) / camera.zoom;

      // Compute bounds of all moving cards
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const c of cards) {
        const sp = startPositions.get(c.id);
        if (!sp) continue;
        const nx = snap(sp.x + dx), ny = snap(sp.y + dy);
        bx0 = Math.min(bx0, nx);
        by0 = Math.min(by0, ny);
        bx1 = Math.max(bx1, nx + c.width);
        by1 = Math.max(by1, ny + c.height);
      }

      // Compute snap guides
      const { guides, snapDx, snapDy } = computeSnapGuides(ids, { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 }, cards);
      setSnapGuides(guides);

      setCards((prev) => prev.map((c) => {
        const sp = startPositions.get(c.id);
        if (!sp) return c;
        return { ...c, x: snap(sp.x + dx) + snapDx, y: snap(sp.y + dy) + snapDy };
      }));
    };

    const onUp = () => {
      isDraggingCards.current = false;
      setSnapGuides([]);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [cards, selectedIds, camera.zoom, pushUndo]);

  // ── Edge creation ──
  const handleStartEdge = useCallback((cardId: string, side: 'top' | 'right' | 'bottom' | 'left') => {
    setEdgeDraft({ fromId: cardId, fromSide: side, mx: 0, my: 0 });
    const onMove = (ev: MouseEvent) => { setEdgeDraft((d) => d ? { ...d, mx: ev.clientX, my: ev.clientY } : null); };
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) { setEdgeDraft(null); return; }
      const wx = (ev.clientX - rect.left - camera.x) / camera.zoom;
      const wy = (ev.clientY - rect.top - camera.y) / camera.zoom;
      const target = cards.find((c) => c.id !== cardId && wx >= c.x && wx <= c.x + c.width && wy >= c.y && wy <= c.y + c.height);
      if (target) {
        pushUndo();
        setEdges((p) => [...p, { id: uid(), fromCardId: cardId, toCardId: target.id, fromSide: side, toSide: closestSide(target, wx, wy), color: 'default' }]);
      }
      setEdgeDraft(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [cards, camera, pushUndo]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isEditable = (document.activeElement as HTMLElement)?.isContentEditable;

      // Space key for pan mode
      if (e.key === ' ' && !isEditable) {
        e.preventDefault();
        setSpaceDown(true);
        return;
      }

      // Delete/Backspace — delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditable && selectedIds.size > 0) {
        pushUndo();
        setCards((p) => p.filter((c) => !selectedIds.has(c.id)));
        setEdges((p) => p.filter((e) => !selectedIds.has(e.fromCardId) && !selectedIds.has(e.toCardId)));
        setSelectedIds(new Set());
        return;
      }

      // Escape — deselect
      if (e.key === 'Escape') { setSelectedIds(new Set()); return; }

      // Cmd+A — select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !isEditable) {
        e.preventDefault();
        setSelectedIds(new Set(cards.map((c) => c.id)));
        return;
      }

      // Cmd+D — duplicate selected
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && !isEditable && selectedIds.size > 0) {
        e.preventDefault();
        pushUndo();
        const newIds = new Set<string>();
        const idMap = new Map<string, string>();
        setCards((prev) => {
          const dupes: CanvasCard[] = [];
          for (const c of prev) {
            if (!selectedIds.has(c.id)) continue;
            const nid = uid();
            idMap.set(c.id, nid);
            newIds.add(nid);
            dupes.push({ ...c, id: nid, x: c.x + GRID_SIZE * 2, y: c.y + GRID_SIZE * 2, createdAt: Date.now(), updatedAt: Date.now() });
          }
          return [...prev, ...dupes];
        });
        // Duplicate edges between selected cards
        setEdges((prev) => {
          const dupeEdges: CanvasEdge[] = [];
          for (const e of prev) {
            const nf = idMap.get(e.fromCardId);
            const nt = idMap.get(e.toCardId);
            if (nf && nt) dupeEdges.push({ ...e, id: uid(), fromCardId: nf, toCardId: nt });
          }
          return [...prev, ...dupeEdges];
        });
        setSelectedIds(newIds);
        return;
      }

      // Cmd+Z — undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && !isEditable) {
        e.preventDefault();
        undo();
        return;
      }

      // Cmd+Shift+Z — redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey && !isEditable) {
        e.preventDefault();
        redo();
        return;
      }

      // Arrow keys — nudge selected cards
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isEditable && selectedIds.size > 0) {
        e.preventDefault();
        const step = e.shiftKey ? GRID_SIZE * 4 : GRID_SIZE;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        pushUndo();
        setCards((prev) => prev.map((c) => selectedIds.has(c.id) ? { ...c, x: c.x + dx, y: c.y + dy } : c));
        return;
      }
    };

    const keyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') setSpaceDown(false);
    };

    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', keyUp);
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keyup', keyUp); };
  }, [selectedIds, cards, pushUndo, undo, redo]);

  // ── Zoom controls ──
  const zoomIn = useCallback(() => setCamera((c) => {
    const nz = clamp(c.zoom * 1.25, MIN_ZOOM, MAX_ZOOM);
    const mx = viewSize.w / 2, my = viewSize.h / 2;
    const s = nz / c.zoom;
    return { x: mx - s * (mx - c.x), y: my - s * (my - c.y), zoom: nz };
  }), [viewSize]);

  const zoomOut = useCallback(() => setCamera((c) => {
    const nz = clamp(c.zoom / 1.25, MIN_ZOOM, MAX_ZOOM);
    const mx = viewSize.w / 2, my = viewSize.h / 2;
    const s = nz / c.zoom;
    return { x: mx - s * (mx - c.x), y: my - s * (my - c.y), zoom: nz };
  }), [viewSize]);

  const fitView = useCallback(() => {
    if (cards.length === 0) { setCamera({ x: 0, y: 0, zoom: 1 }); return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of cards) { x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + c.width); y1 = Math.max(y1, c.y + c.height); }
    const cw = x1 - x0 + 100, ch = y1 - y0 + 100;
    const z = clamp(Math.min(viewSize.w / cw, viewSize.h / ch), MIN_ZOOM, 1.5);
    setCamera({ x: (viewSize.w - cw * z) / 2 - x0 * z + 50 * z, y: (viewSize.h - ch * z) / 2 - y0 * z + 50 * z, zoom: z });
  }, [cards, viewSize]);

  const addCard = useCallback(() => {
    const cx = viewSize.w / 2, cy = viewSize.h / 2;
    const wx = (cx - camera.x) / camera.zoom;
    const wy = (cy - camera.y) / camera.zoom;
    pushUndo();
    const id = uid();
    setCards((p) => [...p, { id, type: 'text', x: snap(wx - 140), y: snap(wy - 80), width: 280, height: 160, color: 'default', header: '', body: '', createdAt: Date.now(), updatedAt: Date.now() }]);
    setSelectedIds(new Set([id]));
  }, [camera, viewSize, pushUndo]);

  const addGroup = useCallback(() => {
    const cx = viewSize.w / 2, cy = viewSize.h / 2;
    const wx = (cx - camera.x) / camera.zoom;
    const wy = (cy - camera.y) / camera.zoom;
    pushUndo();
    const id = uid();
    setCards((p) => [...p, { id, type: 'group', x: snap(wx - 200), y: snap(wy - 150), width: 400, height: 300, color: 'default', header: '', body: '', label: 'Group', createdAt: Date.now(), updatedAt: Date.now() }]);
    setSelectedIds(new Set([id]));
  }, [camera, viewSize, pushUndo]);

  // ── Add loose paper (tap-to-unfold card) ──
  const addPaper = useCallback(() => {
    const cx = viewSize.w / 2, cy = viewSize.h / 2;
    const wx = (cx - camera.x) / camera.zoom;
    const wy = (cy - camera.y) / camera.zoom;
    pushUndo();
    const id = uid();
    const rotation = Math.round((Math.random() - 0.5) * 12); // -6° to +6°
    setCards((p) => [...p, {
      id, type: 'paper' as const,
      x: snap(wx - 100), y: snap(wy - 60),
      width: 200, height: 140,
      color: 'default', header: '', body: '',
      createdAt: Date.now(), updatedAt: Date.now(),
      paperRotation: rotation,
    }]);
    setSelectedIds(new Set([id]));
  }, [camera, viewSize, pushUndo]);

  // ── Paper unfold: smooth camera zoom to paper, then transition to text card ──
  const handlePaperUnfold = useCallback((cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    // Animate camera to center on the paper and zoom in
    const targetZoom = clamp(1.2, MIN_ZOOM, MAX_ZOOM);
    const cardCenterX = card.x + card.width / 2;
    const cardCenterY = card.y + card.height / 2;
    const targetX = viewSize.w / 2 - cardCenterX * targetZoom;
    const targetY = viewSize.h / 2 - cardCenterY * targetZoom;

    // Smooth CSS transition via requestAnimationFrame
    const duration = 500; // ms
    const startTime = performance.now();
    const startCam = { ...camera };

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - t, 3);

      setCamera({
        x: startCam.x + (targetX - startCam.x) * ease,
        y: startCam.y + (targetY - startCam.y) * ease,
        zoom: startCam.zoom + (targetZoom - startCam.zoom) * ease,
      });

      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [cards, camera, viewSize]);

  const handleMinimapJump = useCallback((wx: number, wy: number) => {
    setCamera((c) => ({
      ...c,
      x: -wx * c.zoom + viewSize.w / 2,
      y: -wy * c.zoom + viewSize.h / 2,
    }));
  }, [viewSize]);

  const pageMap = useMemo(() => { const m = new Map<string, NotePage>(); for (const p of notePages) m.set(p.id, p); return m; }, [notePages]);
  const dotColor = isDark ? 'rgba(79,69,57,0.15)' : 'rgba(180,170,155,0.12)';

  // ── LOD level based on zoom ──
  const getLod = useCallback((zoom: number): 'full' | 'reduced' | 'dot' => {
    if (zoom < 0.2) return 'dot';
    if (zoom < 0.45) return 'reduced';
    return 'full';
  }, []);

  // ── Viewport culling ──
  const visibleCards = useMemo(() => {
    return cards.filter((c) => isCardVisible(c, camera, viewSize.w, viewSize.h));
  }, [cards, camera, viewSize]);

  // ── Draft edge SVG path ──
  const draftPath = useMemo(() => {
    if (!edgeDraft || !edgeDraft.mx) return null;
    const fc = cards.find((c) => c.id === edgeDraft.fromId);
    if (!fc) return null;
    const from = getAnchor(fc, edgeDraft.fromSide);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const to = { x: (edgeDraft.mx - rect.left - camera.x) / camera.zoom, y: (edgeDraft.my - rect.top - camera.y) / camera.zoom };
    return buildEdgePath(from, to, edgeDraft.fromSide, 'left');
  }, [edgeDraft, cards, camera]);

  const lod = getLod(camera.zoom);

  return (
    <div
      ref={canvasRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDblClick}
      style={{
        position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
        cursor: spaceDown ? (isPanning ? 'grabbing' : 'grab') : isPanning ? 'grabbing' : 'default',
        background: isDark ? 'var(--background)' : 'var(--background)',
      }}
    >
      {/* Dot grid */}
      <div
        data-canvas-grid="true"
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`,
          backgroundSize: `${GRID_SIZE * camera.zoom}px ${GRID_SIZE * camera.zoom}px`,
          backgroundPosition: `${camera.x % (GRID_SIZE * camera.zoom)}px ${camera.y % (GRID_SIZE * camera.zoom)}px`,
          pointerEvents: 'none',
        }}
      />

      {/* Transform layer */}
      <div style={{
        position: 'absolute', top: 0, left: 0, transformOrigin: '0 0',
        transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
        willChange: 'transform',
      }}>
        {/* SVG edges + snap guides + marquee */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
          {edges.map((edge) => {
            const fc = cards.find((c) => c.id === edge.fromCardId);
            const tc = cards.find((c) => c.id === edge.toCardId);
            if (!fc || !tc) return null;
            const from = getAnchor(fc, edge.fromSide);
            const to = getAnchor(tc, edge.toSide);
            const d = buildEdgePath(from, to, edge.fromSide, edge.toSide);
            const ec = CARD_COLORS.find((c) => c.id === edge.color);
            const stroke = ec?.border || (isDark ? 'rgba(196,149,106,0.4)' : 'rgba(196,149,106,0.3)');
            return (
              <g key={edge.id}>
                <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
                <circle cx={to.x} cy={to.y} r={4} fill={stroke} />
                <path d={d} fill="none" stroke="transparent" strokeWidth={12} style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onClick={() => { pushUndo(); setEdges((p) => p.filter((e) => e.id !== edge.id)); }} />
                {edge.label && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8} textAnchor="middle" fill={isDark ? 'rgba(155,150,137,0.6)' : 'rgba(0,0,0,0.35)'} fontSize={11} fontWeight={500}>{edge.label}</text>}
              </g>
            );
          })}
          {draftPath && <path d={draftPath} fill="none" stroke={isDark ? 'rgba(196,149,106,0.5)' : 'rgba(196,149,106,0.4)'} strokeWidth={2} strokeDasharray="6 4" strokeLinecap="round" />}

          {/* Snap alignment guides */}
          {snapGuides.map((g, i) => (
            g.type === 'x'
              ? <line key={`sg-${i}`} x1={g.pos} y1={-10000} x2={g.pos} y2={10000} stroke="rgba(196,149,106,0.5)" strokeWidth={1} strokeDasharray="4 3" />
              : <line key={`sg-${i}`} x1={-10000} y1={g.pos} x2={10000} y2={g.pos} stroke="rgba(196,149,106,0.5)" strokeWidth={1} strokeDasharray="4 3" />
          ))}
        </svg>

        {/* Cards — viewport culled, LOD-aware, paper cards get special treatment */}
        {visibleCards.map((card) => (
          card.type === 'paper' ? (
            <PaperCard
              key={card.id}
              card={card}
              isDark={isDark}
              isSelected={selectedIds.has(card.id)}
              zoom={camera.zoom}
              onSelect={handleSelect}
              onUpdate={handleUpdateCard}
              onDragStart={handleCardDragStart}
              onUnfold={handlePaperUnfold}
            />
          ) : (
            <CanvasCardView
              key={card.id}
              card={card}
              isDark={isDark}
              isSelected={selectedIds.has(card.id)}
              zoom={camera.zoom}
              lod={lod}
              onSelect={handleSelect}
              onUpdate={handleUpdateCard}
              onDelete={handleDeleteCard}
              onStartEdge={handleStartEdge}
              onDragStart={handleCardDragStart}
              linkedPage={card.linkedPageId ? pageMap.get(card.linkedPageId) ?? null : null}
              onNavigateToPage={setActivePage}
            />
          )
        ))}
      </div>

      {/* Marquee selection overlay */}
      {marquee && Math.abs(marquee.x1 - marquee.x0) > 3 && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(marquee.x0, marquee.x1) * camera.zoom + camera.x,
            top: Math.min(marquee.y0, marquee.y1) * camera.zoom + camera.y,
            width: Math.abs(marquee.x1 - marquee.x0) * camera.zoom,
            height: Math.abs(marquee.y1 - marquee.y0) * camera.zoom,
            background: isDark ? 'rgba(196,149,106,0.08)' : 'rgba(196,149,106,0.06)',
            border: `1.5px solid ${isDark ? 'rgba(196,149,106,0.35)' : 'rgba(196,149,106,0.3)'}`,
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Empty state */}
      {cards.length === 0 && (
        <div style={{
          position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isDark ? 'rgba(196,149,106,0.08)' : 'rgba(196,149,106,0.06)',
            border: `1px solid ${isDark ? 'rgba(196,149,106,0.15)' : 'rgba(196,149,106,0.12)'}`,
          }}>
            <TypeIcon style={{ width: 20, height: 20, color: isDark ? 'rgba(196,149,106,0.5)' : 'rgba(196,149,106,0.45)' }} />
          </div>
          <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: isDark ? 'rgba(156,143,128,0.35)' : 'rgba(0,0,0,0.2)', letterSpacing: '-0.01em', textAlign: 'center' }}>
            Double-click to add a card · Drop loose paper from toolbar · Space+drag to pan
          </span>
        </div>
      )}

      {showMinimap && (
        <Minimap cards={cards} camera={camera} viewW={viewSize.w} viewH={viewSize.h} isDark={isDark} onJump={handleMinimapJump} />
      )}

      <CanvasControls
        isDark={isDark}
        zoom={camera.zoom}
        canUndo={undoStackRef.current.past.length > 0}
        canRedo={undoStackRef.current.future.length > 0}
        showMinimap={showMinimap}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitView={fitView}
        onAddCard={addCard}
        onAddPaper={addPaper}
        onAddGroup={addGroup}
        onUndo={undo}
        onRedo={redo}
        onToggleMinimap={() => setShowMinimap((p) => !p)}
      />
    </div>
  );
});
