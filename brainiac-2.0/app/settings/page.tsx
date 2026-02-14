'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SettingsIcon,
  BrainCircuitIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  Trash2Icon,
  ServerIcon,
  CpuIcon,
  CloudIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ExternalLinkIcon,
  HardDriveIcon,
  RefreshCwIcon,
  CopyIcon,
  GaugeIcon,
  CircleIcon,
  ZapIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  SmartphoneIcon,
  SparklesIcon,
  ImageIcon,
  CloudSunIcon,
  BookOpenIcon,
  DownloadIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ActivityIcon,
  MessageSquareIcon,
  BrainIcon,
  NetworkIcon,
  PackageIcon,
} from 'lucide-react';
import type { OllamaHardwareStatus } from '@/lib/engine/llm/ollama';
import { formatBytes } from '@/lib/engine/llm/ollama';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { exportData, downloadExport, getMimeType } from '@/lib/research/export';
import type { ExportFormat, ExportDataType } from '@/lib/research/types';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { readString, writeString } from '@/lib/storage-versioning';
import { cn } from '@/lib/utils';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { OPENAI_MODELS, ANTHROPIC_MODELS, GOOGLE_MODELS } from '@/lib/engine/llm/config';
import type { InferenceMode, ApiProvider, OpenAIModel, AnthropicModel, GoogleModel } from '@/lib/engine/llm/config';
import { getSOARLimitations } from '@/lib/engine/soar/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GlassBubbleButton } from '@/components/chat/glass-bubble-button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PageShell, GlassSection } from '@/components/layout/page-shell';
import { PixelBook } from '@/components/pixel-book';

const MODE_OPTIONS: {
  value: InferenceMode;
  label: string;
  description: string;
  icon: typeof CpuIcon;
  color: string;
  activeBorder: string;
}[] = [
  { value: 'api', label: 'API Mode', description: 'Cloud LLM', icon: CloudIcon, color: 'text-pfc-violet', activeBorder: 'border-pfc-violet/50 bg-pfc-violet/5' },
  { value: 'local', label: 'Local', description: 'Ollama', icon: ServerIcon, color: 'text-pfc-green', activeBorder: 'border-pfc-green/50 bg-pfc-green/5' },
];

