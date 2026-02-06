'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
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
  Loader2Icon,
  ExternalLinkIcon,
  HardDriveIcon,
  RefreshCwIcon,
  CopyIcon,
  GaugeIcon,
  WrenchIcon,
  CircleIcon,
} from 'lucide-react';
import type { OllamaHardwareStatus } from '@/lib/engine/llm/ollama';
import { formatBytes } from '@/lib/engine/llm/ollama';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { cn } from '@/lib/utils';
import { useSetupGuard } from '@/hooks/use-setup-guard';
import { OPENAI_MODELS, ANTHROPIC_MODELS } from '@/lib/engine/llm/config';
import type { InferenceMode, ApiProvider, OpenAIModel, AnthropicModel } from '@/lib/engine/llm/config';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
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

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.3, ease: 'easeOut' as const },
  }),
};

const MODE_OPTIONS: {
  value: InferenceMode;
  label: string;
  description: string;
  icon: typeof CpuIcon;
  color: string;
  activeColor: string;
  activeBg: string;
}[] = [
  {
    value: 'simulation',
    label: 'Simulation',
    description: 'Built-in engine',
    icon: CpuIcon,
    color: 'text-pfc-ember',
    activeColor: 'border-pfc-ember/50 bg-pfc-ember/5',
    activeBg: 'bg-pfc-ember',
  },
  {
    value: 'api',
    label: 'API Mode',
    description: 'Cloud LLM',
    icon: CloudIcon,
    color: 'text-pfc-violet',
    activeColor: 'border-pfc-violet/50 bg-pfc-violet/5',
    activeBg: 'bg-pfc-violet',
  },
  {
    value: 'local',
    label: 'Local',
    description: 'Ollama',
    icon: ServerIcon,
    color: 'text-pfc-green',
    activeColor: 'border-pfc-green/50 bg-pfc-green/5',
    activeBg: 'bg-pfc-green',
  },
];

