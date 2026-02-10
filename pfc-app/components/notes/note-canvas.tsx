'use client';

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { GripHorizontalIcon, XIcon, TypeIcon } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// OneNote-style Canvas — tap anywhere to create text boxes
// ═══════════════════════════════════════════════════════════════════

const CUP_EASE = [0.32, 0.72, 0, 1] as const;

export interface CanvasBox {
  id: string;
  x: number;
  y: number;
  width: number;
  minHeight: number;
  header: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

function createBoxId(): string {
  return `cb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Storage helpers ──

function loadCanvasBoxes(vaultId: string, pageId: string): CanvasBox[] {
  try {
    const raw = localStorage.getItem(`pfc-canvas-${vaultId}-${pageId}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveCanvasBoxes(vaultId: string, pageId: string, boxes: CanvasBox[]) {
  try {
    localStorage.setItem(`pfc-canvas-${vaultId}-${pageId}`, JSON.stringify(boxes));
  } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════
// CanvasTextBox — individual text box on the canvas
// ═══════════════════════════════════════════════════════════════════

interface TextBoxProps {
  box: CanvasBox;
  isDark: boolean;
  isNew: boolean;
  onUpdate: (id: string, updates: Partial<CanvasBox>) => void;
  onDelete: (id: string) => void;
  onFocus: (id: string) => void;
  focusedId: string | null;
  onApplyFormat: (format: string) => void;
}

const CanvasTextBox = memo(function CanvasTextBox({
  box,
  isDark,
  isNew,
  onUpdate,
  onDelete,
  onFocus,
  focusedId,
  onApplyFormat,
}: TextBoxProps) {
  const isFocused = focusedId === box.id;
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, boxX: 0, boxY: 0 });
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Drag handling
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, boxX: box.x, boxY: box.y };

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStart.current.x;
      const dy = ev.clientY - dragStart.current.y;
      onUpdate(box.id, {
        x: Math.max(0, dragStart.current.boxX + dx),
        y: Math.max(0, dragStart.current.boxY + dy),
      });
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [box.id, box.x, box.y, onUpdate]);

  // Auto-focus header on new boxes
  useEffect(() => {
    if (isNew && headerRef.current) {
      headerRef.current.focus();
    }
  }, [isNew]);

  const border = isDark ? 'rgba(79,69,57,0.35)' : 'rgba(208,196,180,0.4)';
  const focusBorder = '#C4956A';
  const textColor = isDark ? 'rgba(237,224,212,0.95)' : 'rgba(0,0,0,0.85)';
  const mutedColor = isDark ? 'rgba(156,143,128,0.4)' : 'rgba(0,0,0,0.25)';
  const headerPlaceholder = isDark ? 'rgba(156,143,128,0.3)' : 'rgba(0,0,0,0.2)';