export default function SettingsPage() {
  const ready = useSetupGuard();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [systemAuto, setSystemAuto] = useState(false);
  const [systemDarkVariant, setSystemDarkVariant] = useState<string>('dark');
  const [systemLightVariant, setSystemLightVariant] = useState<string>('light');

  const inferenceMode = usePFCStore((s) => s.inferenceMode);
  const setInferenceMode = usePFCStore((s) => s.setInferenceMode);
  const apiProvider = usePFCStore((s) => s.apiProvider);
  const setApiProvider = usePFCStore((s) => s.setApiProvider);
  const apiKey = usePFCStore((s) => s.apiKey);
  const setApiKey = usePFCStore((s) => s.setApiKey);
  const openaiModel = usePFCStore((s) => s.openaiModel);
  const setOpenAIModel = usePFCStore((s) => s.setOpenAIModel);
  const anthropicModel = usePFCStore((s) => s.anthropicModel);
  const setAnthropicModel = usePFCStore((s) => s.setAnthropicModel);
  const googleModel = usePFCStore((s) => s.googleModel);
  const setGoogleModel = usePFCStore((s) => s.setGoogleModel);
  const ollamaBaseUrl = usePFCStore((s) => s.ollamaBaseUrl);
  const setOllamaBaseUrl = usePFCStore((s) => s.setOllamaBaseUrl);
  const ollamaModel = usePFCStore((s) => s.ollamaModel);
  const setOllamaModel = usePFCStore((s) => s.setOllamaModel);
  const ollamaAvailable = usePFCStore((s) => s.ollamaAvailable);
  const ollamaModels = usePFCStore((s) => s.ollamaModels);
  const setOllamaStatus = usePFCStore((s) => s.setOllamaStatus);
  const ollamaHardware = usePFCStore((s) => s.ollamaHardware);
  const setOllamaHardware = usePFCStore((s) => s.setOllamaHardware);
  const reset = usePFCStore((s) => s.reset);
  const soarConfig = usePFCStore((s) => s.soarConfig);
  const setSOARConfig = usePFCStore((s) => s.setSOARConfig);
  const setSOAREnabled = usePFCStore((s) => s.setSOAREnabled);
  const analyticsEngineEnabled = usePFCStore((s) => s.analyticsEngineEnabled);
  const setAnalyticsEngineEnabled = usePFCStore((s) => s.setAnalyticsEngineEnabled);

  const soarLimitations = getSOARLimitations(inferenceMode);

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [ollamaChecking, setOllamaChecking] = useState(false);
  const [hwLoading, setHwLoading] = useState(false);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // ── Export state ──
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const [selectedData, setSelectedData] = useState<ExportDataType>('all');
  const [exported, setExported] = useState(false);

  const signals = usePFCStore((s) => s.signalHistory);
  const papers = usePFCStore((s) => s.researchPapers);
  const messages = usePFCStore((s) => s.messages);
  const cortexArchive = usePFCStore((s) => s.cortexArchive);

  const handleExport = useCallback(() => {
    const content = exportData(selectedFormat, selectedData, {
      signals,
      papers,
      chatHistory: messages,
      cortexSnapshots: cortexArchive,
    });
    const ext =
      selectedFormat === 'bibtex' ? 'bib' :
      selectedFormat === 'ris' ? 'ris' :
      selectedFormat;
    downloadExport(
      content,
      `pfc-export-${selectedData}-${new Date().toISOString().slice(0, 10)}.${ext}`,
      getMimeType(selectedFormat),
    );
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  }, [selectedFormat, selectedData, signals, papers, messages, cortexArchive]);

  useEffect(() => {
    setMounted(true);
    // Load system auto-theme settings
    setSystemAuto(readString('pfc-system-auto') === 'true');
    const storedVariant = readString('pfc-system-dark-variant');
    if (storedVariant && ['dark', 'cosmic', 'sunset', 'oled'].includes(storedVariant)) {
      setSystemDarkVariant(storedVariant);
    }
    const storedLightVariant = readString('pfc-system-light-variant');
    if (storedLightVariant && ['light', 'sunny'].includes(storedLightVariant)) {
      setSystemLightVariant(storedLightVariant);
    }
    const storedKey = readString('pfc-api-key') || '';
    if (storedKey && !apiKey) setApiKey(storedKey);
    const storedMode = readString('pfc-inference-mode') as InferenceMode;
    if (storedMode && storedMode !== inferenceMode) setInferenceMode(storedMode);
    const storedProvider = readString('pfc-api-provider') as ApiProvider;
    if (storedProvider) setApiProvider(storedProvider);
    const storedOllamaUrl = readString('pfc-ollama-url');
    if (storedOllamaUrl) setOllamaBaseUrl(storedOllamaUrl);
    const storedOllamaModel = readString('pfc-ollama-model');
    if (storedOllamaModel) setOllamaModel(storedOllamaModel);
    // SAFETY: One-time mount hydration from localStorage. All setters are stable
    // Zustand actions. Re-running would overwrite user changes made after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (inferenceMode === 'local') checkOllama();
    // SAFETY: checkOllama identity changes when ollamaBaseUrl changes; adding it
    // here would double-trigger checks. This effect only fires on mode switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inferenceMode]);

  const handleModeChange = (mode: InferenceMode) => {
    setInferenceMode(mode);
    writeString('pfc-inference-mode', mode);
    setTestStatus('idle');
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    writeString('pfc-api-key', value);
    setTestStatus('idle');
  };

  const handleProviderChange = (provider: ApiProvider) => {
    setApiProvider(provider);
    writeString('pfc-api-provider', provider);
    setTestStatus('idle');
  };

  const handleOllamaUrlChange = (url: string) => {
    // Sanitize: trim whitespace and remove trailing slash
    const cleaned = url.trim().replace(/\/+$/, '');
    setOllamaBaseUrl(cleaned);
    writeString('pfc-ollama-url', cleaned);
  };

  const isValidOllamaUrl = (url: string): boolean => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleOllamaModelChange = (model: string) => {
    setOllamaModel(model);
    writeString('pfc-ollama-model', model);
  };

  const checkOllama = useCallback(async () => {
    setOllamaChecking(true);
    try {
      const res = await fetch(`/api/ollama-check?baseUrl=${encodeURIComponent(ollamaBaseUrl)}`);
      const data = await res.json();
      setOllamaStatus(data.available, data.models || []);
      if (data.available && data.models?.length > 0 && !ollamaModel) {
        handleOllamaModelChange(data.models[0]);
      }
    } catch { setOllamaStatus(false, []); }
    finally { setOllamaChecking(false); }
    // SAFETY: ollamaModel and handleOllamaModelChange are read at call-time, not
    // as reactive triggers. Zustand setters (setOllamaStatus, setOllamaChecking)
    // are stable. Only ollamaBaseUrl should cause a re-check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ollamaBaseUrl]);

  const fetchHardwareStatus = useCallback(async () => {
    setHwLoading(true);
    try {
      const res = await fetch(`/api/ollama-status?baseUrl=${encodeURIComponent(ollamaBaseUrl)}`);
      const data: OllamaHardwareStatus = await res.json();
      setOllamaHardware(data);
    } catch { setOllamaHardware(null); }
    finally { setHwLoading(false); }
    // SAFETY: Zustand setters (setOllamaHardware, setHwLoading) are stable.
    // Only ollamaBaseUrl should trigger a re-fetch of hardware status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ollamaBaseUrl]);

  useEffect(() => {
    if (inferenceMode === 'local' && ollamaAvailable) fetchHardwareStatus();
    // SAFETY: fetchHardwareStatus is a stable callback (deps: [ollamaBaseUrl]).
    // This effect should only fire when availability or mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ollamaAvailable, inferenceMode]);

  const copyToClipboard = (text: string, varName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVar(varName);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const testConnection = async () => {
    setTestStatus('testing');
    setTestError('');
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: inferenceMode, provider: apiProvider, apiKey, openaiModel, anthropicModel, googleModel, ollamaBaseUrl, ollamaModel }),
      });
      const data = await res.json();
      if (data.success) setTestStatus('success');
      else { setTestStatus('error'); setTestError(data.error || 'Connection failed'); }
    } catch (err) {
      setTestStatus('error');
      setTestError(err instanceof Error ? err.message : 'Network error');
    }
  };

  const handleReset = () => {
    localStorage.clear();
    reset();
    router.push('/onboarding');
  };

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--chat-surface)]">
        <PixelBook size={40} />
      </div>
    );
  }

  return (
    <PageShell icon={SettingsIcon} iconColor="var(--color-pfc-ember)" title="Settings" subtitle="Configure inference, appearance, and system options">
      <div className="space-y-6">
        {/* Inference Mode */}
        <GlassSection title="Inference Mode">
          <p className="text-sm text-muted-foreground/60 mb-5" style={{ fontFamily: 'var(--font-secondary)', fontWeight: 400 }}>
            Choose how Brainiac processes queries. API mode connects to cloud LLMs; Local uses Ollama for private inference.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-5">
            {MODE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = inferenceMode === opt.value;
              const colorMap: Record<string, 'ember' | 'violet' | 'green'> = { 'text-pfc-ember': 'ember', 'text-pfc-violet': 'violet', 'text-pfc-green': 'green' };
              return (
                <GlassBubbleButton
                  key={opt.value}
                  onClick={() => handleModeChange(opt.value)}
                  active={isActive}
                  color={colorMap[opt.color] || 'neutral'}
                  size="lg"
                  fullWidth
                  className="flex-col"
                >
                  <Icon style={{ height: 20, width: 20 }} />
                  <span style={{ fontFamily: 'var(--font-secondary)', fontSize: '0.625rem', fontWeight: 500 }}>{opt.label}</span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 400, fontFamily: 'var(--font-secondary)' }}>{opt.description}</span>
                </GlassBubbleButton>
              );
            })}
          </div>

          {/* API sub-panel */}
          <AnimatePresence>
            {inferenceMode === 'api' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 pt-4 border-t border-border/20" style={{ overflow: 'hidden', transform: 'translateZ(0)' }}>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground mb-2 block">Provider</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'openai' as const, label: 'OpenAI', hint: 'GPT-5.3' },
                      { value: 'anthropic' as const, label: 'Anthropic', hint: 'Claude' },
                      { value: 'google' as const, label: 'Google', hint: 'Gemini' },
                    ]).map((p) => (
                      <GlassBubbleButton
                        key={p.value}
                        onClick={() => handleProviderChange(p.value)}
                        active={apiProvider === p.value}
                        color="violet"
                        fullWidth
                        className="flex-col"
                      >
                        <span style={{ fontFamily: 'var(--font-secondary)', fontSize: '0.5625rem', fontWeight: 500 }}>{p.label}</span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 400, fontFamily: 'var(--font-secondary)' }}>{p.hint}</span>
                      </GlassBubbleButton>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground mb-2 block">Model</label>
                  <select value={apiProvider === 'openai' ? openaiModel : apiProvider === 'google' ? googleModel : anthropicModel} onChange={(e) => { if (apiProvider === 'openai') setOpenAIModel(e.target.value as OpenAIModel); else if (apiProvider === 'google') setGoogleModel(e.target.value as GoogleModel); else setAnthropicModel(e.target.value as AnthropicModel); }} className="w-full rounded-full border border-border/30 bg-background px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-pfc-violet/50">
                    {(apiProvider === 'openai' ? OPENAI_MODELS : apiProvider === 'google' ? GOOGLE_MODELS : ANTHROPIC_MODELS).map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground mb-2 block">API Key</label>
                  <Input type="password" placeholder={apiProvider === 'openai' ? 'sk-...' : apiProvider === 'google' ? 'AIza...' : 'sk-ant-...'} value={apiKey} onChange={(e) => handleApiKeyChange(e.target.value)} className="font-mono text-sm rounded-xl" />
                  <div className="flex items-center gap-2 mt-1.5">
                    <p className="text-xs text-muted-foreground/50">Stored locally. Never sent to our servers.</p>
                    <a
                      href={apiProvider === 'openai' ? 'https://platform.openai.com/api-keys' : apiProvider === 'google' ? 'https://aistudio.google.com/apikey' : 'https://console.anthropic.com/settings/keys'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-pfc-violet hover:underline whitespace-nowrap"
                    >
                      Get API Key <ExternalLinkIcon className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <GlassBubbleButton size="sm" color="violet" onClick={testConnection} disabled={!apiKey || testStatus === 'testing'}>
                    {testStatus === 'testing' && <PixelBook size={14} />}
                    Test Connection
                  </GlassBubbleButton>
                  {testStatus === 'success' && <span className="flex items-center gap-1 text-xs text-pfc-green"><CheckCircle2Icon className="h-3.5 w-3.5" />Connected</span>}
                  {testStatus === 'error' && <span className="flex items-center gap-1 text-xs text-pfc-red"><XCircleIcon className="h-3.5 w-3.5" />{testError || 'Failed'}</span>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Local (Ollama) sub-panel */}
          <AnimatePresence>
            {inferenceMode === 'local' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 pt-4 border-t border-border/20" style={{ overflow: 'hidden', transform: 'translateZ(0)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-2 w-2 rounded-full', ollamaChecking ? 'bg-pfc-yellow animate-pulse' : ollamaAvailable ? 'bg-pfc-green' : 'bg-pfc-red')} />
                    <span className="text-sm text-muted-foreground">{ollamaChecking ? 'Checking...' : ollamaAvailable ? `Ollama running (${ollamaModels.length} models)` : 'Ollama not detected'}</span>
                  </div>
                  <GlassBubbleButton size="sm" color="green" onClick={checkOllama} disabled={ollamaChecking || !isValidOllamaUrl(ollamaBaseUrl)}>{ollamaChecking ? <PixelBook size={14} /> : 'Check'}</GlassBubbleButton>
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground mb-2 block">Ollama URL</label>
                  <Input type="url" placeholder="http://localhost:11434" value={ollamaBaseUrl} onChange={(e) => handleOllamaUrlChange(e.target.value)} className={`font-mono text-sm rounded-xl ${ollamaBaseUrl && !isValidOllamaUrl(ollamaBaseUrl) ? 'border-pfc-red/50 focus:ring-pfc-red/50' : ''}`} />
                  {ollamaBaseUrl && !isValidOllamaUrl(ollamaBaseUrl) && (
                    <p className="text-xs text-pfc-red/70 mt-1">URL must start with http:// or https://</p>
                  )}
                </div>
                {ollamaAvailable && ollamaModels.length > 0 && (
                  <div>
                    <label className="text-sm font-semibold text-muted-foreground mb-2 block">Model</label>
                    <select value={ollamaModel} onChange={(e) => handleOllamaModelChange(e.target.value)} className="w-full rounded-xl border border-border/30 bg-background px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-pfc-green/50">
                      {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                )}
                {!ollamaAvailable && !ollamaChecking && (
                  <div className="rounded-2xl bg-muted/20 px-4 py-3 text-sm text-muted-foreground space-y-1">
                    <p>Ollama is not running. To use local models:</p>
                    <ol className="list-decimal list-inside space-y-0.5 text-xs text-muted-foreground/60">
                      <li>Install from <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-pfc-green hover:underline inline-flex items-center gap-0.5">ollama.com <ExternalLinkIcon className="h-2.5 w-2.5" /></a></li>
                      <li>Run <code className="font-mono bg-muted px-1 rounded">ollama serve</code></li>
                      <li>Pull a model: <code className="font-mono bg-muted px-1 rounded">ollama pull llama3.1</code></li>
                    </ol>
                  </div>
                )}
                {ollamaAvailable && (
                  <>
                    <div className="flex items-center gap-3">
                      <GlassBubbleButton size="sm" color="green" onClick={testConnection} disabled={testStatus === 'testing'}>
                        {testStatus === 'testing' && <PixelBook size={14} />}Test Inference
                      </GlassBubbleButton>
                      {testStatus === 'success' && <span className="flex items-center gap-1 text-xs text-pfc-green"><CheckCircle2Icon className="h-3.5 w-3.5" />Working</span>}
                      {testStatus === 'error' && <span className="flex items-center gap-1 text-xs text-pfc-red"><XCircleIcon className="h-3.5 w-3.5" />{testError || 'Failed'}</span>}
                    </div>

                    {/* Hardware Status */}
                    <div className="pt-4 border-t border-border/20 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HardDriveIcon className="h-4 w-4 text-pfc-cyan" />
                          <span className="text-sm font-semibold">Hardware</span>
                        </div>
                        <GlassBubbleButton size="sm" color="cyan" onClick={fetchHardwareStatus} disabled={hwLoading}>
                          {hwLoading ? <PixelBook size={14} /> : <RefreshCwIcon className="h-3 w-3" />}
                        </GlassBubbleButton>
                      </div>
                      {ollamaHardware?.gpu && (
                        <div className="rounded-2xl bg-pfc-green/5 p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-pfc-green">GPU Detected</span>
                            <Badge variant="secondary" className="text-[10px] bg-pfc-green/10 text-pfc-green border-0">{ollamaHardware.gpu.name}</Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>VRAM</span>
                            <span className="font-mono">{formatBytes(ollamaHardware.gpu.vramUsed)} / {formatBytes(ollamaHardware.gpu.vramTotal)}</span>
                          </div>
                          <Progress value={Math.round((ollamaHardware.gpu.vramUsed / ollamaHardware.gpu.vramTotal) * 100)} className="h-1.5 [&>div]:bg-pfc-green" />
                        </div>
                      )}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <GaugeIcon className="h-3 w-3 text-muted-foreground/50" />
                          <span className="text-xs font-semibold text-muted-foreground/50">Running Models</span>
                        </div>
                        {(!ollamaHardware || ollamaHardware.running.length === 0) ? (
                          <p className="text-xs text-muted-foreground/40 text-center py-2">No models loaded</p>
                        ) : (
                          <div className="space-y-2">
                            {ollamaHardware.running.map((m) => {
                              const expiresIn = m.expiresAt ? Math.max(0, Math.round((new Date(m.expiresAt).getTime() - Date.now()) / 1000)) : 0;
                              return (
                                <div key={m.name} className="rounded-xl bg-muted/20 p-3 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-mono font-semibold">{m.name}</span>
                                    <CircleIcon className="h-2 w-2 fill-pfc-green text-pfc-green" />
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground/50">
                                    <span>Params: <span className="font-mono text-foreground/70">{m.paramSize} ({m.quantization})</span></span>
                                    <span>VRAM: <span className="font-mono text-foreground/70">{formatBytes(m.vramUsage)}</span></span>
                                    {expiresIn > 0 && <span>Unloads: <span className="font-mono text-pfc-yellow">{Math.floor(expiresIn / 60)}m</span></span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </GlassSection>

        {/* Analytics Engine */}
        <GlassSection title="Analytics Engine">
          <p className="text-sm text-muted-foreground/60 mb-5" style={{ fontFamily: 'var(--font-secondary)', fontWeight: 400 }}>
            Controls the research analytics pipeline: signal generation (confidence, entropy, dissonance), structural complexity analysis, steering directive composition, and SOAR meta-reasoning. The pipeline uses structured prompt templates encoding mathematical frameworks (Bradford Hill, Cohen's d, DerSimonian-Laird, Bayesian updating) to guide LLM reasoning. Disable this to use the app as a pure chat + notes tool without analytical overhead.
          </p>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center h-8 w-8 rounded-full bg-pfc-ember/10">
                <ActivityIcon className="h-4 w-4 text-pfc-ember" />
              </span>
              <div>
                <p className="text-sm font-semibold" style={{ fontFamily: 'var(--font-secondary)', fontSize: '0.5625rem', fontWeight: 500 }}>Analytics Engine</p>
                <p className="text-xs text-muted-foreground/50">Signal computation, steering, SOAR</p>
              </div>
            </div>
            <Switch
              checked={analyticsEngineEnabled}
              onCheckedChange={(v) => setAnalyticsEngineEnabled(!!v)}
              activeColor="var(--color-pfc-green)"
            />
          </div>

          <AnimatePresence>
            {!analyticsEngineEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl bg-pfc-yellow/5 px-4 py-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangleIcon className="h-4 w-4 text-pfc-yellow" />
                  <span className="text-sm font-semibold text-pfc-yellow">Analytics Disabled</span>
                </div>
                <p className="text-xs text-muted-foreground/60">
                  Signal computation, steering directives, and SOAR meta-reasoning are all disabled. The AI chat will still work but without analytical pipeline processing — responses will not include confidence scores, evidence grades, or epistemic tags.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {analyticsEngineEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 text-xs text-muted-foreground/50"
              >
                <p className="font-semibold text-foreground/60 text-[11px]">What the analytics engine does:</p>
                <ul className="space-y-1.5 pl-3">
                  <li className="flex items-start gap-2"><span className="text-pfc-green mt-0.5">●</span> <span><strong>Signal Generation</strong> — Heuristic functions of query properties (domain, complexity, entity count) producing confidence, entropy, dissonance, risk, and health. Formula: <code className="font-mono bg-muted px-1 rounded text-[10px]">healthScore = 1 - entropy×0.45 - dissonance×0.35</code></span></li>
                  <li className="flex items-start gap-2"><span className="text-pfc-cyan mt-0.5">●</span> <span><strong>Structural Complexity</strong> — Heuristic structural metrics derived from entity count and complexity, providing useful relative rankings for query categorization and analytical depth scaling.</span></li>
                  <li className="flex items-start gap-2"><span className="text-pfc-violet mt-0.5">●</span> <span><strong>Steering Directives</strong> — Translates your control settings (complexity bias, adversarial intensity, Bayesian prior strength) into behavioral instructions injected into the LLM system prompt. This is the bridge between slider controls and actual LLM behavior.</span></li>
                  <li className="flex items-start gap-2"><span className="text-pfc-ember mt-0.5">●</span> <span><strong>SOAR Meta-Reasoning</strong> — Self-Optimizing Analytical Reasoning loop that detects hard queries and generates stepping-stone curricula. Uses heuristic difficulty estimation + LLM-powered curriculum generation.</span></li>
                </ul>
                <div className="mt-3 rounded-lg bg-muted/30 px-3 py-2.5">
                  <p className="font-semibold text-foreground/60 text-[10px] mb-1.5">Computation honesty note</p>
                  <p className="text-[10px] text-muted-foreground/50 leading-relaxed">
                    Signals are <strong>heuristic</strong> — hand-tuned formulas responding to query properties and your steering settings. They are not calibrated probabilities or information-theoretic measures. In <strong>API/Local mode</strong>, the prompt-composer translates signals into behavioral LLM directives and structured analytical frameworks (Bradford Hill criteria, Cohen's d scale, DerSimonian-Laird concepts, Bayesian updating) — so they genuinely influence output quality and analytical rigor. The <strong>steering engine</strong> (3-layer hybrid: contrastive vectors + Bayesian priors + k-NN recall) uses real linear algebra.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassSection>

        {/* SOAR Meta-Reasoning */}
        <GlassSection title="SOAR Meta-Reasoning">
          <p className="text-sm text-muted-foreground/60 mb-5">
            Self-Organized Analytical Reasoning. When queries hit the edge of learnability, SOAR generates a curriculum of stepping-stone problems to build reasoning scaffolding before re-attacking the hard problem.
          </p>

          {/* Master toggle */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center h-8 w-8 rounded-full bg-pfc-cyan/10">
                <BrainCircuitIcon className="h-4 w-4 text-pfc-cyan" />
              </span>
              <div>
                <p className="text-sm font-semibold" style={{ fontFamily: 'var(--font-secondary)', fontSize: '0.5625rem', fontWeight: 500 }}>Enable SOAR</p>
                <p className="text-xs text-muted-foreground/50">Teacher-student meta-reasoning loop</p>
              </div>
            </div>
            <Switch
              checked={soarConfig.enabled}
              onCheckedChange={(v) => setSOAREnabled(!!v)}
              activeColor="var(--color-pfc-cyan)"
            />
          </div>

          <AnimatePresence>
            {soarConfig.enabled && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-5 pt-4 border-t border-border/20" style={{ overflow: 'hidden', transform: 'translateZ(0)' }}>

                {/* Mode-specific limitations panel */}
                <div className={cn(
                  'rounded-2xl p-4 space-y-3',
                  inferenceMode === 'local' ? 'bg-pfc-green/5' :
                  'bg-pfc-violet/5',
                )}>
                  <div className="flex items-center gap-2">
                    <AlertTriangleIcon className="h-4 w-4 text-pfc-yellow" />
                    <span className="text-sm font-semibold">
                      {inferenceMode === 'local' ? 'Local Mode' : 'API Mode'} — SOAR Characteristics
                    </span>
                  </div>

                  {/* Advantages */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheckIcon className="h-3 w-3 text-pfc-green" />
                      <span className="text-xs font-semibold text-pfc-green">Advantages</span>
                    </div>
                    {soarLimitations.advantages.map((adv, i) => (
                      <p key={i} className="text-xs text-muted-foreground/70 pl-4.5 leading-relaxed">{adv}</p>
                    ))}
                  </div>

                  {/* Limitations */}
                  <div className="space-y-1.5 pt-2 border-t border-border/10">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangleIcon className="h-3 w-3 text-pfc-yellow" />
                      <span className="text-xs font-semibold text-pfc-yellow">Limitations</span>
                    </div>
                    {soarLimitations.limitations.map((lim, i) => (
                      <p key={i} className="text-xs text-muted-foreground/70 pl-4.5 leading-relaxed">{lim}</p>
                    ))}
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/10">
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground/80">{soarLimitations.maxIterations}</p>
                      <p className="text-[10px] text-muted-foreground/50">Max Iterations</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground/80">{soarLimitations.maxStonesPerCurriculum}</p>
                      <p className="text-[10px] text-muted-foreground/50">Stones/Curriculum</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-semibold text-foreground/80">{soarLimitations.estimatedCostPerIteration}</p>
                      <p className="text-[10px] text-muted-foreground/50">Cost/Iteration</p>
                    </div>
                  </div>
                </div>

                {/* Auto-detect toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <SearchIcon className="h-4 w-4 text-muted-foreground/50" />
                    <div>
                      <p className="text-sm font-semibold">Auto-detect Edge of Learnability</p>
                      <p className="text-xs text-muted-foreground/50">Automatically probe query difficulty before engaging SOAR</p>
                    </div>
                  </div>
                  <Switch
                    checked={soarConfig.autoDetect}
                    onCheckedChange={(v) => setSOARConfig({ autoDetect: !!v })}
                    activeColor="var(--color-pfc-cyan)"
                  />
                </div>

                {/* Contradiction detection toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ZapIcon className="h-4 w-4 text-muted-foreground/50" />
                    <div>
                      <p className="text-sm font-semibold">OOLONG Contradiction Detection</p>
                      <p className="text-xs text-muted-foreground/50">O(n&sup2;) cross-reference of claims to surface hidden contradictions</p>
                    </div>
                  </div>
                  <Switch
                    checked={soarConfig.contradictionDetection}
                    onCheckedChange={(v) => setSOARConfig({ contradictionDetection: !!v })}
                    activeColor="var(--color-pfc-cyan)"
                  />
                </div>

                {/* Numerical config */}
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/20">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Max Iterations</label>
                    <select
                      value={soarConfig.maxIterations}
                      onChange={(e) => setSOARConfig({ maxIterations: Number(e.target.value) })}
                      className="w-full rounded-xl border border-border/30 bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-pfc-cyan/50"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n} disabled={n > soarLimitations.maxIterations}>
                          {n}{n > soarLimitations.maxIterations ? ` (exceeds ${inferenceMode} limit)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Stones per Curriculum</label>
                    <select
                      value={soarConfig.stonesPerCurriculum}
                      onChange={(e) => setSOARConfig({ stonesPerCurriculum: Number(e.target.value) })}
                      className="w-full rounded-xl border border-border/30 bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-pfc-cyan/50"
                    >
                      {[2, 3, 4, 5].map((n) => (
                        <option key={n} value={n} disabled={n > soarLimitations.maxStonesPerCurriculum}>
                          {n}{n > soarLimitations.maxStonesPerCurriculum ? ` (exceeds ${inferenceMode} limit)` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Verbose toggle */}
                <div className="flex items-center justify-between pt-3 border-t border-border/20">
                  <div className="flex items-center gap-3">
                    <SlidersHorizontalIcon className="h-4 w-4 text-muted-foreground/50" />
                    <div>
                      <p className="text-sm font-semibold">Verbose Logging</p>
                      <p className="text-xs text-muted-foreground/50">Show detailed SOAR progress in pipeline view</p>
                    </div>
                  </div>
                  <Switch
                    checked={soarConfig.verbose}
                    onCheckedChange={(v) => setSOARConfig({ verbose: !!v })}
                    activeColor="var(--color-pfc-cyan)"
                  />
                </div>

                {/* Learning persistence note */}
                <div className="rounded-xl bg-muted/20 p-3 text-xs text-muted-foreground/50 leading-relaxed">
                  <span className="font-semibold text-foreground/60">Learning persistence: </span>
                  {soarLimitations.learningPersistence === 'in-context' && 'In-context only — the model improves within a single conversation but forgets between sessions. This is prompt-engineering, not true learning.'}
                  {soarLimitations.learningPersistence === 'session' && 'Session-level — accumulated reasoning context persists across SOAR iterations within a session but resets between sessions.'}
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </GlassSection>

        {/* Appearance */}
        <GlassSection title="Appearance">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-8">
            {([
              { value: 'light', label: 'White', Icon: SunIcon },
              { value: 'sunny', label: 'Sunny', Icon: CloudSunIcon },
              { value: 'dark', label: 'Ember', Icon: MoonIcon },
              { value: 'cosmic', label: 'Cosmic', Icon: SparklesIcon },
              { value: 'sunset', label: 'Sunset', Icon: ImageIcon },
              { value: 'oled', label: 'Black', Icon: SmartphoneIcon },
              { value: 'system', label: 'System', Icon: MonitorIcon },
            ] as const).map(({ value, label, Icon }) => {
              const isSystem = value === 'system';
              const isActive = mounted && (isSystem ? systemAuto : (!systemAuto && theme === value));
              return (
                <GlassBubbleButton
                  key={value}
                  onClick={() => {
                    if (isSystem) {
                      // Enable system auto mode
                      writeString('pfc-system-auto', 'true');
                      setSystemAuto(true);
                      // Apply immediately
                      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                      const darkV = readString('pfc-system-dark-variant') || 'dark';
                      const lightV = readString('pfc-system-light-variant') || 'light';
                      setTheme(prefersDark ? darkV : lightV);
                      window.dispatchEvent(new CustomEvent('pfc-system-theme-update'));
                    } else {
                      // Disable system auto mode, apply direct theme
                      writeString('pfc-system-auto', 'false');
                      setSystemAuto(false);
                      setTheme(value);
                    }
                  }}
                  active={isActive}
                  color="ember"
                  size="lg"
                  fullWidth
                  className="flex-col"
                >
                  <Icon style={{ height: 20, width: 20 }} />
                  <span style={{ fontFamily: 'var(--font-secondary)', fontSize: '0.5625rem', fontWeight: 500 }}>{label}</span>
                </GlassBubbleButton>
              );
            })}
          </div>

          {/* System dark variant picker — shown when system auto is active */}
          <AnimatePresence>
            {mounted && systemAuto && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <p className="text-xs text-muted-foreground/60 mt-3 mb-2">
                  When your system is in dark mode, use:
                </p>
                <div className="grid grid-cols-4 gap-2" style={{ maxWidth: '28rem' }}>
                  {([
                    { value: 'dark', label: 'Ember', Icon: MoonIcon },
                    { value: 'cosmic', label: 'Cosmic', Icon: SparklesIcon },
                    { value: 'sunset', label: 'Sunset', Icon: ImageIcon },
                    { value: 'oled', label: 'Black', Icon: SmartphoneIcon },
                  ] as const).map(({ value, label, Icon }) => (
                    <GlassBubbleButton
                      key={value}
                      onClick={() => {
                        writeString('pfc-system-dark-variant', value);
                        setSystemDarkVariant(value);
                        // If system is currently in dark mode, apply immediately
                        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                        if (prefersDark) setTheme(value);
                        window.dispatchEvent(new CustomEvent('pfc-system-theme-update'));
                      }}
                      active={systemDarkVariant === value}
                      color="ember"
                      size="sm"
                      fullWidth
                      className="flex-col"
                    >
                      <Icon style={{ height: 16, width: 16 }} />
                      <span style={{ fontFamily: 'var(--font-secondary)', fontSize: '0.5rem', fontWeight: 500 }}>{label}</span>
                    </GlassBubbleButton>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* System light variant picker — shown when system auto is active */}
          <AnimatePresence>
            {mounted && systemAuto && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <p className="text-xs text-muted-foreground/60 mt-3 mb-2">
                  When your system is in light mode, use:
                </p>
                <div className="grid grid-cols-2 gap-2" style={{ maxWidth: '14rem' }}>
                  {([
                    { value: 'light', label: 'White', Icon: SunIcon },
                    { value: 'sunny', label: 'Sunny', Icon: CloudSunIcon },
                  ] as const).map(({ value, label, Icon }) => (
                    <GlassBubbleButton
                      key={value}
                      onClick={() => {
                        writeString('pfc-system-light-variant', value);
                        setSystemLightVariant(value);
                        // If system is currently in light mode, apply immediately
                        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                        if (!prefersDark) setTheme(value);
                        window.dispatchEvent(new CustomEvent('pfc-system-theme-update'));
                      }}
                      active={systemLightVariant === value}
                      color="ember"
                      size="sm"
                      fullWidth
                      className="flex-col"
                    >
                      <Icon style={{ height: 16, width: 16 }} />
                      <span style={{ fontFamily: 'var(--font-secondary)', fontSize: '0.5rem', fontWeight: 500 }}>{label}</span>
                    </GlassBubbleButton>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-xs text-muted-foreground/50 mt-3">
            Sunny — animated sky wallpaper. Ember — warm brown tones. Cosmic — animated space wallpaper. Sunset — animated mountain sunset. Black — true black.
          </p>
        </GlassSection>

        {/* Cosmic Scene section removed — single wallpaper (purple-nebula) only */}

        {/* Sunny Scene section removed — single scene (fluffy-clouds) only */}

        {/* Documentation */}
        <GlassSection title="Documentation">
          <p className="text-sm text-muted-foreground/60 mb-3">Reference guides for the PFC system — brain circuits, pipeline architecture, and features.</p>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => router.push('/docs')}>
            <BookOpenIcon className="h-3.5 w-3.5" />
            Open Documentation
          </Button>
        </GlassSection>

        {/* Export Data */}
        <GlassSection title="Export Data">
          <p className="text-sm text-muted-foreground/60 mb-4" style={{ fontFamily: 'var(--font-secondary)', fontWeight: 400 }}>
            Export raw data, signals, research papers, and analysis results.
          </p>

          {/* Data count badges */}
          <div className="flex items-center gap-2 flex-wrap mb-5">
            <Badge variant="secondary" className="text-[10px] bg-pfc-green/10 text-pfc-green border-0">
              {signals.length} signals
            </Badge>
            <Badge variant="secondary" className="text-[10px] bg-pfc-violet/10 text-pfc-violet border-0">
              {papers.length} papers
            </Badge>
            <Badge variant="secondary" className="text-[10px] bg-pfc-ember/10 text-pfc-ember border-0">
              {messages.length} messages
            </Badge>
            <Badge variant="secondary" className="text-[10px] bg-pfc-cyan/10 text-pfc-cyan border-0">
              {cortexArchive.length} snapshots
            </Badge>
          </div>

          {/* What to export */}
          <div className="mb-5">
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">What to Export</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'all' as ExportDataType, label: 'Everything', icon: PackageIcon },
                { value: 'signals' as ExportDataType, label: 'Signals', icon: ActivityIcon },
                { value: 'papers' as ExportDataType, label: 'Papers', icon: BookOpenIcon },
                { value: 'chat-history' as ExportDataType, label: 'Chat', icon: MessageSquareIcon },
                { value: 'pipeline-runs' as ExportDataType, label: 'Pipeline', icon: NetworkIcon },
                { value: 'thought-graphs' as ExportDataType, label: 'Thoughts', icon: BrainIcon },
              ]).map((opt) => {
                const Icon = opt.icon;
                return (
                  <GlassBubbleButton
                    key={opt.value}
                    onClick={() => setSelectedData(opt.value)}
                    active={selectedData === opt.value}
                    color="violet"
                    size="sm"
                    fullWidth
                    className="flex-col"
                  >
                    <Icon style={{ height: 14, width: 14 }} />
                    <span style={{ fontFamily: 'var(--font-secondary)', fontSize: '0.5rem', fontWeight: 500 }}>{opt.label}</span>
                  </GlassBubbleButton>
                );
              })}
            </div>
          </div>

          {/* Format */}
          <div className="mb-5">
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">Format</label>
            <div className="grid grid-cols-5 gap-2">
              {([
                { value: 'json' as ExportFormat, label: 'JSON', icon: FileJsonIcon },
                { value: 'csv' as ExportFormat, label: 'CSV', icon: FileSpreadsheetIcon },
                { value: 'markdown' as ExportFormat, label: 'MD', icon: FileTextIcon },
                { value: 'bibtex' as ExportFormat, label: 'BibTeX', icon: BookOpenIcon },
                { value: 'ris' as ExportFormat, label: 'RIS', icon: BookOpenIcon },
              ]).map((opt) => {
                const Icon = opt.icon;
                const disabled = (opt.value === 'bibtex' || opt.value === 'ris') && selectedData !== 'papers' && selectedData !== 'all';
                return (
                  <GlassBubbleButton
                    key={opt.value}
                    onClick={() => !disabled && setSelectedFormat(opt.value)}
                    active={selectedFormat === opt.value}
                    color="cyan"
                    size="sm"
                    fullWidth
                    className="flex-col"
                    disabled={disabled}
                  >
                    <Icon style={{ height: 14, width: 14 }} />
                    <span style={{ fontFamily: 'var(--font-secondary)', fontSize: '0.5rem', fontWeight: 500 }}>{opt.label}</span>
                  </GlassBubbleButton>
                );
              })}
            </div>
          </div>

          {/* Export button */}
          <GlassBubbleButton onClick={handleExport} color="ember" size="lg" fullWidth>
            {exported ? (
              <><CheckCircle2Icon className="h-4 w-4" /> Exported!</>
            ) : (
              <><DownloadIcon className="h-4 w-4" /> Export as {selectedFormat.toUpperCase()}</>
            )}
          </GlassBubbleButton>
        </GlassSection>

        {/* Reset */}
        <GlassSection title="Reset">
          <p className="text-sm text-muted-foreground/60 mb-5">Clear all data and return to onboarding. This cannot be undone.</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1.5 rounded-full"><Trash2Icon className="h-3.5 w-3.5" />Reset Everything</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>This will clear all data, history, and settings.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Yes, reset everything</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </GlassSection>

      </div>
    </PageShell>
  );
}
