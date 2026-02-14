'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BotIcon,
  PlayIcon,
  SquareIcon,
  RefreshCwIcon,
  ClockIcon,
  BrainCircuitIcon,
  BookOpenIcon,
  TagsIcon,
  SearchIcon,
  GraduationCapIcon,
  LinkIcon,
  CircleIcon,
  CheckCircle2Icon,
  XCircleIcon,
  SettingsIcon,
  ScrollTextIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ShieldIcon,
  FolderOpenIcon,
  TerminalIcon,
  UploadIcon,
  DownloadIcon,
  LockIcon,
  UnlockIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';

import { PageShell, GlassSection } from '@/components/layout/page-shell';
import { GlassBubbleButton } from '@/components/chat/glass-bubble-button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PixelBook } from '@/components/decorative/pixel-mascots';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { cn } from '@/lib/utils';
import { useIsDark } from '@/hooks/use-is-dark';

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

interface TaskStatus {
  name: string;
  enabled: boolean;
  intervalMs: number;
  lastRunAt: number | null;
  lastResult: string | null;
}

interface DaemonStatus {
  pid?: number;
  uptime?: number;
  running: boolean;
  state?: string;
  currentTask?: string | null;
  tasks?: TaskStatus[];
  error?: string;
}

interface DaemonEvent {
  id: number;
  event_type: string;
  task_name: string | null;
  payload: string | null;
  created_at: string;
}

interface DaemonConfig {
  [key: string]: string;
}

interface PermissionsInfo {
  level: 'sandboxed' | 'file-access' | 'full-access';
  baseDir: string | null;
  capabilities: {
    sqlite: boolean;
    llm: boolean;
    fileRead: boolean;
    fileWrite: boolean;
    shell: boolean;
    markdownSync: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════

const POLL_INTERVAL = 5000;

const TASK_META: Record<string, { icon: typeof BrainCircuitIcon; color: string; label: string; description: string }> = {
  'connection-finder': {
    icon: LinkIcon,
    color: 'text-pfc-cyan',
    label: 'Connection Finder',
    description: 'Discovers hidden links between your notes using cross-reference analysis',
  },
  'daily-brief': {
    icon: BookOpenIcon,
    color: 'text-pfc-green',
    label: 'Daily Brief',
    description: 'Generates a morning summary of recent changes and key insights',
  },
  'auto-organizer': {
    icon: TagsIcon,
    color: 'text-pfc-violet',
    label: 'Auto-Organizer',
    description: 'Tags untagged pages and clusters notes by topic similarity',
  },
  'research-assistant': {
    icon: SearchIcon,
    color: 'text-pfc-ember',
    label: 'Research Assistant',
    description: 'Identifies research questions in your notes and drafts answers',
  },
  'learning-runner': {
    icon: GraduationCapIcon,
    color: 'text-pfc-yellow',
    label: 'Learning Protocol',
    description: 'Runs the 7-step recursive learning engine to deepen understanding',
  },
};

// ═══════════════════════════════════════════════════════════════════
// Animation variants
// ═══════════════════════════════════════════════════════════════════

import { ease } from '@/lib/motion/motion-config';

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: ease.cupertino },
  }),
};

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatInterval(ms: number): string {
  if (!ms || isNaN(ms) || ms <= 0) return '—';
  const hours = ms / 3600000;
  if (hours >= 24) return `${Math.round(hours / 24)}d`;
  if (hours >= 1) return `${Math.round(hours)}h`;
  return `${Math.round(ms / 60000)}m`;
}

