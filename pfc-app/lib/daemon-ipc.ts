/**
 * Daemon IPC types — shared contract between Next.js routes and the daemon process.
 *
 * The daemon runs as a separate process on DAEMON_PORT. The Next.js `/api/daemon`
 * route proxies requests to it. These types ensure both sides agree on shapes.
 */

// ── Error codes ──

export type DaemonErrorCode =
  | 'DAEMON_NOT_RUNNING'
  | 'DAEMON_START_FAILED'
  | 'DAEMON_TIMEOUT'
  | 'INVALID_ACTION'
  | 'INVALID_CONFIG'
  | 'PATH_NOT_ALLOWED'
  | 'BODY_TOO_LARGE';

export class DaemonError extends Error {
  code: DaemonErrorCode;

  constructor(code: DaemonErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'DaemonError';
    this.code = code;
  }
}

// ── Request types (discriminated union on `action`) ──

export interface DaemonStartRequest {
  action: 'start';
}

export interface DaemonStopRequest {
  action: 'stop';
}

export interface DaemonConfigRequest {
  action: 'config';
  config: Record<string, string>;
}

export interface DaemonProxyRequest {
  action: 'proxy';
  daemonPath: string;
  data?: unknown;
}

export type DaemonRequest =
  | DaemonStartRequest
  | DaemonStopRequest
  | DaemonConfigRequest
  | DaemonProxyRequest;

// ── Response types ──

export interface DaemonStatusResponse {
  running: boolean;
  pid?: number;
  uptime?: number;
  tasksCompleted?: number;
  tasksRunning?: number;
  error?: string;
}

export interface DaemonHealthResponse {
  ok: boolean;
  version?: string;
  dbConnected?: boolean;
  ollamaAvailable?: boolean;
}

export interface DaemonConfigResponse {
  ok: boolean;
  config?: Record<string, string>;
  error?: string;
}

export interface DaemonActionResponse {
  ok: boolean;
  message?: string;
  pid?: number;
  error?: string;
}

// ── Helpers ──

export const DAEMON_PORT = parseInt(process.env.PFC_DAEMON_PORT || '3099', 10);
export const DAEMON_URL = `http://localhost:${DAEMON_PORT}`;

/** Allowed GET endpoints — whitelist only */
export const ALLOWED_GET_ENDPOINTS = new Set(['status', 'config', 'health']);

/** Allowed POST proxy path prefixes (shell intentionally excluded) */
export const ALLOWED_PROXY_PREFIXES = ['/fs/'] as const;

/** Validate a daemon request body and return typed result */
export function parseDaemonRequest(body: unknown): DaemonRequest | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;

  const obj = body as Record<string, unknown>;
  const action = typeof obj.action === 'string' ? obj.action : '';

  switch (action) {
    case 'start':
      return { action: 'start' };
    case 'stop':
      return { action: 'stop' };
    case 'config': {
      const config = obj.config;
      if (config !== null && typeof config === 'object' && !Array.isArray(config)) {
        return { action: 'config', config: config as Record<string, string> };
      }
      return null;
    }
    case 'proxy': {
      const daemonPath = typeof obj.daemonPath === 'string' ? obj.daemonPath : '';
      if (!daemonPath) return null;
      return { action: 'proxy', daemonPath, data: obj.data };
    }
    default:
      return null;
  }
}