export default function SettingsPage() {
  const ready = useSetupGuard();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Store selectors
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

  // Connection test state
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [ollamaChecking, setOllamaChecking] = useState(false);
  const [hwLoading, setHwLoading] = useState(false);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  // Load persisted settings on mount
  useEffect(() => {
    setMounted(true);
    // Load API key from localStorage into store
    const storedKey = localStorage.getItem('pfc-api-key') || '';
    if (storedKey && !apiKey) setApiKey(storedKey);
    // Load mode
    const storedMode = localStorage.getItem('pfc-inference-mode') as InferenceMode;
    if (storedMode && storedMode !== inferenceMode) setInferenceMode(storedMode);
    // Load provider
    const storedProvider = localStorage.getItem('pfc-api-provider') as ApiProvider;
    if (storedProvider) setApiProvider(storedProvider);
    // Load Ollama URL
    const storedOllamaUrl = localStorage.getItem('pfc-ollama-url');
    if (storedOllamaUrl) setOllamaBaseUrl(storedOllamaUrl);
    // Load Ollama model
    const storedOllamaModel = localStorage.getItem('pfc-ollama-model');
    if (storedOllamaModel) setOllamaModel(storedOllamaModel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-check Ollama when switching to local mode
  useEffect(() => {
    if (inferenceMode === 'local') {
      checkOllama();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inferenceMode]);

  const handleModeChange = (mode: InferenceMode) => {
    setInferenceMode(mode);
    localStorage.setItem('pfc-inference-mode', mode);
    setTestStatus('idle');
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    localStorage.setItem('pfc-api-key', value);
    setTestStatus('idle');
  };

  const handleProviderChange = (provider: ApiProvider) => {
    setApiProvider(provider);
    localStorage.setItem('pfc-api-provider', provider);
    setTestStatus('idle');
  };

  const handleOllamaUrlChange = (url: string) => {
    setOllamaBaseUrl(url);
    localStorage.setItem('pfc-ollama-url', url);
  };

  const handleOllamaModelChange = (model: string) => {
    setOllamaModel(model);
    localStorage.setItem('pfc-ollama-model', model);
  };

  const checkOllama = useCallback(async () => {
    setOllamaChecking(true);
    try {
      const res = await fetch(`/api/ollama-check?baseUrl=${encodeURIComponent(ollamaBaseUrl)}`);
      const data = await res.json();
      setOllamaStatus(data.available, data.models || []);
      // Auto-select first model if none set
      if (data.available && data.models?.length > 0 && !ollamaModel) {
        handleOllamaModelChange(data.models[0]);
      }
    } catch {
      setOllamaStatus(false, []);
    } finally {
      setOllamaChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ollamaBaseUrl]);

  const fetchHardwareStatus = useCallback(async () => {
    setHwLoading(true);
    try {
      const res = await fetch(`/api/ollama-status?baseUrl=${encodeURIComponent(ollamaBaseUrl)}`);
      const data: OllamaHardwareStatus = await res.json();
      setOllamaHardware(data);
    } catch {
      setOllamaHardware(null);
    } finally {
      setHwLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ollamaBaseUrl]);

  // Auto-fetch hardware status when Ollama is available
  useEffect(() => {
    if (inferenceMode === 'local' && ollamaAvailable) {
      fetchHardwareStatus();
    }
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
        body: JSON.stringify({
          mode: inferenceMode,
          provider: apiProvider,
          apiKey,
          openaiModel,
          anthropicModel,
          ollamaBaseUrl,
          ollamaModel,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
        setTestError(data.error || 'Connection failed');
      }
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
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-full px-3 py-1 -ml-3 hover:bg-muted"
          >
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            <span className="text-xs">Back</span>
          </Link>
          <div className="flex items-center gap-2 ml-1">
            <SettingsIcon className="h-5 w-5 text-pfc-ember" />
            <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        {/* Inference Mode */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={0}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BrainCircuitIcon className="h-4 w-4 text-pfc-ember" />
                Inference Mode
              </CardTitle>
              <CardDescription className="text-xs">
                Choose how PFC processes queries. Simulation uses the built-in template engine;
                API mode connects to OpenAI or Anthropic; Local mode uses Ollama.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 3-mode selector */}
              <div className="grid grid-cols-3 gap-3">
                {MODE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = inferenceMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleModeChange(opt.value)}
                      className={cn(
                        'relative flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all duration-200 cursor-pointer',
                        isActive
                          ? `${opt.activeColor} shadow-sm`
                          : 'border-border/50 hover:border-border hover:bg-muted/30',
                      )}
                    >
                      <Icon className={cn('h-5 w-5', isActive ? opt.color : 'text-muted-foreground')} />
                      <span className={cn('text-xs font-medium', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                        {opt.label}
                      </span>
                      <span className="text-[9px] text-muted-foreground/60">{opt.description}</span>
                      {isActive && (
                        <Badge className={cn('absolute -top-2 -right-2 text-white text-[9px] px-1.5 py-0', opt.activeBg)}>
                          Active
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* API Mode sub-panel */}
              <AnimatePresence>
                {inferenceMode === 'api' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pt-3 border-t border-border/30"
                  >
                    {/* Provider selector */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-2 block">Provider</label>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { value: 'openai' as const, label: 'OpenAI', hint: 'GPT-4o' },
                          { value: 'anthropic' as const, label: 'Anthropic', hint: 'Claude' },
                        ]).map((p) => (
                          <button
                            key={p.value}
                            onClick={() => handleProviderChange(p.value)}
                            className={cn(
                              'flex flex-col items-center gap-1 rounded-lg border px-3 py-2 text-xs transition-all cursor-pointer',
                              apiProvider === p.value
                                ? 'border-pfc-violet/50 bg-pfc-violet/5'
                                : 'border-border/40 hover:border-border hover:bg-muted/30',
                            )}
                          >
                            <span className={cn('font-medium', apiProvider === p.value ? 'text-foreground' : 'text-muted-foreground')}>
                              {p.label}
                            </span>
                            <span className="text-[9px] text-muted-foreground/60">{p.hint}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Model selector */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Model</label>
                      <select
                        value={apiProvider === 'openai' ? openaiModel : anthropicModel}
                        onChange={(e) => {
                          if (apiProvider === 'openai') setOpenAIModel(e.target.value as OpenAIModel);
                          else setAnthropicModel(e.target.value as AnthropicModel);
                        }}
                        className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-pfc-violet/50"
                      >
                        {(apiProvider === 'openai' ? OPENAI_MODELS : ANTHROPIC_MODELS).map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* API Key */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">API Key</label>
                      <Input
                        type="password"
                        placeholder={apiProvider === 'openai' ? 'sk-...' : 'sk-ant-...'}
                        value={apiKey}
                        onChange={(e) => handleApiKeyChange(e.target.value)}
                        className="font-mono text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        Stored locally in your browser. Never sent to our servers.
                      </p>
                    </div>

                    {/* Test connection */}
                    <div className="flex items-center gap-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={testConnection}
                        disabled={!apiKey || testStatus === 'testing'}
                        className="text-xs gap-1.5"
                      >
                        {testStatus === 'testing' && <Loader2Icon className="h-3 w-3 animate-spin" />}
                        Test Connection
                      </Button>
                      {testStatus === 'success' && (
                        <span className="flex items-center gap-1 text-xs text-pfc-green">
                          <CheckCircle2Icon className="h-3.5 w-3.5" />
                          Connected
                        </span>
                      )}
                      {testStatus === 'error' && (
                        <span className="flex items-center gap-1 text-xs text-pfc-red">
                          <XCircleIcon className="h-3.5 w-3.5" />
                          {testError || 'Failed'}
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Local Mode (Ollama) sub-panel */}
              <AnimatePresence>
                {inferenceMode === 'local' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 pt-3 border-t border-border/30"
                  >
                    {/* Ollama status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'h-2 w-2 rounded-full',
                          ollamaChecking ? 'bg-pfc-yellow animate-pulse' :
                          ollamaAvailable ? 'bg-pfc-green' : 'bg-pfc-red',
                        )} />
                        <span className="text-xs text-muted-foreground">
                          {ollamaChecking ? 'Checking...' :
                           ollamaAvailable ? `Ollama running (${ollamaModels.length} models)` :
                           'Ollama not detected'}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={checkOllama}
                        disabled={ollamaChecking}
                        className="text-xs h-7 px-2"
                      >
                        {ollamaChecking ? <Loader2Icon className="h-3 w-3 animate-spin" /> : 'Check'}
                      </Button>
                    </div>

                    {/* Ollama URL */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Ollama URL</label>
                      <Input
                        type="text"
                        placeholder="http://localhost:11434"
                        value={ollamaBaseUrl}
                        onChange={(e) => handleOllamaUrlChange(e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>

                    {/* Model selector */}
                    {ollamaAvailable && ollamaModels.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Model</label>
                        <select
                          value={ollamaModel}
                          onChange={(e) => handleOllamaModelChange(e.target.value)}
                          className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-pfc-green/50"
                        >
                          {ollamaModels.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Not available hint */}
                    {!ollamaAvailable && !ollamaChecking && (
                      <div className="rounded-lg border border-border/30 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
                        <p>Ollama is not running. To use local models:</p>
                        <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                          <li>
                            Install Ollama from{' '}
                            <a
                              href="https://ollama.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-pfc-green hover:underline inline-flex items-center gap-0.5"
                            >
                              ollama.com <ExternalLinkIcon className="h-2.5 w-2.5" />
                            </a>
                          </li>
                          <li>Run <code className="font-mono bg-muted px-1 rounded">ollama serve</code></li>
                          <li>Pull a model: <code className="font-mono bg-muted px-1 rounded">ollama pull llama3.1</code></li>
                          <li>Click &quot;Check&quot; above</li>
                        </ol>
                      </div>
                    )}

                    {/* Test connection */}
                    {ollamaAvailable && (
                      <div className="flex items-center gap-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={testConnection}
                          disabled={testStatus === 'testing'}
                          className="text-xs gap-1.5"
                        >
                          {testStatus === 'testing' && <Loader2Icon className="h-3 w-3 animate-spin" />}
                          Test Inference
                        </Button>
                        {testStatus === 'success' && (
                          <span className="flex items-center gap-1 text-xs text-pfc-green">
                            <CheckCircle2Icon className="h-3.5 w-3.5" />
                            Working
                          </span>
                        )}
                        {testStatus === 'error' && (
                          <span className="flex items-center gap-1 text-xs text-pfc-red">
                            <XCircleIcon className="h-3.5 w-3.5" />
                            {testError || 'Failed'}
                          </span>
                        )}
                      </div>
                    )}

                    {/* ── Hardware Status Panel ── */}
                    {ollamaAvailable && (
                      <div className="space-y-4 pt-3 border-t border-border/20">
                        {/* Header with refresh */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <HardDriveIcon className="h-3.5 w-3.5 text-pfc-cyan" />
                            <span className="text-xs font-medium">Hardware Status</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={fetchHardwareStatus}
                            disabled={hwLoading}
                            className="text-xs h-7 px-2"
                          >
                            {hwLoading ? <Loader2Icon className="h-3 w-3 animate-spin" /> : <RefreshCwIcon className="h-3 w-3" />}
                          </Button>
                        </div>

                        {/* GPU Info (nvidia-smi) */}
                        {ollamaHardware?.gpu && (
                          <div className="rounded-lg border border-pfc-green/20 bg-pfc-green/5 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-pfc-green">GPU Detected</span>
                              <Badge variant="secondary" className="text-[9px] bg-pfc-green/10 text-pfc-green border-0">
                                {ollamaHardware.gpu.name}
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>VRAM Usage</span>
                                <span className="font-mono">
                                  {formatBytes(ollamaHardware.gpu.vramUsed)} / {formatBytes(ollamaHardware.gpu.vramTotal)}
                                </span>
                              </div>
                              <Progress
                                value={Math.round((ollamaHardware.gpu.vramUsed / ollamaHardware.gpu.vramTotal) * 100)}
                                className="h-1.5 [&>div]:bg-pfc-green"
                              />
                            </div>
                          </div>
                        )}

                        {/* Running Models */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <GaugeIcon className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[11px] font-medium text-muted-foreground">Running Models</span>
                          </div>
                          {(!ollamaHardware || ollamaHardware.running.length === 0) ? (
                            <div className="rounded-lg border border-border/20 bg-muted/20 px-3 py-2 text-center">
                              <span className="text-[11px] text-muted-foreground/60">No models loaded — idle</span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {ollamaHardware.running.map((m) => {
                                const expiresIn = m.expiresAt ? Math.max(0, Math.round((new Date(m.expiresAt).getTime() - Date.now()) / 1000)) : 0;
                                const minutes = Math.floor(expiresIn / 60);
                                const seconds = expiresIn % 60;
                                return (
                                  <div key={m.name} className="rounded-lg border border-border/30 bg-muted/10 px-3 py-2 space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-mono font-medium">{m.name}</span>
                                      <CircleIcon className="h-2 w-2 fill-pfc-green text-pfc-green" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-muted-foreground">
                                      <span>Parameters: <span className="font-mono text-foreground/80">{m.paramSize} ({m.quantization})</span></span>
                                      <span>VRAM: <span className="font-mono text-foreground/80">{formatBytes(m.vramUsage)}</span></span>
                                      <span>Family: <span className="font-mono text-foreground/80">{m.family}</span></span>
                                      {expiresIn > 0 && (
                                        <span>Unloads in: <span className="font-mono text-pfc-yellow">{minutes}m {seconds}s</span></span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* VRAM Estimator */}
                        {ollamaHardware && ollamaHardware.models.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                              <HardDriveIcon className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[11px] font-medium text-muted-foreground">VRAM Estimates</span>
                            </div>
                            <div className="rounded-lg border border-border/20 overflow-hidden">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="bg-muted/30 border-b border-border/20">
                                    <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Model</th>
                                    <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Est. VRAM</th>
                                    <th className="text-center px-3 py-1.5 font-medium text-muted-foreground">Quant</th>
                                    {ollamaHardware.gpu && (
                                      <th className="text-center px-3 py-1.5 font-medium text-muted-foreground">Fit</th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {ollamaHardware.models.map((m) => {
                                    const gpu = ollamaHardware.gpu;
                                    const fits = gpu ? m.estimatedVram < gpu.vramTotal : null;
                                    const tight = gpu ? m.estimatedVram > gpu.vramTotal * 0.7 : false;
                                    return (
                                      <tr key={m.name} className="border-b border-border/10 last:border-0">
                                        <td className="px-3 py-1.5 font-mono">{m.name}</td>
                                        <td className="text-right px-3 py-1.5 font-mono">{formatBytes(m.estimatedVram)}</td>
                                        <td className="text-center px-3 py-1.5">
                                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{m.quantization}</Badge>
                                        </td>
                                        {gpu && (
                                          <td className="text-center px-3 py-1.5">
                                            {fits === null ? (
                                              <span className="text-muted-foreground">—</span>
                                            ) : fits && !tight ? (
                                              <CheckCircle2Icon className="h-3 w-3 text-pfc-green inline-block" />
                                            ) : fits && tight ? (
                                              <span className="text-pfc-yellow text-[10px]">tight</span>
                                            ) : (
                                              <XCircleIcon className="h-3 w-3 text-pfc-red inline-block" />
                                            )}
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                            {!ollamaHardware.gpu && (
                              <p className="text-[10px] text-muted-foreground/50">
                                GPU info unavailable — estimates shown without hardware comparison.
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground/50">
                              Estimates based on parameter count x quantization bits + ~500MB overhead. Actual usage varies.
                            </p>
                          </div>
                        )}

                        {/* Config Helper */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <WrenchIcon className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[11px] font-medium text-muted-foreground">Ollama Configuration Tips</span>
                          </div>
                          <div className="rounded-lg border border-border/20 bg-muted/10 px-3 py-2.5 space-y-2.5">
                            <p className="text-[10px] text-muted-foreground/70">
                              Set these environment variables before starting Ollama to control hardware usage.
                            </p>
                            {([
                              { name: 'OLLAMA_NUM_GPU', value: '999', desc: 'GPU layers to offload (999 = all, 0 = CPU only)' },
                              { name: 'OLLAMA_MAX_LOADED_MODELS', value: '1', desc: 'Max models in memory simultaneously' },
                              { name: 'OLLAMA_NUM_PARALLEL', value: '1', desc: 'Concurrent inference request slots' },
                              { name: 'OLLAMA_FLASH_ATTENTION', value: '1', desc: 'Enable flash attention (reduces VRAM for long contexts)' },
                            ] as const).map((env) => (
                              <div key={env.name} className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <code className="text-[10px] font-mono text-pfc-cyan">{env.name}</code>
                                  <p className="text-[9px] text-muted-foreground/60 mt-0.5">{env.desc}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-1.5 shrink-0"
                                  onClick={() => copyToClipboard(`export ${env.name}=${env.value}`, env.name)}
                                >
                                  {copiedVar === env.name ? (
                                    <CheckCircle2Icon className="h-3 w-3 text-pfc-green" />
                                  ) : (
                                    <CopyIcon className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        <Separator />

        {/* Theme */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={1}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <SunIcon className="h-4 w-4 text-pfc-yellow" />
                Appearance
              </CardTitle>
              <CardDescription className="text-xs">
                Choose your preferred color theme.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: 'light', label: 'Light', Icon: SunIcon },
                  { value: 'dark', label: 'Dark', Icon: MoonIcon },
                  { value: 'system', label: 'System', Icon: MonitorIcon },
                ] as const).map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-200 cursor-pointer',
                      mounted && theme === value
                        ? 'border-pfc-ember/50 bg-pfc-ember/5 shadow-sm'
                        : 'border-border/50 hover:border-border hover:bg-muted/30'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', mounted && theme === value ? 'text-pfc-ember' : 'text-muted-foreground')} />
                    <span className={cn('text-xs font-medium', mounted && theme === value ? 'text-foreground' : 'text-muted-foreground')}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <Separator />

        {/* Reset */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={2}>
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Trash2Icon className="h-4 w-4 text-pfc-red" />
                Reset
              </CardTitle>
              <CardDescription className="text-xs">
                Clear all data and return to onboarding. This cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-1.5">
                    <Trash2Icon className="h-3.5 w-3.5" />
                    Reset Everything
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear all your data, chat history, and settings. You will be returned to the onboarding screen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReset}>
                      Yes, reset everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </motion.div>

        <Separator />

        {/* About */}
        <motion.div variants={cardVariants} initial="hidden" animate="visible" custom={3}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">About</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Version</span>
                <span className="font-mono">v2.1.0</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Engine</span>
                <span className="font-mono">Meta-Analytical PFC</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Pipeline</span>
                <span className="font-mono">10-stage executive reasoning</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Inference</span>
                <span className="font-mono capitalize">{inferenceMode}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
