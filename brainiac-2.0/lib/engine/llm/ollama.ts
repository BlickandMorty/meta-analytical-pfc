// ═══════════════════════════════════════════════════════════════════
// ██ OLLAMA — Health Check, Model Discovery & Hardware Status
// ═══════════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────────

interface OllamaStatus {
  available: boolean;
  models: string[];
}

export interface OllamaRunningModel {
  name: string;
  paramSize: string;
  quantization: string;
  vramUsage: number;
  totalSize: number;
  format: string;
  family: string;
  expiresAt: string;
}

interface OllamaModelDetail {
  paramSize: string;
  quantization: string;
  contextLength: number;
  family: string;
  format: string;
}

export interface GpuInfo {
  name: string;
  vramTotal: number;
  vramUsed: number;
}

export interface OllamaHardwareStatus {
  running: OllamaRunningModel[];
  gpu: GpuInfo | null;
  models: { name: string; estimatedVram: number; paramSize: string; quantization: string }[];
  timestamp: number;
}

// ── VRAM Estimation ──────────────────────────────────────────────

const QUANT_BITS: Record<string, number> = {
  'Q2_K': 2.5,
  'Q3_K_S': 3.0,
  'Q3_K_M': 3.5,
  'Q3_K_L': 3.75,
  'Q4_0': 4.5,
  'Q4_K_S': 4.5,
  'Q4_K_M': 4.5,
  'Q4_1': 5.0,
  'Q5_0': 5.5,
  'Q5_K_S': 5.5,
  'Q5_K_M': 5.5,
  'Q6_K': 6.5,
  'Q8_0': 8.5,
  'F16': 16,
  'F32': 32,
  'IQ1_S': 1.5,
  'IQ2_XXS': 2.0,
  'IQ2_XS': 2.25,
  'IQ3_XXS': 3.0,
  'IQ4_XS': 4.0,
};

const KV_CACHE_OVERHEAD = 512 * 1024 * 1024; // ~500MB

function parseParamSize(paramSize: string): number {
  const cleaned = paramSize.toUpperCase().replace(/\s/g, '');
  const match = cleaned.match(/([\d.]+)\s*([BMK])?/);
  if (!match) return 0;
  const num = parseFloat(match[1]!);
  const unit = match[2] || 'B';
  if (unit === 'K') return num * 1_000;
  if (unit === 'M') return num * 1_000_000;
  return num * 1_000_000_000;
}

function matchQuantization(quantization: string): number {
  const upper = quantization.toUpperCase().replace(/\s/g, '');
  for (const [key, bits] of Object.entries(QUANT_BITS)) {
    if (upper.includes(key)) return bits;
  }
  return 4.5;
}

export function estimateVram(paramSize: string, quantization: string): number {
  const params = parseParamSize(paramSize);
  if (params === 0) return 0;
  const bitsPerParam = matchQuantization(quantization);
  return Math.round((params * bitsPerParam) / 8) + KV_CACHE_OVERHEAD;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

// ── Health Check ─────────────────────────────────────────────────

export async function checkOllamaAvailability(
  baseUrl = 'http://localhost:11434',
): Promise<OllamaStatus> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return { available: false, models: [] };
    const data = await response.json();
    const models = (data.models || []).map((m: { name: string }) => m.name);
    return { available: true, models };
  } catch {
    return { available: false, models: [] };
  }
}

// ── Running Models ───────────────────────────────────────────────

export async function getOllamaRunningModels(
  baseUrl = 'http://localhost:11434',
): Promise<OllamaRunningModel[]> {
  try {
    const response = await fetch(`${baseUrl}/api/ps`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models || []).map((m: {
      name: string;
      size: number;
      size_vram: number;
      details: {
        parameter_size: string;
        quantization_level: string;
        format: string;
        family: string;
      };
      expires_at: string;
    }) => ({
      name: m.name,
      paramSize: m.details?.parameter_size || 'unknown',
      quantization: m.details?.quantization_level || 'unknown',
      vramUsage: m.size_vram || 0,
      totalSize: m.size || 0,
      format: m.details?.format || 'unknown',
      family: m.details?.family || 'unknown',
      expiresAt: m.expires_at || '',
    }));
  } catch {
    return [];
  }
}

// ── Model Detail ─────────────────────────────────────────────────

export async function getOllamaModelInfo(
  baseUrl: string,
  modelName: string,
): Promise<OllamaModelDetail | null> {
  try {
    const response = await fetch(`${baseUrl}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const details = data.details || {};
    const modelInfo = data.model_info || {};

    let contextLength = 0;
    for (const [key, value] of Object.entries(modelInfo)) {
      if (key.includes('context_length') && typeof value === 'number') {
        contextLength = value;
        break;
      }
    }

    return {
      paramSize: details.parameter_size || 'unknown',
      quantization: details.quantization_level || 'unknown',
      contextLength,
      family: details.family || 'unknown',
      format: details.format || 'unknown',
    };
  } catch {
    return null;
  }
}