  return (
    <motion.div
      initial={isNew ? { opacity: 0, scale: 0.85, y: 8 } : false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.25, ease: CUP_EASE }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); onFocus(box.id); }}
      style={{
        position: 'absolute',
        left: box.x,
        top: box.y,
        width: box.width,
        minHeight: box.minHeight,
        display: 'flex',
        flexDirection: 'column',
        background: isDark ? 'rgba(28,26,23,0.92)' : 'rgba(255,255,255,0.92)',
        border: `1.5px solid ${isFocused ? focusBorder : border}`,
        borderRadius: 10,
        backdropFilter: 'blur(16px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
        boxShadow: isFocused
          ? `0 0 0 2px ${isDark ? 'rgba(196,149,106,0.15)' : 'rgba(196,149,106,0.12)'}, 0 8px 32px rgba(0,0,0,0.12)`
          : '0 2px 12px rgba(0,0,0,0.06)',
        cursor: dragging ? 'grabbing' : 'default',
        transition: 'border-color 0.15s, box-shadow 0.2s',
        zIndex: isFocused ? 10 : hovered ? 5 : 1,
        contain: 'layout',
      }}
    >
      {/* Drag handle bar */}
      <div
        onMouseDown={onDragStart}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px 0',
          cursor: 'grab',
          opacity: hovered || isFocused ? 1 : 0,
          transition: 'opacity 0.15s',
          height: 20,
          flexShrink: 0,
        }}
      >
        <GripHorizontalIcon style={{ width: 12, height: 12, color: mutedColor }} />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(box.id); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 16, height: 16, borderRadius: 4,
            background: 'transparent', border: 'none',
            color: mutedColor, cursor: 'pointer',
            opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
          }}
        >
          <XIcon style={{ width: 10, height: 10 }} />
        </button>
      </div>

      {/* Header section */}
      <div
        ref={headerRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Heading"
        onInput={(e) => {
          onUpdate(box.id, { header: e.currentTarget.textContent || '', updatedAt: Date.now() });
        }}
        onFocus={() => onFocus(box.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            bodyRef.current?.focus();
          }
        }}
        style={{
          padding: '6px 14px 2px',
          fontSize: '1.0625rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.35,
          color: textColor,
          outline: 'none',
          fontFamily: 'var(--font-display, var(--font-sans))',
          minHeight: '1.5rem',
          wordBreak: 'break-word',
        }}
        dangerouslySetInnerHTML={{ __html: box.header || '' }}
      />

      {/* Separator line */}
      <div style={{
        height: 1,
        margin: '2px 14px 4px',
        background: isFocused ? `${focusBorder}30` : border,
        transition: 'background 0.15s',
      }} />

      {/* Body section */}
      <div
        ref={bodyRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Type here..."
        onInput={(e) => {
          onUpdate(box.id, { body: e.currentTarget.innerHTML || '', updatedAt: Date.now() });
        }}
        onFocus={() => onFocus(box.id)}
        style={{
          padding: '2px 14px 12px',
          fontSize: '0.875rem',
          fontWeight: 400,
          lineHeight: 1.65,
          color: textColor,
          outline: 'none',
          fontFamily: 'var(--font-sans)',
          minHeight: '2rem',
          wordBreak: 'break-word',
          flex: 1,
        }}
        dangerouslySetInnerHTML={{ __html: box.body || '' }}
      />

      {/* Empty state placeholder styles */}
      <style>{`
        [data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: ${headerPlaceholder};
          pointer-events: none;
        }
      `}</style>
    </motion.div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// NoteCanvas — main canvas container
// ═══════════════════════════════════════════════════════════════════

interface NoteCanvasProps {
  pageId: string;
  vaultId: string;
  onFormatAction?: (format: string) => void;
}

export const NoteCanvas = memo(function NoteCanvas({
  pageId,
  vaultId,
  onFormatAction,
}: NoteCanvasProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? (resolvedTheme === 'dark' || resolvedTheme === 'oled') : true;

  const [boxes, setBoxes] = useState<CanvasBox[]>([]);
  const [focusedBoxId, setFocusedBoxId] = useState<string | null>(null);
  const [newBoxIds, setNewBoxIds] = useState<Set<string>>(new Set());
  const canvasRef = useRef<HTMLDivElement>(null);

  // Load boxes on page change
  useEffect(() => {
    const loaded = loadCanvasBoxes(vaultId, pageId);
    setBoxes(loaded);
    setFocusedBoxId(null);
    setNewBoxIds(new Set());
  }, [pageId, vaultId]);

  // Auto-save
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (boxes.length === 0 && !localStorage.getItem(`pfc-canvas-${vaultId}-${pageId}`)) return;
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      saveCanvasBoxes(vaultId, pageId, boxes);
    }, 500);
    return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); };
  }, [boxes, vaultId, pageId]);

  // Click on empty canvas to create text box
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only create on direct canvas click, not on text boxes
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.canvasBackground) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const scrollLeft = canvasRef.current?.scrollLeft || 0;
    const scrollTop = canvasRef.current?.scrollTop || 0;

    const x = e.clientX - rect.left + scrollLeft;
    const y = e.clientY - rect.top + scrollTop;

    const id = createBoxId();
    const newBox: CanvasBox = {
      id,
      x: Math.max(0, x - 120), // center the box around click
      y: Math.max(0, y - 20),
      width: 280,
      minHeight: 80,
      header: '',
      body: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setBoxes((prev) => [...prev, newBox]);
    setFocusedBoxId(id);
    setNewBoxIds((prev) => new Set(prev).add(id));

    // Clear "new" status after animation
    setTimeout(() => {
      setNewBoxIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 400);
  }, []);

  const handleUpdateBox = useCallback((id: string, updates: Partial<CanvasBox>) => {
    setBoxes((prev) => prev.map((b) => b.id === id ? { ...b, ...updates } : b));
  }, []);

  const handleDeleteBox = useCallback((id: string) => {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    if (focusedBoxId === id) setFocusedBoxId(null);
  }, [focusedBoxId]);

  const handleFocus = useCallback((id: string) => {
    setFocusedBoxId(id);
  }, []);

  const handleApplyFormat = useCallback((format: string) => {
    onFormatAction?.(format);
    // Apply format to current selection in focused box
    document.execCommand(format, false);
  }, [onFormatAction]);

  // Deselect when clicking empty canvas
  const handleCanvasClickDeselect = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.canvasBackground) {
      // Only deselect if not clicking on a box
    }
  }, []);

  const dotColor = isDark ? 'rgba(79,69,57,0.15)' : 'rgba(180,170,155,0.12)';

  return (
    <div
      ref={canvasRef}
      onClick={handleCanvasClick}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '200vh',
        overflow: 'visible',
        cursor: 'crosshair',
        // Dot grid pattern
        backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      }}
      data-canvas-background="true"
    >
      {/* Click-anywhere hint */}
      {boxes.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease: CUP_EASE }}
          style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
            pointerEvents: 'none',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isDark ? 'rgba(196,149,106,0.08)' : 'rgba(196,149,106,0.06)',
            border: `1px solid ${isDark ? 'rgba(196,149,106,0.15)' : 'rgba(196,149,106,0.12)'}`,
          }}>
            <TypeIcon style={{ width: 20, height: 20, color: isDark ? 'rgba(196,149,106,0.5)' : 'rgba(196,149,106,0.45)' }} />
          </div>
          <span style={{
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: isDark ? 'rgba(156,143,128,0.35)' : 'rgba(0,0,0,0.2)',
            letterSpacing: '-0.01em',
          }}>
            Click anywhere to add a text box
          </span>
        </motion.div>
      )}

      {/* Canvas text boxes */}
      <AnimatePresence>
        {boxes.map((box) => (
          <CanvasTextBox
            key={box.id}
            box={box}
            isDark={isDark}
            isNew={newBoxIds.has(box.id)}
            onUpdate={handleUpdateBox}
            onDelete={handleDeleteBox}
            onFocus={handleFocus}
            focusedId={focusedBoxId}
            onApplyFormat={handleApplyFormat}
          />
        ))}
      </AnimatePresence>
    </div>
  );
});
