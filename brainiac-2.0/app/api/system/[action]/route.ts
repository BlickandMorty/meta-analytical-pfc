/**
 * Consolidated system API route.
 *
 * Merges the following former standalone routes:
 *   /api/ollama-check      -> /api/system/ollama-check     (GET)
 *   /api/ollama-status     -> /api/system/ollama-status     (GET)
 *   /api/test-connection   -> /api/system/test-connection   (POST)
 *   /api/daemon            -> /api/system/daemon            (GET/POST)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api-middleware';

// ── Shared SSRF guard ──
function isAllowedOllamaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// ollama-check handler (GET)
// ═══════════════════════════════════════════════════════════════════

import { checkOllamaAvailability } from '@/lib/engine/llm/ollama';
import { logger } from '@/lib/debug-logger';

async function handleOllamaCheck(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseUrl = searchParams.get('baseUrl') || 'http://localhost:11434';

  if (!isAllowedOllamaUrl(baseUrl)) {
    return NextResponse.json(
      { error: 'Only localhost Ollama URLs are allowed' },
      { status: 400 },
    );
  }

  try {
    const result = await checkOllamaAvailability(baseUrl);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('ollama-check', 'Error:', error);
    return NextResponse.json({ available: false, error: 'Connection check failed' });
  }
}

// ═══════════════════════════════════════════════════════════════════
// ollama-status handler (GET)
// ═══════════════════════════════════════════════════════════════════

import {
  getOllamaRunningModels,
  getOllamaModelInfo,
  estimateVram,
} from '@/lib/engine/llm/ollama';
import { execSync } from 'child_process';

function getGpuInfo(): { name: string; vramTotal: number; vramUsed: number } | null {
  try {
    const output = execSync(
      'nvidia-smi --query-gpu=name,memory.total,memory.used --format=csv,noheader,nounits',
      { timeout: 3000, encoding: 'utf-8' },
    );
    const parts = output.trim().split(',').map((s) => s.trim());
    if (parts.length < 3) return null;
    return {
      name: parts[0]!,
      vramTotal: parseInt(parts[1]!, 10) * 1024 * 1024,
      vramUsed: parseInt(parts[2]!, 10) * 1024 * 1024,
    };
  } catch {
    return null;
  }
}

async function handleOllamaStatus(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const baseUrl = searchParams.get('baseUrl') || 'http://localhost:11434';

  if (!isAllowedOllamaUrl(baseUrl)) {
    return NextResponse.json(
      { error: 'Only localhost Ollama URLs are allowed' },
      { status: 400 },
    );
  }

  const [running, tagsRes] = await Promise.all([
    getOllamaRunningModels(baseUrl).catch(() => []),
    fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) }).catch(() => null),
  ]);

  let models: { name: string; estimatedVram: number; paramSize: string; quantization: string }[] = [];
  if (tagsRes && tagsRes.ok) {
    try {
      const tagsData = await tagsRes.json();
      const modelList: { name: string }[] = tagsData.models || [];

      const detailPromises = modelList.slice(0, 10).map(async (m) => {
        const detail = await getOllamaModelInfo(baseUrl, m.name);
        if (!detail) return null;
        return {
          name: m.name,
          estimatedVram: estimateVram(detail.paramSize, detail.quantization),
          paramSize: detail.paramSize,
          quantization: detail.quantization,
        };
      });

      const results = await Promise.all(detailPromises);
      models = results.filter((r): r is NonNullable<typeof r> => r !== null);
    } catch {
      // JSON parse or model info fetch failed — return empty models list
    }
  }

  const gpu = getGpuInfo();

  return NextResponse.json({
    running,
    gpu,
    models,
    timestamp: Date.now(),
  });
}

// ═══════════════════════════════════════════════════════════════════
// test-connection handler (POST)
// ═══════════════════════════════════════════════════════════════════

import { generateText } from 'ai';
import { resolveProvider, isAllowedOllamaUrl as isAllowedOllamaUrlProvider } from '@/lib/engine/llm/provider';
import type { InferenceConfig } from '@/lib/engine/llm/config';
import { parseBodyWithLimit } from '@/lib/api-utils';

interface TestConnectionBody {
  mode?: InferenceConfig['mode'];
  provider?: InferenceConfig['apiProvider'];
  apiKey?: string;
  openaiModel?: string;
  anthropicModel?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}

async function handleTestConnection(request: NextRequest) {
  try {
    const parsedBody = await parseBodyWithLimit<TestConnectionBody>(request, 5 * 1024 * 1024);
    if ('error' in parsedBody) {
      return parsedBody.error;
    }
    const body = parsedBody.data;

    // SSRF guard: validate ollamaBaseUrl before passing to resolveProvider
    if (body.mode === 'local' && body.ollamaBaseUrl && !isAllowedOllamaUrlProvider(body.ollamaBaseUrl)) {
      return NextResponse.json(
        { success: false, error: 'Only localhost Ollama URLs are allowed' },
        { status: 400 },
      );
    }

    const config: InferenceConfig = {
      mode: body.mode || 'api',
      apiProvider: body.provider,
      apiKey: body.apiKey,
      openaiModel: body.openaiModel as InferenceConfig['openaiModel'],
      anthropicModel: body.anthropicModel as InferenceConfig['anthropicModel'],
      ollamaBaseUrl: body.ollamaBaseUrl,
      ollamaModel: body.ollamaModel,
    };

    const model = resolveProvider(config);
    const result = await generateText({
      model,
      prompt: 'Respond with exactly: "Connection successful"',
      maxOutputTokens: 20,
    });

    return NextResponse.json({ success: true, response: result.text.trim() });
  } catch (error) {
    // Sanitize: strip API keys or tokens that may appear in error messages
    let message = error instanceof Error ? error.message : 'Unknown error';
    message = message.replace(/(?:sk-|key-|token-|Bearer\s+)\S+/gi, '[REDACTED]');
    if (message.length > 500) message = message.slice(0, 500) + '...';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

// ═══════════════════════════════════════════════════════════════════
// daemon handler (GET/POST)
// ═══════════════════════════════════════════════════════════════════

import { spawn } from 'child_process';
import path from 'path';

const DAEMON_PORT = parseInt(process.env.PFC_DAEMON_PORT || '3099', 10);
const DAEMON_URL = `http://localhost:${DAEMON_PORT}`;

// Allowed GET endpoints — whitelist only
const ALLOWED_GET_ENDPOINTS = new Set(['status', 'config', 'health', 'events', 'permissions']);

// Allowed POST proxy path prefixes
const ALLOWED_PROXY_PREFIXES = ['/fs/'];
// /shell/ intentionally excluded — too dangerous to expose through web proxy

async function handleDaemonGet(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get('endpoint') || 'status';

  // Whitelist — only allow known safe endpoints
  if (!ALLOWED_GET_ENDPOINTS.has(endpoint)) {
    return NextResponse.json(
      { error: 'Endpoint not allowed' },
      { status: 403 },
    );
  }

  try {
    const res = await fetch(`${DAEMON_URL}/${endpoint}`, {
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      running: false,
      error: 'Daemon is not running',
    });
  }
}

async function handleDaemonPost(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    // Limit body size to 1MB
    const text = await req.text();
    if (text.length > 1_000_000) {
      return NextResponse.json({ error: 'Body too large' }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = typeof body.action === 'string' ? body.action : '';
  if (!action) {
    return NextResponse.json({ error: 'Missing or invalid "action" field' }, { status: 400 });
  }

  switch (action) {
    case 'start': {
      const daemonScript = path.join(process.cwd(), 'daemon', 'index.ts');

      try {
        const statusRes = await fetch(`${DAEMON_URL}/status`, {
          signal: AbortSignal.timeout(2000),
        });
        if (statusRes.ok) {
          return NextResponse.json({ ok: true, message: 'Daemon is already running' });
        }
      } catch {
        // Not running — proceed to start
      }

      return new Promise<NextResponse>((resolve) => {
        const child = spawn('npx', ['tsx', daemonScript], {
          cwd: process.cwd(),
          detached: true,
          stdio: 'ignore',
          env: {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            NODE_ENV: process.env.NODE_ENV,
            PFC_DAEMON_PORT: String(DAEMON_PORT),
          },
        });

        child.unref();

        setTimeout(async () => {
          try {
            const res = await fetch(`${DAEMON_URL}/status`, {
              signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
              const data = await res.json();
              resolve(NextResponse.json({ ok: true, pid: data.pid }));
            } else {
              resolve(NextResponse.json({ ok: false, error: 'Daemon started but status check failed' }));
            }
          } catch {
            resolve(NextResponse.json({ ok: true, message: 'Daemon process spawned (may still be starting)' }));
          }
        }, 2000);
      });
    }

    case 'stop': {
      try {
        const res = await fetch(`${DAEMON_URL}/stop`, {
          method: 'POST',
          signal: AbortSignal.timeout(3000),
        });
        const data = await res.json();
        return NextResponse.json({ ok: true, ...data });
      } catch {
        return NextResponse.json({ ok: false, error: 'Daemon is not running' });
      }
    }

    case 'config': {
      // Only allow plain object config values (no nested functions, etc.)
      const config = body.config;
      if (config !== null && typeof config === 'object' && !Array.isArray(config)) {
        try {
          const res = await fetch(`${DAEMON_URL}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
            signal: AbortSignal.timeout(3000),
          });
          const data = await res.json();
          return NextResponse.json(data);
        } catch {
          return NextResponse.json({ ok: false, error: 'Daemon is not running' });
        }
      }
      return NextResponse.json({ error: 'config must be a plain object' }, { status: 400 });
    }

    case 'proxy': {
      const daemonPath = typeof body.daemonPath === 'string' ? body.daemonPath : '';
      if (!daemonPath) {
        return NextResponse.json({ error: 'Missing daemonPath' }, { status: 400 });
      }

      // Normalize to prevent path traversal
      const normalizedPath = path.posix.normalize(daemonPath);

      // Re-check after normalization — traversal like /fs/../shell would collapse
      if (!ALLOWED_PROXY_PREFIXES.some((p) => normalizedPath.startsWith(p))) {
        return NextResponse.json(
          { error: 'Daemon path not allowed through proxy' },
          { status: 403 },
        );
      }

      // Limit proxied data payload
      const proxyData = body.data !== undefined ? body.data : {};

      try {
        const res = await fetch(`${DAEMON_URL}${normalizedPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(proxyData),
          signal: AbortSignal.timeout(10000),
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
      } catch {
        return NextResponse.json({ ok: false, error: 'Daemon is not running' });
      }
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}

// ═══════════════════════════════════════════════════════════════════
// Route exports — dispatch by [action] param
// ═══════════════════════════════════════════════════════════════════

async function _GET(
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> },
) {
  const { action } = await context!.params;

  switch (action) {
    case 'ollama-check':
      return handleOllamaCheck(req);
    case 'ollama-status':
      return handleOllamaStatus(req);
    case 'daemon':
      return handleDaemonGet(req);
    default:
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

async function _POST(
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> },
) {
  const { action } = await context!.params;

  switch (action) {
    case 'test-connection':
      return handleTestConnection(req);
    case 'daemon':
      return handleDaemonPost(req);
    default:
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

// Rate limits applied at route level — using the highest common limit.
// Individual handler logic is preserved exactly as-is from original routes.
export const GET = withRateLimit(_GET, { maxRequests: 60, windowMs: 60_000 });
export const POST = withRateLimit(_POST, { maxRequests: 60, windowMs: 60_000 });
