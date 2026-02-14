'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ServerIcon,
  CpuIcon,
  CloudIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ExternalLinkIcon,
  HardDriveIcon,
  RefreshCwIcon,
  GaugeIcon,
  CircleIcon,
  AlertTriangleIcon,
  ActivityIcon,
} from 'lucide-react';
import type { OllamaHardwareStatus } from '@/lib/engine/llm/ollama';
import { formatBytes } from '@/lib/engine/llm/ollama';

import { usePFCStore } from '@/lib/store/use-pfc-store';
import { readString, writeString } from '@/lib/storage-versioning';
import { cn } from '@/lib/utils';
import { OPENAI_MODELS, ANTHROPIC_MODELS, GOOGLE_MODELS } from '@/lib/engine/llm/config';
import type { InferenceMode, ApiProvider, OpenAIModel, AnthropicModel, GoogleModel } from '@/lib/engine/llm/config';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GlassBubbleButton } from '@/components/chat/glass-bubble-button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { GlassSection } from '@/components/layout/page-shell';
import { PixelBook } from '@/components/decorative/pixel-mascots';

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

export function InferenceSection() {
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
  const analyticsEngineEnabled = usePFCStore((s) => s.analyticsEngineEnabled);
  const setAnalyticsEngineEnabled = usePFCStore((s) => s.setAnalyticsEngineEnabled);

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [ollamaChecking, setOllamaChecking] = useState(false);
  const [hwLoading, setHwLoading] = useState(false);

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

  return (
    <>
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
    </>
  );
}
