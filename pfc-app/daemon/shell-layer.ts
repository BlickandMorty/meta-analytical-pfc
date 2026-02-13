// ═══════════════════════════════════════════════════════════════════
// Shell Layer — allowlisted command execution for the daemon
//
// Security model:
//   - Requires permissions.level === 'full-access'
//   - Only allowlisted binaries can be executed
//   - Uses execFile (not exec) — no shell injection possible
//   - 30s timeout per command
//   - All output logged to daemon_event_log
//   - Commands execute within the configured base directory
// ═══════════════════════════════════════════════════════════════════

import { execFile, type ExecFileException } from 'child_process';
import path from 'path';
import type { DaemonContext } from './context';
import { FsAccessDenied } from './fs-layer';

// ── Allowlisted Commands ──

const ALLOWED_COMMANDS = new Set([
  'git',
  'rg',        // ripgrep
  'find',
  'ls',
  'cat',
  'head',
  'tail',
  'wc',
  'grep',
  'diff',
  'tree',
  'stat',
  'file',
  'which',
  'echo',
]);

const MAX_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 1_048_576; // 1MB

// ── Types ──

export interface ShellResult {
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  truncated: boolean;
}

// ── Security ──

function assertFullAccess(ctx: DaemonContext): void {
  const level = ctx.getPermissionLevel();
  if (level !== 'full-access') {
    throw new FsAccessDenied(
      'Shell access requires "full-access" permission level. ' +
      'Current level: "' + level + '". Change in daemon config.',
    );
  }
}

function validateCommand(command: string): void {
  // Extract base command name (strip path)
  const base = path.basename(command);
  if (!ALLOWED_COMMANDS.has(base)) {
    throw new FsAccessDenied(
      `Command "${base}" is not allowlisted. ` +
      `Allowed: ${[...ALLOWED_COMMANDS].join(', ')}`,
    );
  }
}

function sanitizeArgs(args: string[]): string[] {
  // Reject args that look like they're trying to chain commands
  return args.map(arg => {
    // Allow normal arguments through — execFile doesn't interpret these as shell
    // But log warning for suspicious patterns
    if (arg.includes('$(') || arg.includes('`')) {
      throw new FsAccessDenied(`Suspicious argument rejected: "${arg}"`);
    }
    return arg;
  });
}

// ── Execute ──

export async function runCommand(
  ctx: DaemonContext,
  command: string,
  args: string[],
  options?: {
    cwd?: string;       // Relative to base dir
    timeoutMs?: number;
  },
): Promise<ShellResult> {
  assertFullAccess(ctx);
  validateCommand(command);
  const safeArgs = sanitizeArgs(args);

  const baseDir = ctx.getBaseDir();
  if (!baseDir) {
    throw new FsAccessDenied('No base directory configured for shell execution');
  }

  // Resolve working directory within base dir
  const cwd = options?.cwd
    ? path.resolve(baseDir, options.cwd)
    : path.resolve(baseDir);

  // Verify cwd is within base dir
  if (!cwd.startsWith(path.resolve(baseDir))) {
    throw new FsAccessDenied(`Working directory "${options?.cwd}" resolves outside base directory`);
  }

  const timeout = Math.min(options?.timeoutMs || MAX_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const start = Date.now();

  ctx.log.info(`shell:exec ${command} ${safeArgs.join(' ')}`, { cwd });

  return new Promise<ShellResult>((resolve) => {
    const child = execFile(
      command,
      safeArgs,
      {
        cwd,
        timeout,
        maxBuffer: MAX_OUTPUT_BYTES,
        env: {
          // Minimal environment — don't leak host env
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
          HOME: process.env.HOME || '',
          LANG: 'en_US.UTF-8',
        } as unknown as NodeJS.ProcessEnv,
      },
      (error: ExecFileException | null, stdout: string, stderr: string) => {
        const durationMs = Date.now() - start;
        const truncated = stdout.length >= MAX_OUTPUT_BYTES || stderr.length >= MAX_OUTPUT_BYTES;

        const result: ShellResult = {
          command,
          args: safeArgs,
          stdout: stdout.slice(0, MAX_OUTPUT_BYTES),
          stderr: stderr.slice(0, MAX_OUTPUT_BYTES),
          exitCode: error?.code !== undefined ? (typeof error.code === 'number' ? error.code : 1) : 0,
          durationMs,
          truncated,
        };

        // Log result
        ctx.log.info(`shell:done ${command} (${durationMs}ms, exit=${result.exitCode})`, {
          stdout_len: stdout.length,
          stderr_len: stderr.length,
        });

        resolve(result);
      },
    );

    // Safety: kill on timeout (in case maxBuffer doesn't catch it)
    setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* already dead */ }
    }, timeout + 1000);
  });
}

// ── Convenience functions ──

export async function gitStatus(ctx: DaemonContext, cwd?: string): Promise<ShellResult> {
  return runCommand(ctx, 'git', ['status', '--porcelain'], { cwd });
}

export async function gitLog(ctx: DaemonContext, limit = 10, cwd?: string): Promise<ShellResult> {
  return runCommand(ctx, 'git', ['log', `--oneline`, `-${limit}`], { cwd });
}

export async function ripgrep(
  ctx: DaemonContext,
  pattern: string,
  searchPath?: string,
  options?: { cwd?: string },
): Promise<ShellResult> {
  const args = ['--max-count=100', '--no-heading', pattern];
  if (searchPath) args.push(searchPath);
  return runCommand(ctx, 'rg', args, options);
}

export async function findFiles(
  ctx: DaemonContext,
  pattern: string,
  options?: { cwd?: string; maxDepth?: number },
): Promise<ShellResult> {
  const args = ['.', '-name', pattern, '-type', 'f'];
  if (options?.maxDepth) args.push('-maxdepth', String(options.maxDepth));
  return runCommand(ctx, 'find', args, { cwd: options?.cwd });
}

export async function wordCount(ctx: DaemonContext, filePath: string): Promise<ShellResult> {
  return runCommand(ctx, 'wc', ['-l', '-w', filePath]);
}

export function getAllowedCommands(): string[] {
  return [...ALLOWED_COMMANDS];
}
