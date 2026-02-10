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
  WrenchIcon,
  CircleIcon,
  FlaskConicalIcon,
  LayersIcon,
  CodeIcon,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GlassBubbleButton } from '@/components/glass-bubble-button';
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
import { PageShell, GlassSection } from '@/components/page-shell';
import { PixelBook } from '@/components/pixel-book';

const MODE_OPTIONS: {
  value: InferenceMode;
  label: string;
  description: string;
  icon: typeof CpuIcon;
  color: string;
  activeBorder: string;
}[] = [
  { value: 'simulation', label: 'Simulation', description: 'Built-in engine', icon: CpuIcon, color: 'text-pfc-ember', activeBorder: 'border-pfc-ember/50 bg-pfc-ember/5' },
  { value: 'api', label: 'API Mode', description: 'Cloud LLM', icon: CloudIcon, color: 'text-pfc-violet', activeBorder: 'border-pfc-violet/50 bg-pfc-violet/5' },
  { value: 'local', label: 'Local', description: 'Ollama', icon: ServerIcon, color: 'text-pfc-green', activeBorder: 'border-pfc-green/50 bg-pfc-green/5' },
];

export default function SettingsPage() {
  const ready = useSetupGuard();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

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
  const suiteTier = usePFCStore((s) => s.suiteTier);
  const setSuiteTier = usePFCStore((s) => s.setSuiteTier);
  const measurementEnabled = usePFCStore((s) => s.measurementEnabled);
  const setMeasurementEnabled = usePFCStore((s) => s.setMeasurementEnabled);

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [ollamaChecking, setOllamaChecking] = useState(false);
  const [hwLoading, setHwLoading] = useState(false);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const storedKey = localStorage.getItem('pfc-api-key') || '';
    if (storedKey && !apiKey) setApiKey(storedKey);
    const storedMode = localStorage.getItem('pfc-inference-mode') as InferenceMode;
    if (storedMode && storedMode !== inferenceMode) setInferenceMode(storedMode);
    const storedProvider = localStorage.getItem('pfc-api-provider') as ApiProvider;
    if (storedProvider) setApiProvider(storedProvider);
    const storedOllamaUrl = localStorage.getItem('pfc-ollama-url');
    if (storedOllamaUrl) setOllamaBaseUrl(storedOllamaUrl);
    const storedOllamaModel = localStorage.getItem('pfc-ollama-model');
    if (storedOllamaModel) setOllamaModel(storedOllamaModel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (inferenceMode === 'local') checkOllama();
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
      if (data.available && data.models?.length > 0 && !ollamaModel) {
        handleOllamaModelChange(data.models[0]);
      }
    } catch { setOllamaStatus(false, []); }
    finally { setOllamaChecking(false); }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ollamaBaseUrl]);

  useEffect(() => {
    if (inferenceMode === 'local' && ollamaAvailable) fetchHardwareStatus();
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
        body: JSON.stringify({ mode: inferenceMode, provider: apiProvider, apiKey, openaiModel, anthropicModel, ollamaBaseUrl, ollamaModel }),
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
          <p className="text-xs text-muted-foreground/50 mb-4">
            Choose how PFC processes queries. Simulation uses the built-in engine; API mode connects to cloud LLMs; Local uses Ollama.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-4">
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
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{opt.label}</span>
                  <span style={{ fontSize: '0.625rem', opacity: 0.5, fontWeight: 400 }}>{opt.description}</span>
                </GlassBubbleButton>
              );
            })}
          </div>

          {/* API sub-panel */}
          <AnimatePresence>
            {inferenceMode === 'api' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 pt-4 border-t border-border/20">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-2 block">Provider</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([{ value: 'openai' as const, label: 'OpenAI', hint: 'GPT-4o' }, { value: 'anthropic' as const, label: 'Anthropic', hint: 'Claude' }]).map((p) => (
                      <GlassBubbleButton
                        key={p.value}
                        onClick={() => handleProviderChange(p.value)}
                        active={apiProvider === p.value}
                        color="violet"
                        fullWidth
                        className="flex-col"
                      >
                        <span style={{ fontWeight: 600 }}>{p.label}</span>
                        <span style={{ fontSize: '0.625rem', opacity: 0.5, fontWeight: 400 }}>{p.hint}</span>
                      </GlassBubbleButton>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Model</label>
                  <select value={apiProvider === 'openai' ? openaiModel : anthropicModel} onChange={(e) => { if (apiProvider === 'openai') setOpenAIModel(e.target.value as OpenAIModel); else setAnthropicModel(e.target.value as AnthropicModel); }} className="w-full rounded-full border border-border/30 bg-background px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-pfc-violet/50">
                    {(apiProvider === 'openai' ? OPENAI_MODELS : ANTHROPIC_MODELS).map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">API Key</label>
                  <Input type="password" placeholder={apiProvider === 'openai' ? 'sk-...' : 'sk-ant-...'} value={apiKey} onChange={(e) => handleApiKeyChange(e.target.value)} className="font-mono text-sm rounded-xl" />
                  <p className="text-[10px] text-muted-foreground/40 mt-1">Stored locally. Never sent to our servers.</p>
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
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 pt-4 border-t border-border/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-2 w-2 rounded-full', ollamaChecking ? 'bg-pfc-yellow animate-pulse' : ollamaAvailable ? 'bg-pfc-green' : 'bg-pfc-red')} />
                    <span className="text-sm text-muted-foreground">{ollamaChecking ? 'Checking...' : ollamaAvailable ? `Ollama running (${ollamaModels.length} models)` : 'Ollama not detected'}</span>
                  </div>
                  <GlassBubbleButton size="sm" color="green" onClick={checkOllama} disabled={ollamaChecking}>{ollamaChecking ? <PixelBook size={14} /> : 'Check'}</GlassBubbleButton>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Ollama URL</label>
                  <Input type="text" placeholder="http://localhost:11434" value={ollamaBaseUrl} onChange={(e) => handleOllamaUrlChange(e.target.value)} className="font-mono text-sm rounded-xl" />
                </div>
                {ollamaAvailable && ollamaModels.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Model</label>
                    <select value={ollamaModel} onChange={(e) => handleOllamaModelChange(e.target.value)} className="w-full rounded-xl border border-border/30 bg-background px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-pfc-green/50">
                      {ollamaModels.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                )}
                {!ollamaAvailable && !ollamaChecking && (
                  <div className="rounded-2xl border border-border/20 bg-muted/20 px-4 py-3 text-sm text-muted-foreground space-y-1">
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
                        <div className="rounded-2xl border border-pfc-green/20 bg-pfc-green/5 p-4 space-y-2">
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
                                <div key={m.name} className="rounded-xl border border-border/20 p-3 space-y-1">
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

        {/* Suite Tier */}
        <GlassSection title="Suite Tier">
          <p className="text-xs text-muted-foreground/50 mb-4">
            Each tier includes everything below it. Lower tiers skip heavy computation for mobile and low-power devices.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {([
              { value: 'notes' as const, label: 'Notes & Research', desc: 'Chat, library, export', icon: FlaskConicalIcon, color: 'green' as const },
              { value: 'programming' as const, label: 'Programming', desc: '+ Code tools, steering', icon: CodeIcon, color: 'violet' as const },
              { value: 'full' as const, label: 'Full Measurement', desc: '+ Pipeline, signals, TDA', icon: LayersIcon, color: 'ember' as const },
            ]).map((opt) => {
              const Icon = opt.icon;
              return (
                <GlassBubbleButton
                  key={opt.value}
                  onClick={() => setSuiteTier(opt.value)}
                  active={suiteTier === opt.value}
                  color={opt.color}
                  size="lg"
                  fullWidth
                  className="flex-col"
                >
                  <Icon style={{ height: 20, width: 20 }} />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{opt.label}</span>
                  <span style={{ fontSize: '0.5625rem', opacity: 0.5, fontWeight: 400 }}>{opt.desc}</span>
                </GlassBubbleButton>
              );
            })}
          </div>
          <AnimatePresence>
            {suiteTier === 'full' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-3 border-t border-border/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Measurement Suite</p>
                    <p className="text-[10px] text-muted-foreground/40">Toggle to temporarily disable heavy measurement without switching tiers</p>
                  </div>
                  <button
                    onClick={() => setMeasurementEnabled(!measurementEnabled)}
                    className={cn(
                      'relative h-6 w-11 rounded-full transition-colors',
                      measurementEnabled ? 'bg-pfc-green' : 'bg-muted-foreground/20',
                    )}
                  >
                    <div className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform shadow-sm',
                      measurementEnabled ? 'translate-x-5' : 'translate-x-0.5',
                    )} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassSection>

        {/* Appearance */}
        <GlassSection title="Appearance">
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: 'light', label: 'Light', Icon: SunIcon },
              { value: 'dark', label: 'Dark', Icon: MoonIcon },
              { value: 'system', label: 'System', Icon: MonitorIcon },
            ] as const).map(({ value, label, Icon }) => (
              <GlassBubbleButton
                key={value}
                onClick={() => setTheme(value)}
                active={mounted && theme === value}
                color="ember"
                size="lg"
                fullWidth
                className="flex-col"
              >
                <Icon style={{ height: 20, width: 20 }} />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{label}</span>
              </GlassBubbleButton>
            ))}
          </div>
        </GlassSection>

        {/* Reset */}
        <GlassSection title="Reset">
          <p className="text-xs text-muted-foreground/50 mb-4">Clear all data and return to onboarding. This cannot be undone.</p>
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