function timeAgo(timestamp: number | string): string {
  const ms = typeof timestamp === 'string' ? Date.now() - new Date(timestamp).getTime() : Date.now() - timestamp;
  if (ms < 60000) return 'just now';
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

// ═══════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════

export default function DaemonPage() {
  const ready = useSetupGuard();
  const { isDark, isSunny } = useIsDark();
  const isDefaultLight = !isDark && !isSunny;

  const [status, setStatus] = useState<DaemonStatus | null>(null);
  const [events, setEvents] = useState<DaemonEvent[]>([]);
  const [config, setConfig] = useState<DaemonConfig>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [permissions, setPermissions] = useState<PermissionsInfo | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [baseDirDraft, setBaseDirDraft] = useState('');
  const [editingBaseDir, setEditingBaseDir] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch daemon status ──
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/system/daemon?endpoint=status');
      const data: DaemonStatus = await res.json();
      setStatus(data);
    } catch {
      setStatus({ running: false, error: 'Failed to reach API' });
    }
    setLoading(false);
  }, []);

  // ── Fetch events ──
  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/system/daemon?endpoint=events&limit=30');
      const data = await res.json();
      if (Array.isArray(data)) setEvents(data);
    } catch { /* non-critical */ }
  }, []);

  // ── Fetch config ──
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/system/daemon?endpoint=config');
      const data = await res.json();
      if (data && typeof data === 'object' && !data.error) setConfig(data);
    } catch { /* non-critical */ }
  }, []);

  // ── Fetch permissions ──
  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch('/api/system/daemon?endpoint=permissions');
      const data = await res.json();
      if (data && data.level) {
        setPermissions(data);
        if (data.baseDir && !baseDirDraft) setBaseDirDraft(data.baseDir);
      }
    } catch { /* non-critical */ }
    // SAFETY: baseDirDraft is read as a guard (only set if empty); adding it would
    // re-fetch permissions on every keystroke in the base-dir input. Zustand setters
    // are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-poll ──
  useEffect(() => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStatus]);

  // Fetch events + config when panels open
  useEffect(() => {
    if (showEvents) fetchEvents();
  }, [showEvents, fetchEvents]);

  useEffect(() => {
    if (showConfig) fetchConfig();
  }, [showConfig, fetchConfig]);

  // Also fetch events when status changes (new task completed)
  useEffect(() => {
    if (showEvents && status?.running) fetchEvents();
    // SAFETY: showEvents and fetchEvents are guards/stable callbacks; this effect
    // should only fire when a new task completes (currentTask changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.currentTask]);

  // Fetch permissions when daemon is running
  useEffect(() => {
    if (status?.running && status?.pid) fetchPermissions();
    // SAFETY: fetchPermissions is a stable callback (empty deps). This effect
    // should only fire when daemon running state changes, not on every status poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.running]);

  // ── Actions ──
  const handleStart = async () => {
    setActionLoading(true);
    try {
      await fetch('/api/system/daemon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      // Give it a moment to boot
      setTimeout(() => {
        fetchStatus();
        setActionLoading(false);
      }, 3000);
    } catch {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await fetch('/api/system/daemon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      setTimeout(() => {
        fetchStatus();
        setActionLoading(false);
      }, 1500);
    } catch {
      setActionLoading(false);
    }
  };

  const handleConfigUpdate = async (key: string, value: string) => {
    // Optimistically update local config state
    setConfig(prev => ({ ...prev, [key]: value }));

    // Optimistically update task status if toggling a task enable/disable
    const taskEnableMatch = key.match(/^task\.(\w+)\.enabled$/);
    if (taskEnableMatch?.[1] && status?.tasks) {
      const camelName = taskEnableMatch[1];
      // Convert camelCase back to kebab-case: "connectionFinder" → "connection-finder"
      const kebabName = camelName.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      setStatus(prev => prev ? {
        ...prev,
        tasks: prev.tasks?.map(t =>
          t.name === kebabName ? { ...t, enabled: value === 'true' } : t
        ),
      } : prev);
    }

    try {
      const res = await fetch('/api/system/daemon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'config', config: { [key]: value } }),
      });
      if (!res.ok) {
        // Revert on failure — re-fetch to get accurate state
        fetchStatus();
      }
      // Re-fetch status to sync with daemon
      setTimeout(fetchStatus, 300);
    } catch {
      // Revert on network error
      setTimeout(fetchStatus, 300);
    }
  };

  const handlePermissionChange = async (level: string) => {
    // Optimistic permission update
    setPermissions(prev => prev ? { ...prev, level: level as PermissionsInfo['level'] } : prev);
    await handleConfigUpdate('permissions.level', level);
    setTimeout(fetchPermissions, 500);
  };

  const handleBaseDirSave = async () => {
    await handleConfigUpdate('permissions.baseDir', baseDirDraft);
    setEditingBaseDir(false);
    setTimeout(fetchPermissions, 500);
  };

  const handleSyncExport = async () => {
    setSyncStatus('Exporting...');
    try {
      const res = await fetch('/api/system/daemon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'proxy',
          daemonPath: '/fs/sync-export',
          data: { vaultId: config['vault.activeId'] || '' },
        }),
      });
      const result = await res.json();
      if (result.ok) {
        setSyncStatus(`Exported ${result.exported} pages to ${result.dir}`);
      } else {
        setSyncStatus(`Export failed: ${result.error || 'unknown error'}`);
      }
    } catch {
      setSyncStatus('Export failed — daemon may not be running');
    }
    setTimeout(() => setSyncStatus(null), 5000);
  };

  const handleSyncImport = async () => {
    setSyncStatus('Importing...');
    try {
      const res = await fetch('/api/system/daemon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'proxy',
          daemonPath: '/fs/sync-import',
          data: { vaultId: config['vault.activeId'] || '' },
        }),
      });
      const result = await res.json();
      if (result.ok) {
        setSyncStatus(`Imported ${result.imported} new, ${result.updated} updated`);
      } else {
        setSyncStatus(`Import failed: ${result.error || 'unknown error'}`);
      }
    } catch {
      setSyncStatus('Import failed — daemon may not be running');
    }
    setTimeout(() => setSyncStatus(null), 5000);
  };

  const isRunning = status?.running === true && !!status?.pid;

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--chat-surface)]">
        <PixelBook size={40} />
      </div>
    );
  }

  return (
    <PageShell
      icon={BotIcon}
      iconColor="var(--color-pfc-cyan)"
      title="Daemon"
      subtitle="Autonomous agent — 24/7 note analysis, learning, and organization"
    >
      {/* ── Status + Controls ── */}
      <GlassSection title="Agent Status">
        <div className="space-y-5">
          {/* Status header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-3 w-3 rounded-full transition-colors',
                loading ? 'bg-muted-foreground/30 animate-pulse' :
                isRunning ? 'bg-pfc-green animate-[pulse_2s_ease-in-out_infinite]' :
                'bg-pfc-red/60',
              )} />
              <div>
                <p className="text-sm font-semibold" style={{ fontFamily: 'var(--font-heading)', fontSize: '0.625rem', fontWeight: 400 }}>
                  {loading ? 'Checking...' : isRunning ? 'Running' : 'Stopped'}
                </p>
                {isRunning && status?.uptime != null && (
                  <p className="text-xs text-muted-foreground/50">
                    PID {status.pid} · Uptime {formatUptime(status.uptime)}
                  </p>
                )}
                {!isRunning && !loading && (
                  <p className="text-xs text-muted-foreground/50">
                    Daemon is not running
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <GlassBubbleButton
                size="sm"
                color="neutral"
                onClick={fetchStatus}
                disabled={loading}
              >
                <RefreshCwIcon className="h-3 w-3" />
              </GlassBubbleButton>

              {isRunning ? (
                <GlassBubbleButton
                  size="sm"
                  color="red"
                  onClick={handleStop}
                  disabled={actionLoading}
                >
                  {actionLoading ? <PixelBook size={14} /> : <SquareIcon className="h-3 w-3" />}
                  Stop
                </GlassBubbleButton>
              ) : (
                <GlassBubbleButton
                  size="sm"
                  color="green"
                  onClick={handleStart}
                  disabled={actionLoading || loading}
                >
                  {actionLoading ? <PixelBook size={14} /> : <PlayIcon className="h-3 w-3" />}
                  Start
                </GlassBubbleButton>
              )}
            </div>
          </div>

          {/* Current task indicator */}
          <AnimatePresence>
            {isRunning && status?.currentTask && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl bg-pfc-cyan/5 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <BrainCircuitIcon className="h-4 w-4 text-pfc-cyan animate-pulse" />
                  <span className="text-sm font-semibold text-pfc-cyan">
                    Running: {TASK_META[status.currentTask]?.label || status.currentTask}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </GlassSection>

      {/* ── Task Overview ── */}
      <GlassSection
        title="Agent Tasks"
        badge={
          isRunning && status?.tasks ? (
            <Badge variant="outline" className="text-[10px] font-mono text-pfc-green border-0 bg-pfc-green/10">
              {status.tasks.filter(t => t.enabled).length}/{status.tasks.length} active
            </Badge>
          ) : null
        }
      >
        {!isRunning && !loading ? (
          <div className="rounded-2xl bg-muted/20 px-4 py-6 text-center">
            <BotIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground/50">Start the daemon to see task status</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-8">
            <PixelBook size={24} />
          </div>
        ) : (
          <div className="space-y-3">
            {(status?.tasks || []).map((task, i) => {
              const meta = TASK_META[task.name] || {
                icon: BrainCircuitIcon,
                color: 'text-muted-foreground',
                label: task.name,
                description: '',
              };
              const Icon = meta.icon;
              const isActive = status?.currentTask === task.name;

              return (
                <motion.div
                  key={task.name}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  custom={i}
                  className={cn(
                    'rounded-2xl p-4 transition-colors',
                    isActive
                      ? 'bg-pfc-cyan/8'
                      : task.enabled
                        ? 'bg-muted/20'
                        : 'bg-muted/10 opacity-50',
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'mt-0.5 flex h-8 w-8 items-center justify-center rounded-full',
                        task.enabled ? 'bg-muted/50' : 'bg-muted/20',
                      )}>
                        <Icon className={cn('h-4 w-4', meta.color)} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{meta.label}</p>
                          {isActive && (
                            <Badge className="text-[9px] bg-pfc-cyan/20 text-pfc-cyan border-0 animate-pulse">
                              running
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground/50 mt-0.5">
                          {meta.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground/40">
                          <span className="flex items-center gap-1">
                            <ClockIcon className="h-3 w-3" />
                            Every {formatInterval(task.intervalMs)}
                          </span>
                          {task.lastRunAt && (
                            <span>Last: {timeAgo(task.lastRunAt)}</span>
                          )}
                        </div>
                        {task.lastResult && (
                          <p className="text-[11px] text-muted-foreground/60 mt-1 font-mono">
                            → {task.lastResult.slice(0, 120)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Enable/disable toggle */}
                    <Switch
                      checked={task.enabled}
                      onCheckedChange={(v) => {
                        const configKey = `task.${task.name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}.enabled`;
                        handleConfigUpdate(configKey, v ? 'true' : 'false');
                      }}
                      size="sm"
                      activeColor="var(--color-pfc-green)"
                      className="mt-1 flex-shrink-0"
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </GlassSection>

      {/* ── Event Log (collapsible) ── */}
      <GlassSection>
        <button
          onClick={() => setShowEvents(!showEvents)}
          className="flex items-center gap-2 w-full text-left"
        >
          <ScrollTextIcon className="h-4 w-4 text-muted-foreground/50" />
          <span className="text-sm font-semibold flex-1" style={{ fontFamily: 'var(--font-heading)', fontSize: '0.625rem', fontWeight: 400 }}>Event Log</span>
          {showEvents
            ? <ChevronDownIcon className="h-4 w-4 text-muted-foreground/40" />
            : <ChevronRightIcon className="h-4 w-4 text-muted-foreground/40" />
          }
        </button>

        <AnimatePresence>
          {showEvents && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground/40 text-center py-4">
                  No events recorded yet
                </p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                  {events.map((evt) => {
                    const isError = evt.event_type === 'error' || evt.event_type === 'task_error';
                    const isComplete = evt.event_type === 'task_complete';
                    const isStart = evt.event_type === 'task_start';
                    return (
                      <div
                        key={evt.id}
                        className="flex items-start gap-2 py-1.5 border-b border-border/10 last:border-0"
                      >
                        {isError ? (
                          <XCircleIcon className="h-3 w-3 mt-0.5 text-pfc-red flex-shrink-0" />
                        ) : isComplete ? (
                          <CheckCircle2Icon className="h-3 w-3 mt-0.5 text-pfc-green flex-shrink-0" />
                        ) : isStart ? (
                          <PlayIcon className="h-3 w-3 mt-0.5 text-pfc-cyan flex-shrink-0" />
                        ) : (
                          <CircleIcon className="h-3 w-3 mt-0.5 text-muted-foreground/30 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'text-[11px] font-semibold',
                              isError ? 'text-pfc-red' : 'text-foreground/80',
                            )}>
                              {evt.task_name || evt.event_type}
                            </span>
                            <span className="text-[10px] text-muted-foreground/30">
                              {timeAgo(evt.created_at)}
                            </span>
                          </div>
                          {evt.payload && (
                            <p className="text-[10px] text-muted-foreground/50 font-mono truncate">
                              {(() => {
                                try { return JSON.parse(evt.payload).result || JSON.parse(evt.payload).error || evt.payload; }
                                catch { return evt.payload; }
                              })()}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-center mt-3">
                <GlassBubbleButton size="sm" color="neutral" onClick={fetchEvents}>
                  <RefreshCwIcon className="h-3 w-3" />
                  Refresh
                </GlassBubbleButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassSection>

      {/* ── Configuration (collapsible) ── */}
      <GlassSection>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-2 w-full text-left"
        >
          <SettingsIcon className="h-4 w-4 text-muted-foreground/50" />
          <span className="text-sm font-semibold flex-1" style={{ fontFamily: 'var(--font-heading)', fontSize: '0.625rem', fontWeight: 400 }}>Configuration</span>
          {showConfig
            ? <ChevronDownIcon className="h-4 w-4 text-muted-foreground/40" />
            : <ChevronRightIcon className="h-4 w-4 text-muted-foreground/40" />
          }
        </button>

        <AnimatePresence>
          {showConfig && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              {!isRunning ? (
                <p className="text-xs text-muted-foreground/40 text-center py-4">
                  Start the daemon to view and edit configuration
                </p>
              ) : Object.keys(config).length === 0 ? (
                <div className="flex justify-center py-4">
                  <PixelBook size={16} />
                </div>
              ) : (
                <div className="space-y-2">
                  {/* LLM Settings */}
                  <ConfigGroup title="LLM">
                    {Object.entries(config)
                      .filter(([k]) => k.startsWith('llm.'))
                      .map(([key, value]) => (
                        <ConfigRow
                          key={key}
                          label={key.replace('llm.', '')}
                          value={value}
                          onSave={(v) => handleConfigUpdate(key, v)}
                        />
                      ))}
                  </ConfigGroup>

                  {/* Task Settings */}
                  <ConfigGroup title="Tasks">
                    {Object.entries(config)
                      .filter(([k]) => k.startsWith('task.'))
                      .map(([key, value]) => (
                        <ConfigRow
                          key={key}
                          label={key.replace('task.', '')}
                          value={value}
                          onSave={(v) => handleConfigUpdate(key, v)}
                        />
                      ))}
                  </ConfigGroup>

                  {/* Other Settings */}
                  {Object.entries(config).filter(([k]) => !k.startsWith('llm.') && !k.startsWith('task.')).length > 0 && (
                    <ConfigGroup title="Other">
                      {Object.entries(config)
                        .filter(([k]) => !k.startsWith('llm.') && !k.startsWith('task.'))
                        .map(([key, value]) => (
                          <ConfigRow
                            key={key}
                            label={key}
                            value={value}
                            onSave={(v) => handleConfigUpdate(key, v)}
                          />
                        ))}
                    </ConfigGroup>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </GlassSection>

      {/* ── System Access (Phase C) ── */}
      <GlassSection
        title="System Access"
        badge={
          permissions ? (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-mono border-0',
                permissions.level === 'sandboxed' ? 'text-pfc-yellow bg-pfc-yellow/10' :
                permissions.level === 'file-access' ? 'text-pfc-green bg-pfc-green/10' :
                'text-pfc-cyan bg-pfc-cyan/10',
              )}
            >
              {permissions.level}
            </Badge>
          ) : null
        }
      >
        {!isRunning ? (
          <p className="text-xs text-muted-foreground/40 text-center py-4">
            Start the daemon to configure system access
          </p>
        ) : (
          <div className="space-y-5">
            {/* Permission tiers */}
            <div>
              <p className="text-xs text-muted-foreground/60 mb-3">
                Control what the daemon can access on your system. Higher tiers unlock filesystem and shell access.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'sandboxed', label: 'Sandboxed', desc: 'SQLite + LLM only', icon: LockIcon, color: 'yellow' as const },
                  { value: 'file-access', label: 'File Access', desc: '+ Read/write files', icon: FolderOpenIcon, color: 'green' as const },
                  { value: 'full-access', label: 'Full Access', desc: '+ Shell commands', icon: UnlockIcon, color: 'cyan' as const },
                ] as const).map((opt) => {
                  const Icon = opt.icon;
                  const isActive = permissions?.level === opt.value;
                  return (
                    <GlassBubbleButton
                      key={opt.value}
                      onClick={() => handlePermissionChange(opt.value)}
                      active={isActive}
                      color={opt.color}
                      size="lg"
                      fullWidth
                      className="flex-col"
                    >
                      <Icon style={{ height: 16, width: 16 }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{opt.label}</span>
                      <span style={{ fontSize: '0.625rem', opacity: 0.5, fontWeight: 400 }}>{opt.desc}</span>
                    </GlassBubbleButton>
                  );
                })}
              </div>
            </div>

            {/* Base directory config */}
            {permissions && permissions.level !== 'sandboxed' && (
              <div className="space-y-2 pt-3 border-t border-border/20">
                <div className="flex items-center gap-2">
                  <FolderOpenIcon className="h-4 w-4 text-muted-foreground/50" />
                  <span className="text-sm font-semibold">Base Directory</span>
                </div>
                <p className="text-xs text-muted-foreground/50">
                  All file operations are restricted to this directory. Path traversal is blocked.
                </p>
                {editingBaseDir ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={baseDirDraft}
                      onChange={(e) => setBaseDirDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleBaseDirSave(); if (e.key === 'Escape') setEditingBaseDir(false); }}
                      placeholder="/Users/you/notes"
                      autoFocus
                      className="flex-1 rounded-lg border border-border/30 bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-pfc-cyan/50"
                    />
                    <GlassBubbleButton size="sm" color="green" onClick={handleBaseDirSave}>
                      Save
                    </GlassBubbleButton>
                  </div>
                ) : (
                  <button
                    onClick={() => { setBaseDirDraft(permissions.baseDir || ''); setEditingBaseDir(true); }}
                    className="w-full text-left rounded-lg border border-border/20 bg-muted/20 px-3 py-2 text-sm font-mono text-muted-foreground/70 hover:border-border/40 transition-colors"
                  >
                    {permissions.baseDir || '(not configured — click to set)'}
                  </button>
                )}
              </div>
            )}

            {/* Capabilities */}
            {permissions && (
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/20">
                {([
                  { key: 'sqlite', label: 'SQLite' },
                  { key: 'llm', label: 'LLM' },
                  { key: 'fileRead', label: 'File Read' },
                  { key: 'fileWrite', label: 'File Write' },
                  { key: 'shell', label: 'Shell' },
                  { key: 'markdownSync', label: 'MD Sync' },
                ] as const).map(({ key, label }) => {
                  const enabled = permissions.capabilities[key];
                  return (
                    <div key={key} className="flex items-center gap-1.5">
                      <div className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        enabled ? 'bg-pfc-green' : 'bg-muted-foreground/20',
                      )} />
                      <span className={cn(
                        'text-[11px]',
                        enabled ? 'text-foreground/70' : 'text-muted-foreground/30',
                      )}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Markdown Sync actions */}
            {permissions && permissions.capabilities.markdownSync && permissions.baseDir && (
              <div className="space-y-2 pt-3 border-t border-border/20">
                <div className="flex items-center gap-2">
                  <ShieldIcon className="h-4 w-4 text-muted-foreground/50" />
                  <span className="text-sm font-semibold">Markdown Sync</span>
                </div>
                <p className="text-xs text-muted-foreground/50">
                  Export notes to markdown files with YAML frontmatter, or import .md files into your vault.
                </p>
                <div className="flex items-center gap-2">
                  <GlassBubbleButton size="sm" color="green" onClick={handleSyncExport}>
                    <DownloadIcon className="h-3 w-3" />
                    Export to Markdown
                  </GlassBubbleButton>
                  <GlassBubbleButton size="sm" color="cyan" onClick={handleSyncImport}>
                    <UploadIcon className="h-3 w-3" />
                    Import from Markdown
                  </GlassBubbleButton>
                </div>
                {syncStatus && (
                  <p className="text-xs text-pfc-cyan font-mono">{syncStatus}</p>
                )}
              </div>
            )}

            {/* Shell info */}
            {permissions?.level === 'full-access' && (
              <div className="rounded-2xl bg-pfc-cyan/5 px-4 py-3 space-y-1">
                <div className="flex items-center gap-2">
                  <TerminalIcon className="h-4 w-4 text-pfc-cyan" />
                  <span className="text-sm font-semibold text-pfc-cyan">Shell Access Active</span>
                </div>
                <p className="text-xs text-muted-foreground/60">
                  Allowlisted commands: git, rg, find, ls, cat, head, tail, wc, grep, diff, tree, stat, file, which, echo
                </p>
                <p className="text-xs text-muted-foreground/40">
                  30s timeout per command · execFile (no shell injection) · 1MB output limit
                </p>
              </div>
            )}
          </div>
        )}
      </GlassSection>

      {/* ── Agent Behavior Controls ── */}
      <GlassSection
        title="Agent Behavior"
        badge={
          isRunning ? (
            <Badge variant="outline" className="text-[10px] font-mono text-pfc-violet border-0 bg-pfc-violet/10">
              live
            </Badge>
          ) : null
        }
      >
        <p className="text-xs text-muted-foreground/60 mb-4">
          Control how the daemon&apos;s agents analyze your notes. These settings affect the analytical depth, adversarial review intensity, and reasoning style used by all agent tasks.
        </p>

        {/* Flat contained box for all controls */}
        <div
          style={{
            borderRadius: '1rem',
            padding: '1.25rem 1.5rem',
            background: isDefaultLight ? '#F5F5F5' : 'rgba(139,124,246,0.06)',
          }}
        >
          {!isRunning && !loading ? (
            <div className="text-center py-4">
              <SlidersHorizontalIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground/50">Start the daemon to configure agent behavior</p>
            </div>
          ) : (
            <div className="space-y-5">
              <AgentSlider
                label="Complexity Bias"
                description="How complex should the agents treat your content? Higher values dig deeper into second-order effects and hidden assumptions."
                configKey="agent.complexityBias"
                min={-1}
                max={1}
                step={0.1}
                defaultValue={0}
                config={config}
                onSave={handleConfigUpdate}
                formatValue={(v) => v === 0 ? 'Neutral' : v > 0 ? `+${v.toFixed(1)} (deeper)` : `${v.toFixed(1)} (simpler)`}
              />
              <AgentSlider
                label="Adversarial Intensity"
                description="How aggressively should agents challenge findings? Higher values stress-test assumptions and find counterarguments."
                configKey="agent.adversarialIntensity"
                min={0.2}
                max={3}
                step={0.1}
                defaultValue={1}
                config={config}
                onSave={handleConfigUpdate}
                formatValue={(v) => v <= 0.5 ? `${v.toFixed(1)}× (gentle)` : v >= 2 ? `${v.toFixed(1)}× (aggressive)` : `${v.toFixed(1)}×`}
              />
              <AgentSlider
                label="Bayesian Prior Strength"
                description="How much should agents weight prior knowledge? Higher values favor established findings over novel claims."
                configKey="agent.bayesianPriorStrength"
                min={0.2}
                max={3}
                step={0.1}
                defaultValue={1}
                config={config}
                onSave={handleConfigUpdate}
                formatValue={(v) => v <= 0.5 ? `${v.toFixed(1)}× (open-minded)` : v >= 2 ? `${v.toFixed(1)}× (conservative)` : `${v.toFixed(1)}×`}
              />
              <AgentSlider
                label="Focus Depth"
                description="Analysis depth per topic. Higher values explore through more analytical lenses."
                configKey="agent.focusDepth"
                min={1}
                max={10}
                step={0.5}
                defaultValue={5}
                config={config}
                onSave={handleConfigUpdate}
                formatValue={(v) => v <= 3 ? `${v.toFixed(1)} (broad)` : v >= 7 ? `${v.toFixed(1)} (very deep)` : `${v.toFixed(1)}`}
              />
              <AgentSlider
                label="Exploration Temperature"
                description="Creative vs. precise reasoning. Higher values explore unconventional perspectives."
                configKey="agent.temperature"
                min={0.1}
                max={1.0}
                step={0.05}
                defaultValue={0.6}
                config={config}
                onSave={handleConfigUpdate}
                formatValue={(v) => v <= 0.3 ? `${v.toFixed(2)} (precise)` : v >= 0.8 ? `${v.toFixed(2)} (creative)` : `${v.toFixed(2)}`}
              />

              <div style={{ paddingTop: '0.75rem', borderTop: `1px solid ${isDefaultLight ? 'rgba(0,0,0,0.04)' : 'rgba(139,124,246,0.06)'}` }}>
                <p className="text-[11px] text-muted-foreground/40">
                  These controls map to behavioral directives injected into agent prompts. When an agent task runs, it reads these values and adapts its analytical style accordingly.
                </p>
              </div>
            </div>
          )}
        </div>
      </GlassSection>

      {/* ── Guide & Explanation ── */}
      <GlassSection title="What is the Daemon?">
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground/60" style={{ fontFamily: 'var(--font-secondary)', fontWeight: 400 }}>
            The Brainiac Daemon is an autonomous agent that runs alongside the web app. It works in the background — analyzing your notes, discovering connections, running learning protocols, and organizing your knowledge — without you needing to keep a browser tab open.
          </p>

          {/* Architecture */}
          <div className="rounded-2xl bg-muted/20 px-4 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <BrainCircuitIcon className="h-4 w-4 text-pfc-cyan" />
              <span className="text-sm font-semibold">How it works</span>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground/60">
              <div className="flex items-start gap-2">
                <span className="text-pfc-cyan font-mono font-bold mt-px">1.</span>
                <span>A standalone Node.js process runs on your machine, accessing your notes database (SQLite) directly.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-pfc-cyan font-mono font-bold mt-px">2.</span>
                <span>A scheduler checks every 60 seconds for tasks that are due to run. Tasks execute one at a time so your GPU handles one LLM call at a time.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-pfc-cyan font-mono font-bold mt-px">3.</span>
                <span>Each task reads from your notes, calls your local LLM (Ollama), and writes results back as new notes or tags — all tagged <code className="font-mono bg-muted px-1 rounded">autoGenerated</code>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-pfc-cyan font-mono font-bold mt-px">4.</span>
                <span>Stop the daemon anytime. Notes are never modified destructively — the daemon only creates new content and adds metadata.</span>
              </div>
            </div>
          </div>

          {/* Setup guide */}
          <div className="rounded-2xl bg-pfc-green/5 px-4 py-4 space-y-3">
            <div className="flex items-center gap-2">
              <GraduationCapIcon className="h-4 w-4 text-pfc-green" />
              <span className="text-sm font-semibold text-pfc-green">Setup Guide</span>
            </div>
            <div className="space-y-3 text-xs text-muted-foreground/70">
              <div>
                <p className="font-semibold text-foreground/70 mb-1">Step 1 — Start Ollama</p>
                <p>The daemon needs a local LLM. Make sure Ollama is running with a model pulled:</p>
                <code className="block mt-1 font-mono bg-muted/50 px-2 py-1 rounded text-[11px]">ollama serve && ollama pull llama3.1</code>
              </div>
              <div>
                <p className="font-semibold text-foreground/70 mb-1">Step 2 — Start the Daemon</p>
                <p>Click the green <strong>Start</strong> button above. The daemon will boot and begin its task schedule.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground/70 mb-1">Step 3 — Choose your agents</p>
                <p>Toggle which tasks run in the <strong>Agent Tasks</strong> section. Each agent has a different purpose:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-muted-foreground/60">
                  <li><strong>Connection Finder</strong> — Scans your notes for cross-references and creates <code className="font-mono bg-muted px-0.5 rounded">[[links]]</code> between related pages.</li>
                  <li><strong>Daily Brief</strong> — Generates a morning summary of what changed, key insights, and suggested focus areas.</li>
                  <li><strong>Auto-Organizer</strong> — Tags untagged pages, clusters notes by topic similarity, and suggests folder structure.</li>
                  <li><strong>Research Assistant</strong> — Reads your notes for implicit questions and drafts research answers backed by your existing knowledge.</li>
                  <li><strong>Learning Protocol</strong> — Runs the 7-step recursive learning engine: inventory, gap-analysis, deep-dive, cross-reference, synthesis, questions, iterate.</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-foreground/70 mb-1">Step 4 — Configure intervals</p>
                <p>Open the <strong>Configuration</strong> panel to adjust how often each task runs. Default intervals are conservative — bump them up once you trust the output quality.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground/70 mb-1">Step 5 — Set permissions (optional)</p>
                <p>By default the daemon is sandboxed (SQLite + LLM only). For filesystem sync (exporting notes as markdown), grant <strong>File Access</strong> and set a base directory.</p>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider">FAQ</p>
            <div className="space-y-2 text-xs text-muted-foreground/60">
              <div>
                <p className="font-semibold text-foreground/60">Does it use my API keys?</p>
                <p>No. The daemon uses your local Ollama instance. Configure the model in the Configuration panel (default: llama3.1).</p>
              </div>
              <div>
                <p className="font-semibold text-foreground/60">Can it delete my notes?</p>
                <p>Never. The daemon only creates new pages, adds tags, and creates links. It never modifies or deletes existing content.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground/60">What about resource usage?</p>
                <p>Tasks run sequentially (not in parallel), so GPU usage stays within a single inference at a time. CPU and memory impact is minimal.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground/60">It says an agent is running but I didn&apos;t start one?</p>
                <p>The daemon auto-starts previously enabled tasks from its last session. Open Agent Tasks and disable any you don&apos;t want. If you never started the daemon, this is a stale status — click Stop then Start to reset.</p>
              </div>
            </div>
          </div>
        </div>
      </GlassSection>
    </PageShell>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function ConfigGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-semibold mb-1">
        {title}
      </p>
      {children}
    </div>
  );
}

function ConfigRow({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = () => {
    if (draft !== value) onSave(draft);
    setEditing(false);
  };

  // For boolean values, render as toggle
  if (value === 'true' || value === 'false') {
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-xs text-muted-foreground/70 font-mono">{label}</span>
        <Switch
          checked={value === 'true'}
          onCheckedChange={(v) => onSave(v ? 'true' : 'false')}
          size="sm"
          activeColor="var(--color-pfc-green)"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-1.5 gap-3">
      <span className="text-xs text-muted-foreground/70 font-mono flex-shrink-0">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
            onBlur={handleSave}
            autoFocus
            className="w-32 rounded-lg border border-border/30 bg-background px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-pfc-cyan/50"
          />
        </div>
      ) : (
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          className="text-xs font-mono text-foreground/60 hover:text-foreground/90 transition-colors truncate max-w-[200px]"
        >
          {value}
        </button>
      )}
    </div>
  );
}

// ── Agent Behavior Slider ─────────────────────────────────────────

function AgentSlider({
  label,
  description,
  configKey,
  min,
  max,
  step,
  defaultValue,
  config,
  onSave,
  formatValue,
}: {
  label: string;
  description: string;
  configKey: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  config: Record<string, string>;
  onSave: (key: string, value: string) => void;
  formatValue: (v: number) => string;
}) {
  const currentValue = config[configKey] != null ? parseFloat(config[configKey]) : defaultValue;
  const displayValue = isNaN(currentValue) ? defaultValue : currentValue;
  const isDefault = Math.abs(displayValue - defaultValue) < step * 0.5;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground/80">{label}</p>
          <p className="text-[10px] text-muted-foreground/40">{description}</p>
        </div>
        <span className={cn(
          'text-[11px] font-mono whitespace-nowrap ml-3',
          isDefault ? 'text-muted-foreground/40' : 'text-pfc-violet',
        )}>
          {formatValue(displayValue)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={displayValue}
          onChange={(e) => onSave(configKey, e.target.value)}
          className="flex-1 h-1.5 appearance-none bg-muted/40 rounded-full cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pfc-violet [&::-webkit-slider-thumb]:shadow-sm
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background"
        />
        {!isDefault && (
          <button
            onClick={() => onSave(configKey, String(defaultValue))}
            className="text-[9px] text-muted-foreground/40 hover:text-foreground/60 transition-colors"
          >
            reset
          </button>
        )}
      </div>
    </div>
  );
}
