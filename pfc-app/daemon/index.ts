#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// PFC Daemon — 24/7 autonomous note agent
//
// Standalone Node.js process that runs alongside the Next.js app.
// Accesses SQLite directly, calls LLM (Ollama or API), and
// persists results that the web UI picks up automatically.
//
// HTTP status server on port 3099 for web UI polling.
//
// Usage:
//   npx tsx daemon/index.ts             # start
//   npx tsx daemon/index.ts --status    # check status
//   npx tsx daemon/index.ts --stop      # stop running daemon
// ═══════════════════════════════════════════════════════════════════

import http from 'http';
import { createDaemonContext } from './context';
import { Scheduler } from './scheduler';
import {
  connectionFinder,
  dailyBrief,
  autoOrganizer,
  researchAssistant,
  learningRunner,
} from './tasks';
import {
  readFile, writeFile, listDirectory, fileExists, deleteFile,
  syncExport, syncImport,
  FsAccessDenied,
} from './fs-layer';
import {
  runCommand, getAllowedCommands,
} from './shell-layer';

const PORT = parseInt(process.env.PFC_DAEMON_PORT || '3099', 10);
const args = process.argv.slice(2);

// ── CLI: --status ──
if (args.includes('--status')) {
  checkStatus().then(process.exit);
}

// ── CLI: --stop ──
else if (args.includes('--stop')) {
  stopDaemon().then(process.exit);
}

// ── Default: start daemon ──
else {
  startDaemon();
}

// ═══════════════════════════════════════════════════════════════════
// Start
// ═══════════════════════════════════════════════════════════════════

function startDaemon() {
  console.log(`
╔══════════════════════════════════════════╗
║       PFC Daemon — Autonomous Agent      ║
║       Port: ${PORT}                          ║
╚══════════════════════════════════════════╝
`);

  const ctx = createDaemonContext();
  const scheduler = new Scheduler(ctx);

  // Register all tasks
  scheduler.register(connectionFinder);
  scheduler.register(dailyBrief);
  scheduler.register(autoOrganizer);
  scheduler.register(researchAssistant);
  scheduler.register(learningRunner);

  ctx.log.info(`Daemon starting (PID: ${process.pid})`);

  // ── HTTP Status Server ──
  const server = http.createServer((req, res) => {
    // CORS headers for web UI
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://localhost:${PORT}`);

    // GET /status — scheduler status
    if (url.pathname === '/status' && req.method === 'GET') {
      const status = scheduler.getStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        pid: process.pid,
        uptime: process.uptime(),
        ...status,
      }));
      return;
    }

    // GET /config — all config values
    if (url.pathname === '/config' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(ctx.config.getAll()));
      return;
    }

    // POST /config — update config values
    if (url.pathname === '/config' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const updates = JSON.parse(body) as Record<string, string>;
          for (const [key, value] of Object.entries(updates)) {
            ctx.config.set(key, value);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // GET /events — recent event log
    if (url.pathname === '/events' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      try {
        const events = ctx.sqlite.prepare(
          'SELECT * FROM daemon_event_log ORDER BY created_at DESC LIMIT ?'
        ).all(limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(events));
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to read events' }));
      }
      return;
    }

    // POST /stop — graceful shutdown
    if (url.pathname === '/stop' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Shutting down...' }));
      setTimeout(() => gracefulShutdown(ctx, scheduler, server), 100);
      return;
    }

    // ── Filesystem endpoints (require file-access or full-access) ──

    if (url.pathname.startsWith('/fs/') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const action = url.pathname.replace('/fs/', '');

          switch (action) {
            case 'read': {
              const content = await readFile(ctx, data.path);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, content }));
              return;
            }
            case 'write': {
              await writeFile(ctx, data.path, data.content);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
              return;
            }
            case 'list': {
              const entries = await listDirectory(ctx, data.path || '.');
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, entries }));
              return;
            }
            case 'exists': {
              const exists = await fileExists(ctx, data.path);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, exists }));
              return;
            }
            case 'delete': {
              await deleteFile(ctx, data.path);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true }));
              return;
            }
            case 'sync-export': {
              const result = await syncExport(ctx, data.vaultId, data.subDir);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, ...result }));
              return;
            }
            case 'sync-import': {
              const result = await syncImport(ctx, data.vaultId, data.subDir);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, ...result }));
              return;
            }
            default: {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `Unknown fs action: ${action}` }));
              return;
            }
          }
        } catch (err) {
          const status = err instanceof FsAccessDenied ? 403 : 500;
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
      return;
    }

    // ── Shell endpoint (requires full-access) ──

    if (url.pathname === '/shell/exec' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const result = await runCommand(ctx, data.command, data.args || [], {
            cwd: data.cwd,
            timeoutMs: data.timeoutMs,
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ...result }));
        } catch (err) {
          const status = err instanceof FsAccessDenied ? 403 : 500;
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
      return;
    }

    // GET /shell/allowed — list allowlisted commands
    if (url.pathname === '/shell/allowed' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ commands: getAllowedCommands() }));
      return;
    }

    // GET /permissions — current permission level and capabilities
    if (url.pathname === '/permissions' && req.method === 'GET') {
      const level = ctx.getPermissionLevel();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        level,
        baseDir: ctx.getBaseDir() || null,
        capabilities: {
          sqlite: true,
          llm: true,
          fileRead: level !== 'sandboxed',
          fileWrite: level !== 'sandboxed',
          shell: level === 'full-access',
          markdownSync: level !== 'sandboxed',
        },
      }));
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(PORT, () => {
    ctx.log.info(`HTTP status server listening on port ${PORT}`);
    // Start the scheduler after server is up
    scheduler.start();
  });

  // ── Graceful shutdown on signals ──
  process.on('SIGINT', () => gracefulShutdown(ctx, scheduler, server));
  process.on('SIGTERM', () => gracefulShutdown(ctx, scheduler, server));

  // Handle uncaught errors without crashing
  process.on('uncaughtException', (err) => {
    ctx.log.error(`Uncaught exception: ${err.message}`, { stack: err.stack });
  });
  process.on('unhandledRejection', (reason) => {
    ctx.log.error(`Unhandled rejection: ${reason}`);
  });
}

function gracefulShutdown(
  ctx: ReturnType<typeof createDaemonContext>,
  scheduler: Scheduler,
  server: http.Server,
) {
  ctx.log.info('Shutting down gracefully...');
  scheduler.stop();
  server.close(() => {
    ctx.shutdown();
    process.exit(0);
  });
  // Force exit after 5s if still hanging
  setTimeout(() => process.exit(1), 5000);
}

// ═══════════════════════════════════════════════════════════════════
// CLI helpers
// ═══════════════════════════════════════════════════════════════════

async function checkStatus(): Promise<number> {
  try {
    const res = await fetch(`http://localhost:${PORT}/status`);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
    return 0;
  } catch {
    console.log('Daemon is not running');
    return 1;
  }
}

async function stopDaemon(): Promise<number> {
  try {
    const res = await fetch(`http://localhost:${PORT}/stop`, { method: 'POST' });
    const data = await res.json();
    console.log(data.message || 'Stop signal sent');
    return 0;
  } catch {
    console.log('Daemon is not running (or already stopped)');
    return 1;
  }
}
