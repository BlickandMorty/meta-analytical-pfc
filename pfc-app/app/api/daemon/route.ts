import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

const DAEMON_PORT = parseInt(process.env.PFC_DAEMON_PORT || '3099', 10);
const DAEMON_URL = `http://localhost:${DAEMON_PORT}`;

// ═══════════════════════════════════════════════════════════════════
// GET /api/daemon — proxy status from daemon HTTP server
// ═══════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get('endpoint') || 'status';

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
//
// Body: { action: 'start' | 'stop' | 'config', ... }
// ═══════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const action = body.action as string;

  if (!action || typeof action !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid "action" field' }, { status: 400 });
  }

  switch (action) {
    case 'start': {
      // Spawn daemon as detached process
      const daemonScript = path.join(process.cwd(), 'daemon', 'index.ts');

      try {
        // Check if already running
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
        // Only pass required env vars to daemon — avoid leaking secrets
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

        // Unref so the parent process doesn't wait for the child
        child.unref();

        // Give it a moment to start
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
      try {
        const res = await fetch(`${DAEMON_URL}/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body.config || {}),
          signal: AbortSignal.timeout(3000),
        });
        const data = await res.json();
        return NextResponse.json(data);
      } catch {
        return NextResponse.json({ ok: false, error: 'Daemon is not running' });
      }
    }

    // ── Generic proxy: forward arbitrary POST to daemon ──
    // Used for Phase C endpoints: /fs/*, /shell/*, etc.
    case 'proxy': {
      const daemonPath = body.daemonPath as string;
      if (!daemonPath || typeof daemonPath !== 'string') {
        return NextResponse.json({ error: 'Missing daemonPath' }, { status: 400 });
      }

      // Security: normalize path to prevent traversal (e.g. /fs/../secret)
      const normalizedPath = path.posix.normalize(daemonPath);

      // Security: only allow known path prefixes
      const allowedPrefixes = ['/fs/', '/shell/'];
      if (!allowedPrefixes.some(p => normalizedPath.startsWith(p))) {
        return NextResponse.json(
          { error: `Daemon path "${normalizedPath}" is not allowed through the proxy` },
          { status: 403 },
        );
      }

      try {
        const res = await fetch(`${DAEMON_URL}${normalizedPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body.data || {}),
          signal: AbortSignal.timeout(35000), // 35s — shell commands can take up to 30s
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
      } catch {
        return NextResponse.json({ ok: false, error: 'Daemon is not running' });
      }
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
