import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api-middleware';
import { spawn } from 'child_process';
import path from 'path';

const DAEMON_PORT = parseInt(process.env.PFC_DAEMON_PORT || '3099', 10);
const DAEMON_URL = `http://localhost:${DAEMON_PORT}`;

// Allowed GET endpoints — whitelist only
const ALLOWED_GET_ENDPOINTS = new Set(['status', 'config', 'health', 'events', 'permissions']);

// Allowed POST proxy path prefixes
const ALLOWED_PROXY_PREFIXES = ['/fs/'];
// /shell/ intentionally excluded — too dangerous to expose through web proxy

// ═══════════════════════════════════════════════════════════════════
// GET /api/daemon — proxy status from daemon HTTP server
// ═══════════════════════════════════════════════════════════════════

async function _GET(req: NextRequest) {
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

// ═══════════════════════════════════════════════════════════════════
// POST /api/daemon — start, stop, or configure the daemon
// ═══════════════════════════════════════════════════════════════════

async function _POST(req: NextRequest) {
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

export const GET = withRateLimit(_GET, { maxRequests: 10, windowMs: 60_000 });
export const POST = withRateLimit(_POST, { maxRequests: 10, windowMs: 60_000 });
