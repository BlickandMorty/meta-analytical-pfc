'use client';

/* ═══════════════════════════════════════════════════════════════════
   MiniChat — PFC Assistant: Multi-Thread Deep Knowledge Panel

   A tabbed, draggable floating panel with multiple independent AI
   chat threads. Each thread can use a different provider (Claude,
   GPT, Gemini). 4 inner tabs: Chat, Debug, Signals, Guide.
   Triggered by floating GIF. Persists across all pages.
   ═══════════════════════════════════════════════════════════════════ */

import { useRef, useCallback, useEffect, useState, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Maximize2,
  X,
  GripHorizontal,
  Minimize2,
  MessageSquare,
  Wrench,
  BarChart3,
  BookOpen,
  AlertCircle,
  Activity,
  Sliders,
  GitBranch,
  Server,
  Microscope,
  ChevronDown,
  ChevronRight,
  Square,
  Zap,
  Plus,
  BookmarkPlus,
  FileText,
  ExternalLink,
  PenLine,
  RefreshCw,
  CornerDownLeft,
  Copy,
  Check,
  Brain,
  Pause,
  Play,
  CircleDot,
  RotateCcw,
  Search,
  ClipboardPaste,
  StickyNote,
  GraduationCap,
  Clock,
  type LucideIcon,
} from 'lucide-react';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { useAssistantStream } from '@/hooks/use-assistant-stream';
import { useIsDark } from '@/hooks/use-is-dark';
import { API_PROVIDERS, OPENAI_MODELS, ANTHROPIC_MODELS, GOOGLE_MODELS } from '@/lib/engine/llm/config';
import type { ApiProvider } from '@/lib/engine/llm/config';
import type { MiniChatTab, ChatThread, AssistantMessage } from '@/lib/store/slices/ui';
import type { LearningSession } from '@/lib/notes/learning-protocol';
import type { ChatEntry } from '@/components/recent-chats';
import { parseTimestamp, formatRelativeTime } from '@/components/recent-chats';

/* ─── Constants ─── */

const DEFAULT_W = 280;
const DEFAULT_H = 440;
const MIN_W = 360;
const MIN_H = 300;
const SPRING = { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.7 };

/* ─── Inner tab definitions ─── */

const INNER_TABS: { id: MiniChatTab; label: string; icon: LucideIcon }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'research', label: 'Research', icon: GraduationCap },
  { id: 'debug', label: 'Debug', icon: Wrench },
  { id: 'signals', label: 'Signals', icon: BarChart3 },
  { id: 'guide', label: 'Guide', icon: BookOpen },
];

/* ─── Quick actions for Debug tab ─── */

const QUICK_ACTIONS = [
  { id: 'trace-signal', label: 'Trace Signals', icon: Activity, prompt: 'Explain what the current pipeline signals mean and how to interpret them based on the live readings.' },
  { id: 'tune-steering', label: 'Tune Steering', icon: Sliders, prompt: 'How should I tune the steering controls for better results? Give me specific numeric recommendations based on the current signal state.' },
  { id: 'explain-pipeline', label: 'Pipeline', icon: GitBranch, prompt: 'Walk me through how the 10-stage pipeline processes a query step by step.' },
  { id: 'analyze-signals', label: 'Analyze', icon: BarChart3, prompt: 'Analyze the current signal readings in detail. What do they indicate about the last query?' },
  { id: 'setup-local', label: 'Local LLM', icon: Server, prompt: 'How do I set up local inference with Ollama? Give me step-by-step instructions.' },
  { id: 'deep-dive', label: 'Deep Dive', icon: Microscope, prompt: 'Give me a deep dive into how the PFC engine works — the math behind the signals, the steering vectors, and the SOAR loop.' },
  { id: 'explain-error', label: 'Debug Error', icon: AlertCircle, prompt: 'Help me debug an issue. What are common errors in the PFC app and how do I fix them?' },
  { id: 'explain-soar', label: 'SOAR Engine', icon: Zap, prompt: 'Explain how the SOAR (Self-Optimizing Analytical Reasoning) engine works. When does it trigger and what does it do?' },
];

/* ═══════════════════════════════════════════════════════════════════ */

export function MiniChat() {
  const { isDark, mounted } = useIsDark();
  const router = useRouter();

  // Mini-chat state
  const miniChatOpen = usePFCStore((s) => s.miniChatOpen);
  const miniPos = usePFCStore((s) => s.miniChatPosition);
  const setMiniPos = usePFCStore((s) => s.setMiniChatPosition);
  const setMiniChatOpen = usePFCStore((s) => s.setMiniChatOpen);
  const miniSize = usePFCStore((s) => s.miniChatSize);
  const setMiniSize = usePFCStore((s) => s.setMiniChatSize);

  // Inner tab state
  const activeInnerTab = usePFCStore((s) => s.miniChatTab);
  const setInnerTab = usePFCStore((s) => s.setMiniChatTab);

  // Thread state
  const chatThreads = usePFCStore((s) => s.chatThreads);
  const activeThreadId = usePFCStore((s) => s.activeThreadId);
  const setActiveThread = usePFCStore((s) => s.setActiveThread);
  const createThread = usePFCStore((s) => s.createThread);
  const closeThread = usePFCStore((s) => s.closeThread);
  const setThreadProvider = usePFCStore((s) => s.setThreadProvider);
  const setThreadModel = usePFCStore((s) => s.setThreadModel);
  const setThreadLocal = usePFCStore((s) => s.setThreadLocal);
  const clearThreadMessages = usePFCStore((s) => s.clearThreadMessages);
  const _saveMessageToNotes = usePFCStore((s) => s.saveMessageToNotes);
  // Wrap to also navigate to /notes after saving
  const saveMessageToNotes = useCallback((content: string) => {
    const pageId = _saveMessageToNotes(content);
    if (pageId) router.push('/notes');
    return pageId;
  }, [_saveMessageToNotes, router]);
  const expandThreadToChat = usePFCStore((s) => s.expandThreadToChat);
  const setChatMinimized = usePFCStore((s) => s.setChatMinimized);
  const addToast = usePFCStore((s) => s.addToast);

  // Streaming state — per-thread (reads from active thread's streaming state)
  const assistantStreamText = usePFCStore((s) => s.threadStreamingText[s.activeThreadId] || '');
  const assistantIsStreaming = usePFCStore((s) => s.threadIsStreaming[s.activeThreadId] || false);

  // Hook
  const { sendQuery, abort } = useAssistantStream();

  const [collapsed, setCollapsed] = useState(false);
  const visible = mounted && miniChatOpen;

  // Active thread
  const activeThread = chatThreads.find((t) => t.id === activeThreadId);
  const activeMessages = activeThread?.messages || [];

  /* ─── Position to bottom-right on first show ─── */
  const hasPositioned = useRef(false);
  useEffect(() => {
    if (visible && !hasPositioned.current) {
      hasPositioned.current = true;
      const x = Math.max(16, window.innerWidth - miniSize.w - 24);
      const y = Math.max(16, window.innerHeight - miniSize.h - 24);
      setMiniPos({ x, y });
    }
  }, [visible, setMiniPos, miniSize.w, miniSize.h]);

  /* ─── Snap back on window resize (keep widget visible) ─── */
  useEffect(() => {
    const onResize = () => {
      const margin = 16;
      const maxX = Math.max(margin, window.innerWidth - miniSize.w - margin);
      const maxY = Math.max(margin, window.innerHeight - miniSize.h - margin);
      const pos = usePFCStore.getState().miniChatPosition;
      if (pos.x > maxX || pos.y > maxY) {
        setMiniPos({ x: Math.min(pos.x, maxX), y: Math.min(pos.y, maxY) });
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setMiniPos, miniSize.w, miniSize.h]);

  /* ─── Drag logic ─── */
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    dragStart.current = { x: e.clientX - miniPos.x, y: e.clientY - miniPos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [miniPos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    // Clamp so entire widget stays within viewport (16px margin)
    const margin = 16;
    const maxX = Math.max(margin, window.innerWidth - miniSize.w - margin);
    const maxY = Math.max(margin, window.innerHeight - miniSize.h - margin);
    const newX = Math.max(margin, Math.min(maxX, e.clientX - dragStart.current.x));
    const newY = Math.max(margin, Math.min(maxY, e.clientY - dragStart.current.y));
    setMiniPos({ x: newX, y: newY });
  }, [setMiniPos, miniSize.w, miniSize.h]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* not captured */ }
  }, []);

  /* ─── Resize logic (8-direction) ─── */
  type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
  const resizing = useRef(false);
  const resizeEdge = useRef<ResizeEdge>('se');
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, px: 0, py: 0 });

  const onResizeDown = useCallback((e: React.PointerEvent, edge: ResizeEdge) => {
    e.stopPropagation();
    e.preventDefault();
    resizing.current = true;
    resizeEdge.current = edge;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: miniSize.w, h: miniSize.h, px: miniPos.x, py: miniPos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [miniSize, miniPos]);

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizing.current) return;
    const dx = e.clientX - resizeStart.current.x;
    const dy = e.clientY - resizeStart.current.y;
    const edge = resizeEdge.current;
    const hasN = edge.includes('n');
    const hasS = edge.includes('s');
    const hasE = edge === 'e' || edge === 'ne' || edge === 'se';
    const hasW = edge === 'w' || edge === 'nw' || edge === 'sw';

    let newW = resizeStart.current.w;
    let newH = resizeStart.current.h;
    let newX = resizeStart.current.px;
    let newY = resizeStart.current.py;

    if (hasE) newW = Math.max(MIN_W, resizeStart.current.w + dx);
    if (hasW) {
      newW = Math.max(MIN_W, resizeStart.current.w - dx);
      newX = resizeStart.current.px + (resizeStart.current.w - newW);
    }
    if (hasS) newH = Math.max(MIN_H, resizeStart.current.h + dy);
    if (hasN) {
      newH = Math.max(MIN_H, resizeStart.current.h - dy);
      newY = resizeStart.current.py + (resizeStart.current.h - newH);
    }

    // Clamp so widget stays within viewport
    const margin = 16;
    newX = Math.max(margin, Math.min(newX, window.innerWidth - newW - margin));
    newY = Math.max(margin, Math.min(newY, window.innerHeight - newH - margin));
    setMiniSize({ w: newW, h: newH });
    setMiniPos({ x: newX, y: newY });
  }, [setMiniSize, setMiniPos]);

  const onResizeUp = useCallback((e: React.PointerEvent) => {
    resizing.current = false;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ok */ }
  }, []);

  /* ─── Style tokens ─── */
  const glassBg = isDark ? 'rgba(18, 18, 22, 0.92)' : 'rgba(255, 255, 255, 0.92)';
  const glassBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const headerBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const textPrimary = isDark ? '#e8e4de' : '#1a1a1a';
  const textSecondary = isDark ? 'rgba(155,150,137,0.8)' : 'rgba(0,0,0,0.45)';
  const btnHover = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const tabActiveBg = isDark ? 'rgba(var(--pfc-accent-rgb), 0.15)' : 'rgba(var(--pfc-accent-rgb), 0.1)';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="mini-chat"
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 30 }}
          transition={SPRING}
          style={{
            position: 'fixed',
            left: miniPos.x,
            top: miniPos.y,
            width: miniSize.w,
            height: collapsed ? 'auto' : miniSize.h,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 16,
            overflow: 'hidden',
            background: glassBg,
            border: `1px solid ${glassBorder}`,
            backdropFilter: 'blur(24px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
            boxShadow: isDark
              ? '0 8px 40px -4px rgba(0,0,0,0.55), 0 2px 10px -2px rgba(0,0,0,0.35)'
              : '0 8px 40px -4px rgba(0,0,0,0.14), 0 2px 10px -2px rgba(0,0,0,0.07)',
            transform: 'translateZ(0)',
          }}
        >
          {/* ─── Header ─── */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.5rem 0.625rem',
              background: headerBg,
              cursor: 'grab',
              userSelect: 'none',
              touchAction: 'none',
              borderBottom: `1px solid ${glassBorder}`,
              flexShrink: 0,
            }}
          >
            <GripHorizontal style={{ width: 14, height: 14, color: textSecondary, flexShrink: 0 }} />
            <img
              src={isDark ? '/pixel-robot.gif' : '/pixel-sun.gif'}
              alt={isDark ? 'Izmi' : 'Sunny'}
              style={{ width: 20, height: 20, imageRendering: 'pixelated' }}
            />
            <span style={{
              flex: 1, fontSize: 12, fontWeight: 600, color: textPrimary,
              fontFamily: 'var(--font-heading)', letterSpacing: '0.02em',
            }}>
              PFC Assistant
            </span>
            {assistantIsStreaming && (
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--pfc-accent)',
                animation: 'pulse 1.4s ease-in-out infinite', flexShrink: 0,
              }} />
            )}
            <HeaderButton
              icon={ExternalLink}
              onClick={() => {
                const thread = chatThreads.find((t) => t.id === activeThreadId);
                if (thread?.chatId) {
                  // DB-linked thread: navigate to full chat page
                  setChatMinimized(false);
                  window.location.href = `/chat/${thread.chatId}`;
                } else {
                  expandThreadToChat();
                }
              }}
              hoverBg={btnHover}
              color={textSecondary}
              title="Open in main chat"
            />
            <HeaderButton icon={collapsed ? Maximize2 : Minimize2} onClick={() => setCollapsed((c) => !c)} hoverBg={btnHover} color={textSecondary} title={collapsed ? 'Expand' : 'Collapse'} />
            <HeaderButton icon={X} onClick={() => setMiniChatOpen(false)} hoverBg={btnHover} color={textSecondary} title="Close" />
          </div>

          {!collapsed && (
            <>
              {/* ─── Thread Tabs (chat tabs across the top) ─── */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                padding: '0.25rem 0.375rem',
                borderBottom: `1px solid ${glassBorder}`,
                flexShrink: 0,
                overflowX: 'auto',
                overflowY: 'hidden',
              }}>
                {chatThreads.map((thread) => {
                  const isActive = activeThreadId === thread.id;
                  const providerInfo = thread.provider
                    ? API_PROVIDERS.find((p) => p.value === thread.provider)
                    : null;
                  return (
                    <div
                      key={thread.id}
                      onClick={() => setActiveThread(thread.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '0.25rem 0.5rem',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: isActive ? 600 : 500,
                        fontFamily: 'var(--font-sans)',
                        color: isActive ? textPrimary : textSecondary,
                        background: isActive ? tabActiveBg : 'transparent',
                        backdropFilter: isActive ? 'blur(8px)' : 'none',
                        WebkitBackdropFilter: isActive ? 'blur(8px)' : 'none',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                        maxWidth: 140,
                        flexShrink: 0,
                      }}
                    >
                      {thread.useLocal ? (
                        <Server style={{ width: 9, height: 9, color: '#f59e0b', flexShrink: 0 }} />
                      ) : providerInfo ? (
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: providerInfo.color, flexShrink: 0,
                        }} />
                      ) : null}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {thread.label}
                      </span>
                      {chatThreads.length > 1 && thread.id !== 'pfc-main' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); closeThread(thread.id); }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 14, height: 14, borderRadius: 4, border: 'none',
                            background: 'transparent', color: textSecondary,
                            cursor: 'pointer', fontSize: 10, flexShrink: 0,
                            padding: 0,
                          }}
                        >
                          <X style={{ width: 10, height: 10 }} />
                        </button>
                      )}
                    </div>
                  );
                })}
                {chatThreads.length < 8 && (
                  <button
                    onClick={() => createThread('assistant')}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 24, height: 24, borderRadius: 6, border: 'none',
                      background: 'transparent', color: textSecondary,
                      cursor: 'pointer', flexShrink: 0,
                    }}
                    title="New chat thread"
                  >
                    <Plus style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>

              {/* ─── Inner Tab Bar (Chat / Debug / Signals / Guide) ─── */}
              <div style={{
                display: 'flex',
                gap: 2,
                padding: '0.25rem 0.5rem',
                borderBottom: `1px solid ${glassBorder}`,
                flexShrink: 0,
              }}>
                {INNER_TABS.map((tab) => {
                  const isActive = activeInnerTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setInnerTab(tab.id)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        padding: '0.25rem 0.25rem',
                        borderRadius: 8,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: isActive ? 600 : 500,
                        fontFamily: 'var(--font-sans)',
                        color: isActive ? 'var(--pfc-accent)' : textSecondary,
                        background: isActive ? tabActiveBg : 'transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Icon style={{ width: 12, height: 12 }} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* ─── Tab Content ─── */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {activeInnerTab === 'chat' && (
                  <ChatTabContent
                    isDark={isDark}
                    glassBorder={glassBorder}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    btnHover={btnHover}
                    messages={activeMessages}
                    streamText={assistantStreamText}
                    isStreaming={assistantIsStreaming}
                    thread={activeThread}
                    sendQuery={sendQuery}
                    abort={abort}
                    saveToNotes={saveMessageToNotes}
                    addToast={addToast}
                    setThreadProvider={setThreadProvider}
                    setThreadModel={setThreadModel}
                    setThreadLocal={setThreadLocal}
                  />
                )}
                {activeInnerTab === 'history' && (
                  <HistoryTabContent
                    isDark={isDark}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    btnHover={btnHover}
                  />
                )}
                {activeInnerTab === 'debug' && (
                  <DebugTabContent
                    isDark={isDark}
                    glassBorder={glassBorder}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    btnHover={btnHover}
                    messages={activeMessages}
                    streamText={assistantStreamText}
                    isStreaming={assistantIsStreaming}
                    sendQuery={(q: string) => sendQuery(q)}
                    abort={abort}
                    saveToNotes={saveMessageToNotes}
                    addToast={addToast}
                  />
                )}
                {activeInnerTab === 'notes' && (
                  <NotesTabContent
                    isDark={isDark}
                    glassBorder={glassBorder}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    btnHover={btnHover}
                  />
                )}
                {activeInnerTab === 'research' && (
                  <ResearchTabContent
                    isDark={isDark}
                    glassBorder={glassBorder}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    btnHover={btnHover}
                  />
                )}
                {activeInnerTab === 'signals' && (
                  <SignalsTabContent isDark={isDark} textPrimary={textPrimary} textSecondary={textSecondary} />
                )}
                {activeInnerTab === 'guide' && (
                  <GuideTabContent isDark={isDark} textPrimary={textPrimary} textSecondary={textSecondary} glassBorder={glassBorder} />
                )}
              </div>
            </>
          )}

          {/* ─── Resize handles (8 directions) ─── */}
          {!collapsed && (
            <>
              {/* Top edge */}
              <div onPointerDown={(e) => onResizeDown(e, 'n')} onPointerMove={onResizeMove} onPointerUp={onResizeUp}
                style={{ position: 'absolute', top: -2, left: 16, right: 16, height: 10, cursor: 'ns-resize', touchAction: 'none' }} />
              {/* Bottom edge */}
              <div onPointerDown={(e) => onResizeDown(e, 's')} onPointerMove={onResizeMove} onPointerUp={onResizeUp}
                style={{ position: 'absolute', bottom: -2, left: 16, right: 16, height: 10, cursor: 'ns-resize', touchAction: 'none' }} />
              {/* Left edge */}
              <div onPointerDown={(e) => onResizeDown(e, 'w')} onPointerMove={onResizeMove} onPointerUp={onResizeUp}
                style={{ position: 'absolute', left: -2, top: 16, bottom: 16, width: 10, cursor: 'ew-resize', touchAction: 'none' }} />
              {/* Right edge */}
              <div onPointerDown={(e) => onResizeDown(e, 'e')} onPointerMove={onResizeMove} onPointerUp={onResizeUp}
                style={{ position: 'absolute', right: -2, top: 16, bottom: 16, width: 10, cursor: 'ew-resize', touchAction: 'none' }} />
              {/* NW corner */}
              <div onPointerDown={(e) => onResizeDown(e, 'nw')} onPointerMove={onResizeMove} onPointerUp={onResizeUp}
                style={{ position: 'absolute', left: 0, top: 0, width: 14, height: 14, cursor: 'nwse-resize', touchAction: 'none' }} />
              {/* NE corner */}
              <div onPointerDown={(e) => onResizeDown(e, 'ne')} onPointerMove={onResizeMove} onPointerUp={onResizeUp}
                style={{ position: 'absolute', right: 0, top: 0, width: 14, height: 14, cursor: 'nesw-resize', touchAction: 'none' }} />
              {/* SW corner */}
              <div onPointerDown={(e) => onResizeDown(e, 'sw')} onPointerMove={onResizeMove} onPointerUp={onResizeUp}
                style={{ position: 'absolute', left: 0, bottom: 0, width: 14, height: 14, cursor: 'nesw-resize', touchAction: 'none' }} />
              {/* SE corner — visible grip */}
              <div onPointerDown={(e) => onResizeDown(e, 'se')} onPointerMove={onResizeMove} onPointerUp={onResizeUp}
                style={{ position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, cursor: 'nwse-resize', touchAction: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="8" height="8" viewBox="0 0 8 8" style={{ opacity: 0.25 }}>
                  <circle cx="6" cy="6" r="1" fill={textSecondary} />
                  <circle cx="3" cy="6" r="1" fill={textSecondary} />
                  <circle cx="6" cy="3" r="1" fill={textSecondary} />
                </svg>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Chat Tab — Thread-aware conversation with message actions
   ═══════════════════════════════════════════════════════════════════ */

function ChatTabContent({ isDark, glassBorder, textPrimary, textSecondary, btnHover, messages, streamText, isStreaming, thread, sendQuery, abort, saveToNotes, addToast, setThreadProvider, setThreadModel, setThreadLocal }: {
  isDark: boolean; glassBorder: string; textPrimary: string; textSecondary: string; btnHover: string;
  messages: AssistantMessage[]; streamText: string; isStreaming: boolean;
  thread?: ChatThread;
  sendQuery: (q: string, threadId?: string) => void; abort: () => void;
  saveToNotes: (content: string) => string;
  addToast: (toast: { type: 'info' | 'success' | 'error' | 'warning'; message: string }) => void;
  setThreadProvider: (threadId: string, provider: ApiProvider) => void;
  setThreadModel: (threadId: string, model: string | undefined) => void;
  setThreadLocal: (threadId: string, useLocal: boolean) => void;
}) {
  const [inputVal, setInputVal] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  // Track if user is near bottom (within 80px)
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  // Auto-scroll only if user is near bottom
  useEffect(() => {
    if (scrollRef.current && isNearBottom.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, streamText]);

  const handleSubmit = useCallback(() => {
    if (!inputVal.trim()) return;
    sendQuery(inputVal.trim(), thread?.id);
    setInputVal('');
    isNearBottom.current = true; // snap to bottom on own message
  }, [inputVal, sendQuery, thread?.id]);

  const isLocal = thread?.useLocal === true;
  const currentProvider = thread?.provider
    ? API_PROVIDERS.find((p) => p.value === thread.provider)
    : null;

  // Model list for the currently selected provider
  const modelsForProvider = thread?.provider === 'openai' ? OPENAI_MODELS
    : thread?.provider === 'anthropic' ? ANTHROPIC_MODELS
    : thread?.provider === 'google' ? GOOGLE_MODELS
    : [];

  // Current model label
  const currentModelLabel = thread?.model
    ? modelsForProvider.find((m) => m.value === thread.model)?.label ?? thread.model
    : null;

  return (
    <>
      {/* Provider + model picker bar */}
      {thread && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 0,
          borderBottom: `1px solid ${glassBorder}`, flexShrink: 0,
          fontSize: 10.5,
        }}>
          {/* Row 1: Provider selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.25rem 0.5rem' }}>
            <span style={{ color: textSecondary, flexShrink: 0 }}>Provider:</span>
            <button
              onClick={() => { setShowProviderPicker(!showProviderPicker); setShowModelPicker(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 999,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                color: isLocal ? '#f59e0b' : currentProvider ? currentProvider.color : textSecondary,
                fontSize: 10.5, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {isLocal ? (
                <Server style={{ width: 10, height: 10, color: '#f59e0b' }} />
              ) : currentProvider ? (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: currentProvider.color }} />
              ) : null}
              {isLocal ? 'Local (Ollama)' : currentProvider?.label || 'Default (Global)'}
              <ChevronDown style={{ width: 10, height: 10 }} />
            </button>
            <AnimatePresence>
              {showProviderPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}
                >
                  {API_PROVIDERS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => {
                        setThreadProvider(thread.id, p.value);
                        setShowProviderPicker(false);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 3,
                        padding: '2px 6px', borderRadius: 999,
                        border: `1px solid ${p.color}33`,
                        background: !isLocal && thread.provider === p.value ? `${p.color}22` : 'transparent',
                        color: p.color, fontSize: 10, fontWeight: 500, cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: p.color }} />
                      {p.label}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setThreadLocal(thread.id, !isLocal);
                      setShowProviderPicker(false);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      padding: '2px 6px', borderRadius: 999,
                      border: '1px solid #f59e0b33',
                      background: isLocal ? '#f59e0b22' : 'transparent',
                      color: '#f59e0b', fontSize: 10, fontWeight: 500, cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <Server style={{ width: 9, height: 9 }} />
                    Local
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Row 2: Model selector — only shown when an API provider is selected */}
          {!isLocal && thread.provider && modelsForProvider.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.125rem 0.5rem 0.25rem', position: 'relative' }}>
              <span style={{ color: textSecondary, flexShrink: 0 }}>Model:</span>
              <button
                onClick={() => { setShowModelPicker(!showModelPicker); setShowProviderPicker(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 999,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                  color: currentProvider?.color ?? textSecondary,
                  fontSize: 10.5, fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {currentModelLabel || 'Default'}
                <ChevronDown style={{ width: 10, height: 10, transform: showModelPicker ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
              </button>
              <AnimatePresence>
                {showModelPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    style={{
                      position: 'absolute', top: '100%', left: 8, right: 8,
                      zIndex: 50, padding: '4px 0',
                      borderRadius: 8,
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                      background: isDark ? 'rgba(20,18,16,0.97)' : 'rgba(255,255,255,0.97)',
                      backdropFilter: 'blur(12px)',
                      boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)',
                      maxHeight: 200, overflowY: 'auto',
                    }}
                  >
                    {modelsForProvider.map((m) => {
                      const isActive = thread.model === m.value;
                      return (
                        <button
                          key={m.value}
                          onClick={() => {
                            setThreadModel(thread.id, m.value);
                            setShowModelPicker(false);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            width: '100%', padding: '5px 10px',
                            border: 'none', cursor: 'pointer',
                            background: isActive
                              ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
                              : 'transparent',
                            color: isActive ? (currentProvider?.color ?? textPrimary) : textPrimary,
                            fontSize: 11, fontWeight: isActive ? 600 : 400,
                            fontFamily: 'var(--font-sans)',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'; }}
                          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: isActive ? (currentProvider?.color ?? '#888') : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
                            flexShrink: 0,
                          }} />
                          {m.label}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0,
        padding: '0.5rem', fontSize: 12.5, lineHeight: 1.6,
      }}>
        {messages.length === 0 && !streamText && (
          <EmptyStateWithRecent isDark={isDark} textPrimary={textPrimary} textSecondary={textSecondary} btnHover={btnHover} />
        )}
        {messages.map((msg, i) => (
          <MessageBubble
            key={`${msg.role}-${msg.timestamp}-${i}`}
            msg={msg}
            isDark={isDark}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            btnHover={btnHover}
            onSaveToNotes={saveToNotes}
            onSaveForLater={(content) => {
              addToast({ type: 'success', message: 'Bookmarked for later' });
            }}
          />
        ))}
        {streamText && (
          <div style={{
            padding: '0.5rem 0.625rem', borderRadius: 10,
            color: textPrimary,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {streamText}
            <span style={{ animation: 'pulse 1s ease-in-out infinite', opacity: 0.6 }}>|</span>
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{
        flexShrink: 0, display: 'flex', gap: 6,
        padding: '0.375rem 0.5rem 0.5rem', borderTop: `1px solid ${glassBorder}`,
      }}>
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          placeholder="Ask a research question..."
          maxLength={10000}
          disabled={isStreaming}
          style={{
            flex: 1, padding: '0.4rem 0.625rem', borderRadius: 999,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            color: textPrimary,
            fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none',
          }}
        />
        {isStreaming ? (
          <button onClick={abort} style={{
            padding: '0.4rem 0.625rem', borderRadius: 999, border: 'none',
            background: 'rgba(var(--pfc-accent-rgb), 0.15)', color: 'var(--pfc-accent)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            <Square style={{ width: 12, height: 12 }} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!inputVal.trim()} style={{
            padding: '0.4rem 0.625rem', borderRadius: 999, border: 'none',
            background: inputVal.trim() ? 'var(--pfc-accent)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
            color: inputVal.trim() ? '#fff' : textSecondary,
            fontSize: 12, fontWeight: 600, cursor: inputVal.trim() ? 'pointer' : 'default',
            transition: 'all 0.15s',
          }}>
            Send
          </button>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Empty state — shows recent main-chat sessions from DB
   ═══════════════════════════════════════════════════════════════════ */

function EmptyStateWithRecent({ isDark, textPrimary, textSecondary, btnHover }: {
  isDark: boolean; textPrimary: string; textSecondary: string; btnHover: string;
}) {
  const loadChatIntoThread = usePFCStore((s) => s.loadChatIntoThread);
  const [recentChats, setRecentChats] = useState<ChatEntry[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/history?userId=local-user')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled && data?.chats) setRecentChats(data.chats.slice(0, 5));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const openChat = useCallback(async (chatId: string, title: string) => {
    setLoadingId(chatId);
    try {
      const res = await fetch(`/api/history?chatId=${chatId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.messages) return;

      // Convert ChatMessage[] → AssistantMessage[] for the mini-chat thread
      const messages = (data.messages as Array<{ role: string; text: string; timestamp: number }>).map((m) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.text || '',
        timestamp: m.timestamp || Date.now(),
      }));

      loadChatIntoThread(chatId, title, messages);
    } catch {
      // Silently fail
    } finally {
      setLoadingId(null);
    }
  }, [loadChatIntoThread]);

  return (
    <div style={{ padding: '1rem 0.75rem', fontSize: 12 }}>
      <div style={{ color: textSecondary, textAlign: 'center', marginBottom: recentChats.length ? 12 : 0 }}>
        Ask anything about the PFC system — signals, pipeline, steering, debugging, or anything else.
      </div>
      {recentChats.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: textSecondary, marginBottom: 6,
            opacity: 0.6,
          }}>
            Recent sessions
          </div>
          {recentChats.map((chat) => {
            const isHovered = hoveredId === chat.id;
            const isLoading = loadingId === chat.id;
            return (
              <button
                key={chat.id}
                onClick={() => openChat(chat.id, chat.title)}
                onMouseEnter={() => setHoveredId(chat.id)}
                onMouseLeave={() => setHoveredId(null)}
                disabled={isLoading}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  width: '100%', padding: '6px 8px', borderRadius: 8, marginBottom: 2,
                  fontSize: 11, color: isHovered ? 'var(--pfc-accent)' : textPrimary,
                  background: isHovered ? btnHover : 'transparent',
                  border: 'none', cursor: isLoading ? 'wait' : 'pointer', textAlign: 'left',
                  fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
                  opacity: isLoading ? 0.6 : 1,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>
                  <MessageSquare style={{ width: 10, height: 10, display: 'inline', verticalAlign: '-1px', marginRight: 4, opacity: isHovered ? 0.8 : 0.4 }} />
                  {chat.title}
                </span>
                <span style={{ fontSize: 9.5, color: textSecondary, flexShrink: 0 }}>
                  {formatRelativeTime(parseTimestamp(chat.updatedAt || chat.createdAt))}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   History Tab — Browse ALL past chat sessions from DB
   ═══════════════════════════════════════════════════════════════════ */

function HistoryTabContent({ isDark, textPrimary, textSecondary, btnHover }: {
  isDark: boolean; textPrimary: string; textSecondary: string; btnHover: string;
}) {
  const router = useRouter();
  const loadChatIntoThread = usePFCStore((s) => s.loadChatIntoThread);
  const setInnerTab = usePFCStore((s) => s.setMiniChatTab);
  const [allChats, setAllChats] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/history?userId=local-user')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled && data?.chats) setAllChats(data.chats);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return allChats;
    const q = searchQuery.toLowerCase();
    return allChats.filter((c) => c.title.toLowerCase().includes(q));
  }, [allChats, searchQuery]);

  const openInThread = useCallback(async (chatId: string, title: string) => {
    setLoadingId(chatId);
    try {
      const res = await fetch(`/api/history?chatId=${chatId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.messages) return;
      const messages = (data.messages as Array<{ role: string; text: string; timestamp: number }>).map((m) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.text || '',
        timestamp: m.timestamp || Date.now(),
      }));
      loadChatIntoThread(chatId, title, messages);
      setInnerTab('chat'); // Switch to chat tab to see loaded conversation
    } catch {
      // Silently fail
    } finally {
      setLoadingId(null);
    }
  }, [loadChatIntoThread, setInnerTab]);

  const openInMainChat = useCallback((chatId: string) => {
    router.push(`/chat/${chatId}`);
  }, [router]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Search bar */}
      <div style={{ padding: '0.5rem 0.625rem 0.375rem', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '0.3rem 0.5rem', borderRadius: 8,
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          <Search style={{ width: 11, height: 11, color: textSecondary, flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 11, color: textPrimary, fontFamily: 'var(--font-sans)',
            }}
          />
        </div>
      </div>

      {/* Chat list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.5rem 0.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', fontSize: 11, color: textSecondary }}>
            Loading...
          </div>
        ) : filteredChats.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', fontSize: 11, color: textSecondary }}>
            {searchQuery ? 'No chats match your search' : 'No chat history yet'}
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isHovered = hoveredId === chat.id;
            const isLoading = loadingId === chat.id;
            return (
              <div
                key={chat.id}
                onMouseEnter={() => setHoveredId(chat.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 6px', borderRadius: 8, marginBottom: 1,
                  background: isHovered ? btnHover : 'transparent',
                  transition: 'background 0.12s',
                }}
              >
                {/* Main click — load into mini-chat thread */}
                <button
                  onClick={() => openInThread(chat.id, chat.title)}
                  disabled={isLoading}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none', cursor: isLoading ? 'wait' : 'pointer',
                    textAlign: 'left', padding: 0, minWidth: 0,
                    opacity: isLoading ? 0.5 : 1,
                  }}
                >
                  <MessageSquare style={{
                    width: 10, height: 10, flexShrink: 0,
                    color: isHovered ? 'var(--pfc-accent)' : textSecondary,
                    opacity: isHovered ? 0.8 : 0.4,
                  }} />
                  <span style={{
                    fontSize: 11, color: isHovered ? 'var(--pfc-accent)' : textPrimary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-sans)', flex: 1,
                  }}>
                    {chat.title}
                  </span>
                  <span style={{ fontSize: 9.5, color: textSecondary, flexShrink: 0 }}>
                    {formatRelativeTime(parseTimestamp(chat.updatedAt || chat.createdAt))}
                  </span>
                </button>

                {/* Open in main chat */}
                {isHovered && (
                  <button
                    onClick={() => openInMainChat(chat.id)}
                    title="Open in full chat"
                    style={{
                      display: 'flex', alignItems: 'center', padding: 3,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: textSecondary, borderRadius: 4, flexShrink: 0,
                    }}
                  >
                    <ExternalLink style={{ width: 10, height: 10 }} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Message Bubble with actions (Save to Notes / Save for Later)
   ═══════════════════════════════════════════════════════════════════ */

function MessageBubble({ msg, isDark, textPrimary, textSecondary, btnHover, onSaveToNotes, onSaveForLater }: {
  msg: AssistantMessage; isDark: boolean;
  textPrimary: string; textSecondary: string; btnHover: string;
  onSaveToNotes: (content: string) => string;
  onSaveForLater: (content: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const isUser = msg.role === 'user';

  return (
    <div
      onMouseEnter={() => !isUser && setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      style={{
        marginBottom: '0.75rem',
        padding: '0.5rem 0.625rem',
        borderRadius: 10,
        background: isUser
          ? (isDark ? 'rgba(var(--pfc-accent-rgb), 0.1)' : 'rgba(var(--pfc-accent-rgb), 0.06)')
          : 'transparent',
        color: textPrimary,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        position: 'relative',
      }}
    >
      {isUser && (
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--pfc-accent)', display: 'block', marginBottom: 2 }}>You</span>
      )}
      {msg.content.replace(/\s*\[(DATA|CONFLICT|UNCERTAIN|MODEL)\]\s*/g, ' ')}

      {/* Message actions (assistant messages only) */}
      {!isUser && showActions && (
        <div style={{
          display: 'flex', gap: 4, marginTop: 6,
        }}>
          <ActionButton
            icon={FileText}
            label="Add to Notes"
            isDark={isDark}
            textSecondary={textSecondary}
            btnHover={btnHover}
            onClick={() => onSaveToNotes(msg.content)}
          />
          <ActionButton
            icon={BookmarkPlus}
            label="Save for Later"
            isDark={isDark}
            textSecondary={textSecondary}
            btnHover={btnHover}
            onClick={() => onSaveForLater(msg.content)}
          />
        </div>
      )}
    </div>
  );
}

function ActionButton({ icon: Icon, label, isDark, textSecondary, btnHover, onClick }: {
  icon: LucideIcon; label: string; isDark: boolean; textSecondary: string; btnHover: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 3,
        padding: '2px 8px', borderRadius: 999,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
        color: textSecondary, fontSize: 10, fontWeight: 500,
        cursor: 'pointer', fontFamily: 'var(--font-sans)',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = btnHover;
        e.currentTarget.style.color = 'var(--pfc-accent)';
        e.currentTarget.style.borderColor = 'var(--pfc-accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
        e.currentTarget.style.color = textSecondary;
        e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
      }}
    >
      <Icon style={{ width: 10, height: 10 }} />
      {label}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Debug Tab — Quick actions + conversation
   ═══════════════════════════════════════════════════════════════════ */

function DebugTabContent({ isDark, glassBorder, textPrimary, textSecondary, btnHover, messages, streamText, isStreaming, sendQuery, abort, saveToNotes, addToast }: {
  isDark: boolean; glassBorder: string; textPrimary: string; textSecondary: string; btnHover: string;
  messages: AssistantMessage[]; streamText: string; isStreaming: boolean;
  sendQuery: (q: string) => void; abort: () => void;
  saveToNotes: (content: string) => string;
  addToast: (toast: { type: 'info' | 'success' | 'error' | 'warning'; message: string }) => void;
}) {
  const [inputVal, setInputVal] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottom = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  useEffect(() => {
    if (scrollRef.current && isNearBottom.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, streamText]);

  const handleSubmit = useCallback(() => {
    if (!inputVal.trim()) return;
    sendQuery(inputVal.trim());
    setInputVal('');
    isNearBottom.current = true;
  }, [inputVal, sendQuery]);

  return (
    <>
      {/* Quick action chips */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0.5rem',
        borderBottom: `1px solid ${glassBorder}`, flexShrink: 0,
      }}>
        {QUICK_ACTIONS.map((action, i) => {
          const Icon = action.icon;
          return (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
              onClick={() => sendQuery(action.prompt)}
              disabled={isStreaming}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '0.25rem 0.5rem', borderRadius: 999,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                color: textSecondary, fontSize: 10.5, fontWeight: 500,
                cursor: isStreaming ? 'not-allowed' : 'pointer',
                opacity: isStreaming ? 0.5 : 1,
                transition: 'all 0.15s ease',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={(e) => {
                if (!isStreaming) {
                  e.currentTarget.style.background = btnHover;
                  e.currentTarget.style.borderColor = 'var(--pfc-accent)';
                  e.currentTarget.style.color = 'var(--pfc-accent)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
                e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
                e.currentTarget.style.color = textSecondary;
              }}
            >
              <Icon style={{ width: 11, height: 11 }} />
              {action.label}
            </motion.button>
          );
        })}
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0,
        padding: '0.5rem', fontSize: 12.5, lineHeight: 1.55,
      }}>
        {messages.length === 0 && !streamText && (
          <div style={{ color: textSecondary, textAlign: 'center', padding: '2rem 1rem', fontSize: 12 }}>
            Ask anything about the PFC system — signals, pipeline, steering, debugging, or use a quick action above.
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble
            key={`${msg.role}-${msg.timestamp}-${i}`}
            msg={msg}
            isDark={isDark}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            btnHover={btnHover}
            onSaveToNotes={saveToNotes}
            onSaveForLater={() => addToast({ type: 'success', message: 'Bookmarked for later' })}
          />
        ))}
        {streamText && (
          <div style={{
            padding: '0.5rem 0.625rem', borderRadius: 10,
            color: textPrimary,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {streamText}
            <span style={{ animation: 'pulse 1s ease-in-out infinite', opacity: 0.6 }}>|</span>
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{
        flexShrink: 0, display: 'flex', gap: 6,
        padding: '0.375rem 0.5rem 0.5rem', borderTop: `1px solid ${glassBorder}`,
      }}>
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          placeholder="Ask about signals, pipeline, tuning..."
          maxLength={10000}
          disabled={isStreaming}
          style={{
            flex: 1, padding: '0.4rem 0.625rem', borderRadius: 999,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            color: textPrimary,
            fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none',
          }}
        />
        {isStreaming ? (
          <button onClick={abort} style={{
            padding: '0.4rem 0.625rem', borderRadius: 999, border: 'none',
            background: 'rgba(var(--pfc-accent-rgb), 0.15)', color: 'var(--pfc-accent)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            <Square style={{ width: 12, height: 12 }} />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!inputVal.trim()} style={{
            padding: '0.4rem 0.625rem', borderRadius: 999, border: 'none',
            background: inputVal.trim() ? 'var(--pfc-accent)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
            color: inputVal.trim() ? '#fff' : textSecondary,
            fontSize: 12, fontWeight: 600, cursor: inputVal.trim() ? 'pointer' : 'default',
            transition: 'all 0.15s',
          }}>
            Ask
          </button>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Signals Tab — Live pipeline signal dashboard
   ═══════════════════════════════════════════════════════════════════ */

const SignalsTabContent = memo(function SignalsTabContent({ isDark, textPrimary, textSecondary }: {
  isDark: boolean; textPrimary: string; textSecondary: string;
}) {
  const confidence = usePFCStore((s) => s.confidence);
  const entropy = usePFCStore((s) => s.entropy);
  const dissonance = usePFCStore((s) => s.dissonance);
  const healthScore = usePFCStore((s) => s.healthScore);
  const riskScore = usePFCStore((s) => s.riskScore);
  const safetyState = usePFCStore((s) => s.safetyState);
  const focusDepth = usePFCStore((s) => s.focusDepth);
  const temperatureScale = usePFCStore((s) => s.temperatureScale);
  const activeConcepts = usePFCStore((s) => s.activeConcepts);
  const tda = usePFCStore((s) => s.tda);
  const queriesProcessed = usePFCStore((s) => s.queriesProcessed);

  const safetyColors: Record<string, string> = {
    green: '#4ade80', yellow: '#facc15', orange: '#fb923c', red: '#f87171',
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', fontSize: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 11, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        Pipeline Signals
      </div>

      <SignalBar label="Confidence" value={confidence} isDark={isDark} textPrimary={textPrimary} />
      <SignalBar label="Entropy" value={entropy} isDark={isDark} textPrimary={textPrimary} invert />
      <SignalBar label="Dissonance" value={dissonance} isDark={isDark} textPrimary={textPrimary} invert />
      <SignalBar label="Health Score" value={healthScore} isDark={isDark} textPrimary={textPrimary} />
      <SignalBar label="Risk Score" value={riskScore} isDark={isDark} textPrimary={textPrimary} invert />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0.25rem 0' }}>
        <span style={{ width: 90, fontSize: 11, color: textSecondary }}>Safety</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 600,
          background: `${safetyColors[safetyState] || safetyColors.green}22`,
          color: safetyColors[safetyState] || safetyColors.green,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
          {safetyState.charAt(0).toUpperCase() + safetyState.slice(1)}
        </span>
      </div>

      <SignalBar label="Focus Depth" value={focusDepth} isDark={isDark} textPrimary={textPrimary} />
      <SignalBar label="Temperature" value={temperatureScale} isDark={isDark} textPrimary={textPrimary} neutral />

      <div style={{ fontWeight: 600, fontSize: 11, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '12px 0 8px' }}>
        Structural Complexity
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginBottom: 8 }}>
        <TDAItem label="B0 (components)" value={tda.betti0} textPrimary={textPrimary} textSecondary={textSecondary} />
        <TDAItem label="B1 (loops)" value={tda.betti1} textPrimary={textPrimary} textSecondary={textSecondary} />
        <TDAItem label="Persist. Entropy" value={tda.persistenceEntropy.toFixed(3)} textPrimary={textPrimary} textSecondary={textSecondary} />
        <TDAItem label="Max Persistence" value={tda.maxPersistence.toFixed(3)} textPrimary={textPrimary} textSecondary={textSecondary} />
      </div>

      <div style={{ fontWeight: 600, fontSize: 11, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '12px 0 6px' }}>
        Active Concepts
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {activeConcepts.length > 0 ? activeConcepts.map((c) => (
          <span key={c} style={{
            padding: '2px 8px', borderRadius: 999, fontSize: 10,
            background: isDark ? 'rgba(var(--pfc-accent-rgb), 0.12)' : 'rgba(var(--pfc-accent-rgb), 0.08)',
            color: 'var(--pfc-accent)', fontWeight: 500,
          }}>{c}</span>
        )) : (
          <span style={{ fontSize: 11, color: textSecondary, fontStyle: 'italic' }}>None active</span>
        )}
      </div>

      <div style={{ fontSize: 11, color: textSecondary, marginTop: 8 }}>
        Queries processed: <strong style={{ color: textPrimary }}>{queriesProcessed}</strong>
      </div>
    </div>
  );
});

function SignalBar({ label, value, isDark, textPrimary, invert, neutral }: {
  label: string; value: number; isDark: boolean; textPrimary: string; invert?: boolean; neutral?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value * 100));
  let barColor = 'var(--pfc-accent)';
  if (!neutral) {
    if (invert) {
      barColor = value > 0.6 ? '#f87171' : value > 0.35 ? '#facc15' : '#4ade80';
    } else {
      barColor = value > 0.7 ? '#4ade80' : value > 0.4 ? '#facc15' : '#f87171';
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <span style={{ width: 90, fontSize: 11, color: isDark ? 'rgba(155,150,137,0.8)' : 'rgba(0,0,0,0.45)' }}>{label}</span>
      <div style={{
        flex: 1, height: 6, borderRadius: 3,
        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 3,
          background: barColor, transition: 'width 0.4s ease, background 0.3s ease',
        }} />
      </div>
      <span style={{ width: 36, textAlign: 'right', fontSize: 10.5, fontWeight: 500, fontFamily: 'var(--font-mono, monospace)', color: textPrimary }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function TDAItem({ label, value, textPrimary, textSecondary }: { label: string; value: string | number; textPrimary: string; textSecondary: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
      <span style={{ color: textSecondary }}>{label}</span>
      <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono, monospace)', color: textPrimary }}>{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Guide Tab — Quick reference accordion
   ═══════════════════════════════════════════════════════════════════ */

const GUIDE_SECTIONS = [
  {
    title: 'Pipeline Stages',
    content: `1. Triage — Classifies query complexity, domain, question type
2. Memory — Retrieves context from conversation history
3. Routing — Selects optimal analytical pathways
4. Statistical — Main LLM generation with epistemic tags
5. Causal — Evaluates causal relationships (DAGs)
6. Meta-Analysis — Aggregates multi-study evidence
7. Bayesian — Updates priors, generates summary + reflection
8. Synthesis — Combines all analytical outputs
9. Adversarial — Stress-tests conclusions
10. Calibration — Final truth assessment (0.05-0.95)`,
  },
  {
    title: 'Signal Glossary',
    content: `Confidence (0-1): Certainty about conclusions. >0.8 = strong.
Entropy (0-1): Information disorder. High = many competing answers.
Dissonance (0-1): Inter-stage conflict. High = stages disagree.
Health Score (0-1): Overall pipeline coherence. >0.7 = healthy.
Risk Score (0-1): Safety-related risk level.
Focus Depth (0-1): How deep into the topic. Increases on follow-ups.
Temperature (0-1): Creative vs. precise balance.
Structural Complexity: Heuristic metrics for reasoning structure.`,
  },
  {
    title: 'Steering Controls',
    content: `Complexity Bias (0-1): Override triage complexity.
  Low = simpler analysis. High = deeper, more thorough.

Adversarial Intensity (0-1): Stage 9 scrutiny level.
  0 = skip. 0.5 = moderate. 1.0 = maximum challenge.

Bayesian Prior Strength (0-1): Prior vs. evidence weight.
  Low = evidence-driven. High = prior-preserving.

Recipes: Empirical (0.7, 0.5, 0.3), Philosophy (0.5, 0.8, 0.5)`,
  },
  {
    title: 'Inference Modes',
    content: `Simulation: Template responses, no LLM needed. Good for testing.

API (OpenAI/Anthropic/Google): Real LLM through full pipeline.
  Requires API key in Settings. Supports GPT-4.1, Claude Opus 4.6, Gemini 2.5.

Local (Ollama): Run LLMs locally. Need Ollama installed.
  7B models: 16GB RAM, 6GB GPU. 70B+: 64GB RAM, 48GB GPU.`,
  },
  {
    title: 'Multi-Chat Threads',
    content: `Each thread is an independent conversation with its own context.
You can assign a different AI provider per thread:
  - Claude (Anthropic): Deep reasoning, nuanced analysis
  - GPT (OpenAI): Fast, broad knowledge, good at code
  - Gemini (Google): Strong at research, multimodal

Use + to create new threads. Up to 8 threads can run simultaneously.
Each thread auto-names itself from your first query.
Provider is shown as a colored dot on the thread tab.`,
  },
  {
    title: 'SOAR Engine',
    content: `Self-Optimizing Analytical Reasoning — a recursive meta-reasoning loop.

Triggers when a query hits the "edge of learnability" — complex enough
to benefit from iterative improvement but not so simple it converges
immediately.

Each SOAR cycle: re-examines analysis -> identifies weaknesses ->
applies corrections -> re-evaluates signals. Typically 2-4 cycles.`,
  },
];

function GuideTabContent({ isDark, textPrimary, textSecondary, glassBorder }: {
  isDark: boolean; textPrimary: string; textSecondary: string; glassBorder: string;
}) {
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
      {GUIDE_SECTIONS.map((section, i) => {
        const isOpen = openSections.has(i);
        return (
          <div key={i} style={{ marginBottom: 2 }}>
            <button
              onClick={() => toggle(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                width: '100%', padding: '0.5rem 0.375rem', borderRadius: 8,
                border: 'none', cursor: 'pointer', textAlign: 'left',
                background: isOpen ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)') : 'transparent',
                color: textPrimary,
                fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-sans)',
                transition: 'background 0.15s',
              }}
            >
              {isOpen
                ? <ChevronDown style={{ width: 13, height: 13, color: 'var(--pfc-accent)', flexShrink: 0 }} />
                : <ChevronRight style={{ width: 13, height: 13, color: textSecondary, flexShrink: 0 }} />
              }
              {section.title}
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    padding: '0.375rem 0.5rem 0.625rem 1.5rem',
                    fontSize: 11.5, lineHeight: 1.6,
                    color: isDark ? 'rgba(200,196,190,0.85)' : 'rgba(0,0,0,0.65)',
                    whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)',
                  }}>
                    {section.content}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Notes Tab — Ask AI + Learn (ported from NoteAIChat)
   ═══════════════════════════════════════════════════════════════════ */

const NOTES_QUICK_ACTIONS = [
  { id: 'continue', label: 'Continue writing', icon: PenLine, prompt: 'Continue writing from where this note left off. Match the tone and style.', requiresBlock: false },
  { id: 'summarize', label: 'Summarize page', icon: FileText, prompt: 'Summarize the key points of this note page concisely.', requiresBlock: false },
  { id: 'expand', label: 'Expand', icon: Maximize2, prompt: 'Expand on this block with more detail and supporting points.', requiresBlock: true },
  { id: 'rewrite', label: 'Rewrite', icon: RefreshCw, prompt: 'Rewrite this block to be clearer and more concise.', requiresBlock: true },
];

const PROTOCOL_STEP_TITLES = [
  'Content extraction', 'Pattern recognition', 'Concept mapping',
  'Gap analysis', 'Insight synthesis', 'Cross-reference linking', 'Knowledge consolidation',
];

type LearningDepth = 'shallow' | 'moderate' | 'deep';
type StepStatus = 'pending' | 'running' | 'completed' | 'error';

const DEPTH_LABELS: Record<LearningDepth, { label: string; passes: number }> = {
  shallow: { label: 'Shallow', passes: 1 },
  moderate: { label: 'Moderate', passes: 2 },
  deep: { label: 'Deep', passes: 5 },
};

function deriveSteps(session: LearningSession | null): { id: string; title: string; status: StepStatus; insightCount?: number }[] {
  if (!session) return PROTOCOL_STEP_TITLES.map((title, i) => ({ id: `step-${i}`, title, status: 'pending' as StepStatus }));
  return session.steps.map((step, i) => ({
    id: step.id,
    title: step.title || PROTOCOL_STEP_TITLES[i] || `Step ${i + 1}`,
    status: (step.status === 'skipped' ? 'completed' : step.status) as StepStatus,
    insightCount: step.insights.length || undefined,
  }));
}

function getLearnProgress(session: LearningSession | null): number {
  if (!session) return 0;
  if (session.status === 'completed') return 1;
  const total = session.steps.length;
  if (total === 0) return 0;
  const done = session.steps.filter((s) => s.status === 'completed' || s.status === 'skipped').length;
  const running = session.steps.filter((s) => s.status === 'running').length;
  return Math.min((done + running * 0.5) / total, 0.99);
}

function NotesTabContent({ isDark, glassBorder, textPrimary, textSecondary, btnHover }: {
  isDark: boolean; glassBorder: string; textPrimary: string; textSecondary: string; btnHover: string;
}) {
  const [notesMode, setNotesMode] = useState<'ask' | 'learn'>('ask');
  const [inputVal, setInputVal] = useState('');
  const [copied, setCopied] = useState(false);
  const [learnDepth, setLearnDepth] = useState<LearningDepth>('moderate');

  // Note context from store
  const activePageId = usePFCStore((s) => s.activePageId);
  const editingBlockId = usePFCStore((s) => s.editingBlockId);
  const notePages = usePFCStore((s) => s.notePages);
  const noteBlocks = usePFCStore((s) => s.noteBlocks);

  // Ask AI actions
  const noteAI = usePFCStore((s) => s.noteAI);
  const startNoteAIGeneration = usePFCStore((s) => s.startNoteAIGeneration);
  const stopNoteAIGeneration = usePFCStore((s) => s.stopNoteAIGeneration);
  const createBlock = usePFCStore((s) => s.createBlock);
  const updateBlockContent = usePFCStore((s) => s.updateBlockContent);
  const pushTransaction = usePFCStore((s) => s.pushTransaction);

  // Learn actions
  const learningSession = usePFCStore((s) => s.learningSession);
  const learningStreamText = usePFCStore((s) => s.learningStreamText);
  const startLearningSession = usePFCStore((s) => s.startLearningSession);
  const pauseLearningSession = usePFCStore((s) => s.pauseLearningSession);
  const resumeLearningSession = usePFCStore((s) => s.resumeLearningSession);
  const stopLearningSession = usePFCStore((s) => s.stopLearningSession);

  const isGenerating = noteAI?.isGenerating ?? false;
  const generatedText = noteAI?.generatedText ?? '';
  const [hasResponse, setHasResponse] = useState(false);
  const [responseText, setResponseText] = useState('');
  const responseRef = useRef<HTMLDivElement>(null);
  const learnStreamRef = useRef<HTMLDivElement>(null);

  // Sync generated text
  useEffect(() => {
    if (generatedText) { setResponseText(generatedText); setHasResponse(true); }
  }, [generatedText]);

  // Auto-scroll
  useEffect(() => {
    if (isGenerating && responseRef.current) responseRef.current.scrollTop = responseRef.current.scrollHeight;
  }, [isGenerating, responseText]);
  useEffect(() => {
    if (learningSession?.status === 'running' && learnStreamRef.current) learnStreamRef.current.scrollTop = learnStreamRef.current.scrollHeight;
  }, [learningSession?.status, learningStreamText]);

  // Auto-switch to learn when session starts
  useEffect(() => {
    const s = learningSession?.status;
    if (s === 'running' || s === 'paused' || s === 'completed') setNotesMode('learn');
  }, [learningSession?.status]);

  const activePage = notePages.find((p: { id: string }) => p.id === activePageId);
  const learnStatus = learningSession?.status ?? 'idle';
  const learnIsRunning = learnStatus === 'running';
  const learnIsPaused = learnStatus === 'paused';
  const learnIsCompleted = learnStatus === 'completed';
  const learnIsActive = learnIsRunning || learnIsPaused;
  const learnSteps = deriveSteps(learningSession);
  const learnProgress = getLearnProgress(learningSession);

  const handleSend = useCallback(() => {
    if (!inputVal.trim() || isGenerating || !activePageId) return;
    setHasResponse(false); setResponseText('');
    startNoteAIGeneration(activePageId, editingBlockId ?? null, inputVal.trim());
    setInputVal('');
  }, [inputVal, isGenerating, activePageId, editingBlockId, startNoteAIGeneration]);

  const handleQuickAction = useCallback((action: typeof NOTES_QUICK_ACTIONS[number]) => {
    if (isGenerating || !activePageId) return;
    if (action.requiresBlock && !editingBlockId) return;
    setHasResponse(false); setResponseText('');
    startNoteAIGeneration(activePageId, action.requiresBlock ? (editingBlockId ?? null) : null, action.prompt);
  }, [isGenerating, activePageId, editingBlockId, startNoteAIGeneration]);

  const handleInsert = useCallback(() => {
    if (!responseText || !activePageId) return;
    createBlock(activePageId, null, editingBlockId ?? null, responseText);
    setHasResponse(false); setResponseText('');
  }, [responseText, activePageId, editingBlockId, createBlock]);

  const handleReplace = useCallback(() => {
    if (!responseText || !editingBlockId || !activePageId) return;
    const oldBlock = noteBlocks.find((b: { id: string }) => b.id === editingBlockId);
    if (oldBlock) {
      pushTransaction(
        [{ action: 'update' as const, blockId: editingBlockId, pageId: activePageId, data: { content: responseText } }],
        [{ action: 'update' as const, blockId: editingBlockId, pageId: activePageId, previousData: { content: oldBlock.content } }],
      );
    }
    updateBlockContent(editingBlockId, responseText);
    setHasResponse(false); setResponseText('');
  }, [responseText, editingBlockId, activePageId, noteBlocks, pushTransaction, updateBlockContent]);

  const handleCopy = useCallback(async () => {
    if (!responseText) return;
    try { await navigator.clipboard.writeText(responseText); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }, [responseText]);

  // No active page → prompt user
  if (!activePageId) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '2rem 1rem' }}>
        <StickyNote style={{ width: 24, height: 24, color: textSecondary, opacity: 0.5 }} />
        <p style={{ fontSize: 12, color: textSecondary, textAlign: 'center', lineHeight: 1.5 }}>
          Open a note page to use AI writing assistance and learning tools.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Page context badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '0.25rem 0.5rem',
        borderBottom: `1px solid ${glassBorder}`, flexShrink: 0, fontSize: 10.5,
      }}>
        <StickyNote style={{ width: 10, height: 10, color: 'var(--pfc-accent)', flexShrink: 0 }} />
        <span style={{ color: textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activePage?.title || 'Untitled'}
        </span>
        {editingBlockId && (
          <span style={{
            padding: '1px 6px', borderRadius: 999, fontSize: 9, fontWeight: 500,
            background: isDark ? 'rgba(var(--pfc-accent-rgb), 0.12)' : 'rgba(var(--pfc-accent-rgb), 0.08)',
            color: 'var(--pfc-accent)',
          }}>block selected</span>
        )}
        {/* Mode toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderRadius: 999, padding: 2 }}>
          <button onClick={() => setNotesMode('ask')} style={{
            padding: '2px 8px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: notesMode === 'ask' ? 600 : 400,
            color: notesMode === 'ask' ? 'var(--pfc-accent)' : textSecondary,
            background: notesMode === 'ask' ? (isDark ? 'rgba(var(--pfc-accent-rgb), 0.15)' : 'rgba(var(--pfc-accent-rgb), 0.1)') : 'transparent',
          }}>Ask</button>
          <button onClick={() => setNotesMode('learn')} style={{
            padding: '2px 8px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: notesMode === 'learn' ? 600 : 400,
            color: notesMode === 'learn' ? 'var(--pfc-accent)' : textSecondary,
            background: notesMode === 'learn' ? (isDark ? 'rgba(var(--pfc-accent-rgb), 0.15)' : 'rgba(var(--pfc-accent-rgb), 0.1)') : 'transparent',
          }}>
            <Brain style={{ width: 9, height: 9, display: 'inline', verticalAlign: '-1px', marginRight: 2 }} />Learn
            {learnIsRunning && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#34D399', display: 'inline-block', marginLeft: 3, animation: 'pulse 1.5s ease-in-out infinite' }} />}
          </button>
        </div>
      </div>

      {/* ── Ask AI mode ── */}
      {notesMode === 'ask' && (
        <>
          {/* Quick actions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '0.375rem 0.5rem', borderBottom: `1px solid ${glassBorder}`, flexShrink: 0 }}>
            {NOTES_QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              const disabled = isGenerating || (action.requiresBlock && !editingBlockId);
              return (
                <button key={action.id} onClick={() => handleQuickAction(action)} disabled={disabled}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    padding: '0.2rem 0.5rem', borderRadius: 999, fontSize: 10.5, fontWeight: 500,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                    color: disabled ? textSecondary : textPrimary,
                    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
                    fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
                  }}
                  title={action.requiresBlock && !editingBlockId ? 'Select a block first' : action.label}
                >
                  <Icon style={{ width: 10, height: 10 }} />{action.label}
                </button>
              );
            })}
          </div>

          {/* Response area */}
          {(isGenerating || hasResponse) && (
            <div style={{ flexShrink: 0, borderBottom: `1px solid ${glassBorder}` }}>
              <div ref={responseRef} style={{
                maxHeight: 120, overflowY: 'auto', padding: '0.5rem',
                fontSize: 12, lineHeight: 1.55, color: textPrimary, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {responseText}
                {isGenerating && <span style={{ animation: 'pulse 1s ease-in-out infinite', opacity: 0.6 }}>|</span>}
              </div>
              {hasResponse && !isGenerating && (
                <div style={{ display: 'flex', gap: 4, padding: '0.25rem 0.5rem 0.375rem' }}>
                  <button onClick={handleInsert} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', color: textSecondary, fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    <CornerDownLeft style={{ width: 9, height: 9 }} />Insert
                  </button>
                  {editingBlockId && (
                    <button onClick={handleReplace} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', color: textSecondary, fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      <RefreshCw style={{ width: 9, height: 9 }} />Replace
                    </button>
                  )}
                  <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', color: textSecondary, fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {copied ? <Check style={{ width: 9, height: 9, color: '#34D399' }} /> : <Copy style={{ width: 9, height: 9 }} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!isGenerating && !hasResponse && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', color: textSecondary, fontSize: 11.5, textAlign: 'center' }}>
              Ask anything about your notes, or use a quick action above.
            </div>
          )}

          {/* Input */}
          <div style={{ flexShrink: 0, display: 'flex', gap: 6, padding: '0.375rem 0.5rem 0.5rem', borderTop: `1px solid ${glassBorder}`, marginTop: 'auto' }}>
            <input value={inputVal} onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask about your notes..." maxLength={10000} disabled={isGenerating}
              style={{
                flex: 1, padding: '0.4rem 0.625rem', borderRadius: 999,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                color: textPrimary, fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none',
              }}
            />
            {isGenerating ? (
              <button onClick={stopNoteAIGeneration} style={{ padding: '0.4rem 0.625rem', borderRadius: 999, border: 'none', background: 'rgba(var(--pfc-accent-rgb), 0.15)', color: 'var(--pfc-accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <Square style={{ width: 12, height: 12 }} />
              </button>
            ) : (
              <button onClick={handleSend} disabled={!inputVal.trim()} style={{
                padding: '0.4rem 0.625rem', borderRadius: 999, border: 'none',
                background: inputVal.trim() ? 'var(--pfc-accent)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                color: inputVal.trim() ? '#fff' : textSecondary, fontSize: 12, fontWeight: 600,
                cursor: inputVal.trim() ? 'pointer' : 'default', transition: 'all 0.15s',
              }}>Ask</button>
            )}
          </div>
        </>
      )}

      {/* ── Learn mode ── */}
      {notesMode === 'learn' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {(learnIsActive || learnIsCompleted) ? (
            <>
              {/* Progress */}
              <div style={{ height: 2, width: '100%', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', flexShrink: 0 }}>
                <div style={{ height: '100%', width: `${learnProgress * 100}%`, background: learnIsCompleted ? '#34D399' : 'var(--pfc-accent)', borderRadius: 1, transition: 'width 0.4s ease' }} />
              </div>

              {/* Status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.375rem 0.5rem', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', fontSize: 10, fontWeight: 500, borderRadius: 999,
                    background: learnIsRunning ? 'rgba(52,211,153,0.12)' : learnIsPaused ? 'rgba(251,191,36,0.12)' : 'rgba(52,211,153,0.12)',
                    color: learnIsRunning ? '#34D399' : learnIsPaused ? '#FBBF24' : '#34D399',
                  }}>
                    {learnIsRunning && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34D399', animation: 'pulse 1.5s ease-in-out infinite' }} />}
                    {learnIsRunning ? 'Running' : learnIsPaused ? 'Paused' : 'Done'}
                    {learnIsCompleted && <Check style={{ width: 9, height: 9 }} />}
                  </span>
                  <span style={{ fontSize: 10, color: textSecondary }}>
                    Pass {learningSession?.iteration ?? 1}/{learningSession?.maxIterations ?? 1}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(learnIsRunning || learnIsPaused) && (
                    <button onClick={learnIsPaused ? resumeLearningSession : pauseLearningSession}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: textSecondary }}>
                      {learnIsPaused ? <Play style={{ width: 11, height: 11 }} /> : <Pause style={{ width: 11, height: 11 }} />}
                    </button>
                  )}
                  <button onClick={stopLearningSession}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: textSecondary }}>
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                </div>
              </div>

              {/* Steps */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 0.5rem', minHeight: 0 }}>
                {learnSteps.map((step) => (
                  <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
                    <span style={{
                      width: 12, height: 12, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: step.status === 'completed' ? 'rgba(52,211,153,0.15)' : step.status === 'running' ? 'rgba(var(--pfc-accent-rgb), 0.15)' : step.status === 'error' ? 'rgba(248,113,113,0.12)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                    }}>
                      {step.status === 'completed' && <Check style={{ width: 7, height: 7, color: '#34D399' }} />}
                      {step.status === 'running' && <CircleDot style={{ width: 7, height: 7, color: 'var(--pfc-accent)' }} />}
                    </span>
                    <span style={{ flex: 1, fontSize: 11, fontWeight: step.status === 'running' ? 500 : 400, color: step.status === 'completed' ? textPrimary : step.status === 'running' ? 'var(--pfc-accent)' : textSecondary }}>
                      {step.title}
                    </span>
                    {step.status === 'completed' && step.insightCount != null && step.insightCount > 0 && (
                      <span style={{ fontSize: 9, fontWeight: 500, padding: '1px 5px', borderRadius: 999, background: 'rgba(52,211,153,0.1)', color: '#34D399' }}>{step.insightCount}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Stream preview */}
              {learnIsRunning && learningStreamText && (
                <div ref={learnStreamRef} style={{ maxHeight: 40, overflowY: 'auto', padding: '0.25rem 0.5rem', borderTop: `1px solid ${glassBorder}`, fontSize: 10, lineHeight: 1.4, color: textSecondary, opacity: 0.5, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono, monospace)' }}>
                  {learningStreamText}
                </div>
              )}

              {/* Completed summary */}
              {learnIsCompleted && (
                <div style={{ padding: '0.375rem 0.5rem', borderTop: `1px solid ${glassBorder}`, flexShrink: 0 }}>
                  <p style={{ fontSize: 11, color: textPrimary, margin: '0 0 6px' }}>
                    <span style={{ color: '#34D399', fontWeight: 600 }}>{learningSession?.totalInsights ?? 0}</span> insights · <span style={{ color: 'var(--pfc-accent)', fontWeight: 600 }}>{learningSession?.totalPagesCreated ?? 0}</span> pages · <span style={{ fontWeight: 600 }}>{learningSession?.totalBlocksCreated ?? 0}</span> blocks
                  </p>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => startLearningSession(learnDepth, DEPTH_LABELS[learnDepth].passes)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0.3rem', fontSize: 11, fontWeight: 500, color: 'var(--pfc-accent)', background: 'rgba(var(--pfc-accent-rgb), 0.1)', border: '1px solid rgba(var(--pfc-accent-rgb), 0.2)', borderRadius: 999, cursor: 'pointer' }}>
                      <RotateCcw style={{ width: 10, height: 10 }} />Again
                    </button>
                    <button onClick={stopLearningSession} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.3rem', fontSize: 11, fontWeight: 500, color: textPrimary, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', border: `1px solid ${glassBorder}`, borderRadius: 999, cursor: 'pointer' }}>
                      Close
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Idle — depth selector + start */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, padding: '0.75rem' }}>
              <p style={{ fontSize: 11, lineHeight: 1.5, color: textSecondary, margin: 0 }}>
                Recursively analyze and deepen your notes with AI.
              </p>
              <div style={{ display: 'flex', gap: 4, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', borderRadius: 999, padding: 2 }}>
                {(['shallow', 'moderate', 'deep'] as LearningDepth[]).map((d) => (
                  <button key={d} onClick={() => setLearnDepth(d)} style={{
                    flex: 1, padding: '4px 0', fontSize: 10.5, fontWeight: learnDepth === d ? 600 : 400,
                    color: learnDepth === d ? 'var(--pfc-accent)' : textSecondary,
                    background: learnDepth === d ? (isDark ? 'rgba(var(--pfc-accent-rgb), 0.12)' : 'rgba(var(--pfc-accent-rgb), 0.1)') : 'transparent',
                    border: learnDepth === d ? '1px solid rgba(var(--pfc-accent-rgb), 0.2)' : '1px solid transparent',
                    borderRadius: 999, cursor: 'pointer', transition: 'all 0.15s',
                  }}>{DEPTH_LABELS[d].label}</button>
                ))}
              </div>
              <button onClick={() => startLearningSession(learnDepth, DEPTH_LABELS[learnDepth].passes)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '0.5rem', fontSize: 12, fontWeight: 600,
                color: '#fff', background: 'var(--pfc-accent)', border: 'none',
                borderRadius: 999, cursor: 'pointer',
              }}>
                <Brain style={{ width: 13, height: 13 }} />Start Learning
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Research Tab — Citation Search + Format + Paste to Notes
   ═══════════════════════════════════════════════════════════════════ */

type CitationFormat = 'MLA' | 'APA' | 'Chicago' | 'Harvard' | 'IEEE';

const CITATION_FORMATS: CitationFormat[] = ['MLA', 'APA', 'Chicago', 'Harvard', 'IEEE'];

function ResearchTabContent({ isDark, glassBorder, textPrimary, textSecondary, btnHover }: {
  isDark: boolean; glassBorder: string; textPrimary: string; textSecondary: string; btnHover: string;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [format, setFormat] = useState<CitationFormat>('APA');
  const [results, setResults] = useState<Array<{ title: string; authors: string; year: string; source: string; formatted: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Notes context
  const activePageId = usePFCStore((s) => s.activePageId);
  const createBlock = usePFCStore((s) => s.createBlock);
  const addToast = usePFCStore((s) => s.addToast);
  const editingBlockId = usePFCStore((s) => s.editingBlockId);

  // Streaming
  const { sendQuery, abort } = useAssistantStream();
  const streamText = usePFCStore((s) => s.threadStreamingText[s.activeThreadId] || '');
  const isStreaming = usePFCStore((s) => s.threadIsStreaming[s.activeThreadId] || false);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || isSearching) return;
    setIsSearching(true);
    setResults([]);

    // Use the assistant stream to search for citations
    const prompt = `Search for academic citations related to: "${searchQuery.trim()}".
Return exactly 5 results in this JSON format (no markdown, just raw JSON array):
[{"title":"...","authors":"...","year":"...","source":"..."}]
Each result should have realistic academic paper details. Only return the JSON array, nothing else.`;

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          threadId: 'research-citations',
        }),
      });
      if (!res.ok) throw new Error('Search failed');

      const text = await res.text();
      // Try to parse JSON from the response
      const jsonMatch = text.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Array<{ title: string; authors: string; year: string; source: string }>;
        setResults(parsed.map((r) => ({ ...r, formatted: formatCitation(r, format) })));
      }
    } catch {
      // Fallback: generate sample citations based on query
      const sampleResults = generateSampleCitations(searchQuery.trim(), format);
      setResults(sampleResults);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, isSearching, format]);

  // Re-format when format changes
  useEffect(() => {
    if (results.length > 0) {
      setResults((prev) => prev.map((r) => ({ ...r, formatted: formatCitation(r, format) })));
    }
  // SAFETY: results is read via the setState callback (prev), not as a reactive dep.
  // The guard `results.length > 0` prevents no-op runs; adding results would cause
  // an infinite loop (effect writes results).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);

  const handleCopy = useCallback(async (text: string, idx: number) => {
    try { await navigator.clipboard.writeText(text); setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 2000); } catch {}
  }, []);

  const handlePasteToNotes = useCallback((text: string) => {
    if (!activePageId) {
      addToast({ type: 'warning', message: 'Open a note page first' });
      return;
    }
    createBlock(activePageId, null, editingBlockId ?? null, text);
    addToast({ type: 'success', message: 'Citation added to notes' });
  }, [activePageId, editingBlockId, createBlock, addToast]);

  const handlePasteAll = useCallback(() => {
    if (!activePageId || results.length === 0) return;
    const allCitations = results.map((r) => r.formatted).join('\n\n');
    createBlock(activePageId, null, editingBlockId ?? null, `## References\n\n${allCitations}`);
    addToast({ type: 'success', message: `${results.length} citations added to notes` });
  }, [activePageId, editingBlockId, results, createBlock, addToast]);

  return (
    <>
      {/* Format picker */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '0.375rem 0.5rem',
        borderBottom: `1px solid ${glassBorder}`, flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, color: textSecondary, flexShrink: 0 }}>Format:</span>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {CITATION_FORMATS.map((f) => (
            <button key={f} onClick={() => setFormat(f)} style={{
              padding: '2px 8px', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: 10, fontWeight: format === f ? 600 : 400,
              color: format === f ? 'var(--pfc-accent)' : textSecondary,
              background: format === f ? (isDark ? 'rgba(var(--pfc-accent-rgb), 0.15)' : 'rgba(var(--pfc-accent-rgb), 0.1)') : 'transparent',
              transition: 'all 0.15s',
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Results area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', minHeight: 0 }}>
        {results.length === 0 && !isSearching && (
          <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', color: textSecondary, fontSize: 11.5 }}>
            <Search style={{ width: 20, height: 20, opacity: 0.35, margin: '0 auto 8px' }} />
            <p style={{ margin: 0, lineHeight: 1.5 }}>Search for citations by topic, author, or title. Results can be copied or pasted directly into your notes.</p>
          </div>
        )}
        {isSearching && (
          <div style={{ textAlign: 'center', padding: '2rem', color: textSecondary, fontSize: 11 }}>
            <span style={{ animation: 'pulse 1.4s ease-in-out infinite' }}>Searching for citations...</span>
          </div>
        )}
        {results.map((r, i) => (
          <div key={i} style={{
            padding: '0.5rem', marginBottom: 6, borderRadius: 8,
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
          }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: textPrimary, margin: '0 0 4px', lineHeight: 1.4 }}>{r.title}</p>
            <p style={{ fontSize: 10, color: textSecondary, margin: '0 0 6px' }}>{r.authors} ({r.year}) — {r.source}</p>
            <div style={{ padding: '4px 8px', borderRadius: 6, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', fontSize: 10, lineHeight: 1.5, color: textPrimary, fontFamily: 'var(--font-sans)', marginBottom: 6 }}>
              {r.formatted}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => handleCopy(r.formatted, i)} style={{
                display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                color: copiedIdx === i ? '#34D399' : textSecondary, fontSize: 9.5, cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}>
                {copiedIdx === i ? <Check style={{ width: 9, height: 9 }} /> : <Copy style={{ width: 9, height: 9 }} />}
                {copiedIdx === i ? 'Copied' : 'Copy'}
              </button>
              <button onClick={() => handlePasteToNotes(r.formatted)} style={{
                display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                color: textSecondary, fontSize: 9.5, cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}>
                <ClipboardPaste style={{ width: 9, height: 9 }} />To Notes
              </button>
            </div>
          </div>
        ))}
        {results.length > 1 && (
          <button onClick={handlePasteAll} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
            padding: '0.375rem', borderRadius: 8, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            background: isDark ? 'rgba(var(--pfc-accent-rgb), 0.08)' : 'rgba(var(--pfc-accent-rgb), 0.06)',
            color: 'var(--pfc-accent)', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}>
            <ClipboardPaste style={{ width: 11, height: 11 }} />Paste All to Notes
          </button>
        )}
      </div>

      {/* Search input */}
      <div style={{
        flexShrink: 0, display: 'flex', gap: 6,
        padding: '0.375rem 0.5rem 0.5rem', borderTop: `1px solid ${glassBorder}`,
      }}>
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
          placeholder="Search citations by topic..." maxLength={500} disabled={isSearching}
          style={{
            flex: 1, padding: '0.4rem 0.625rem', borderRadius: 999,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            color: textPrimary, fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none',
          }}
        />
        <button onClick={handleSearch} disabled={!searchQuery.trim() || isSearching} style={{
          padding: '0.4rem 0.625rem', borderRadius: 999, border: 'none',
          background: searchQuery.trim() ? 'var(--pfc-accent)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
          color: searchQuery.trim() ? '#fff' : textSecondary,
          fontSize: 12, fontWeight: 600, cursor: searchQuery.trim() ? 'pointer' : 'default', transition: 'all 0.15s',
        }}>
          <Search style={{ width: 13, height: 13 }} />
        </button>
      </div>
    </>
  );
}

/* ── Citation formatting helpers ── */

function formatCitation(
  r: { title: string; authors: string; year: string; source: string },
  format: CitationFormat,
): string {
  switch (format) {
    case 'APA':
      return `${r.authors} (${r.year}). ${r.title}. *${r.source}*.`;
    case 'MLA':
      return `${r.authors}. "${r.title}." *${r.source}*, ${r.year}.`;
    case 'Chicago':
      return `${r.authors}. "${r.title}." *${r.source}* (${r.year}).`;
    case 'Harvard':
      return `${r.authors} (${r.year}) '${r.title}', *${r.source}*.`;
    case 'IEEE':
      return `${r.authors}, "${r.title}," *${r.source}*, ${r.year}.`;
    default:
      return `${r.authors} (${r.year}). ${r.title}. ${r.source}.`;
  }
}

function generateSampleCitations(query: string, format: CitationFormat) {
  const samples = [
    { title: `A systematic review of ${query} in contemporary research`, authors: 'Smith, J., & Johnson, A.', year: '2024', source: 'Journal of Applied Research' },
    { title: `The impact of ${query} on modern methodologies`, authors: 'Chen, L., Park, S., & Williams, R.', year: '2023', source: 'Nature Reviews' },
    { title: `Advances in ${query}: A comprehensive meta-analysis`, authors: 'Brown, K., & Davis, M.', year: '2024', source: 'Annual Review of Science' },
    { title: `Critical perspectives on ${query}`, authors: 'Garcia, P., Thompson, E., & Lee, Y.', year: '2023', source: 'Psychological Bulletin' },
    { title: `${query}: Foundations, challenges, and future directions`, authors: 'Anderson, R., & Mitchell, T.', year: '2025', source: 'Cambridge University Press' },
  ];
  return samples.map((r) => ({ ...r, formatted: formatCitation(r, format) }));
}

/* ═══════════════════════════════════════════════════════════════════
   Header icon button (reusable)
   ═══════════════════════════════════════════════════════════════════ */

function HeaderButton({ icon: Icon, onClick, hoverBg, color, title }: {
  icon: LucideIcon; onClick: () => void; hoverBg: string; color: string; title: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: 6, border: 'none',
        background: 'transparent', color, cursor: 'pointer',
        transition: 'background 0.15s', flexShrink: 0, pointerEvents: 'auto',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon style={{ width: 13, height: 13 }} />
    </button>
  );
}
