// ═══════════════════════════════════════════════════════════════════
// Task Scheduler — serial queue with cron-like execution
//
// - Checks tasks every 60 seconds
// - Only one task runs at a time (local LLM is GPU-bound)
// - Respects enable/disable per task and interval configuration
// - Writes status to daemon_status table (web UI polls this)
// ═══════════════════════════════════════════════════════════════════

import type { DaemonContext } from './context';

export interface DaemonTask {
  name: string;
  description: string;
  /** Execute the task. Return a summary string for logging. */
  run(ctx: DaemonContext): Promise<string>;
}

interface TaskState {
  lastRunAt: number;    // unix ms
  lastResult: string;   // 'success' | 'error' | 'skipped'
  lastError?: string;
}

const CHECK_INTERVAL_MS = 60_000; // Check every 60s

export class Scheduler {
  private tasks: DaemonTask[] = [];
  private taskState = new Map<string, TaskState>();
  private running = false;
  private currentTask: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private abortController: AbortController | null = null;

  constructor(private ctx: DaemonContext) {}

  /** Register a task */
  register(task: DaemonTask): void {
    this.tasks.push(task);
    this.taskState.set(task.name, {
      lastRunAt: 0,
      lastResult: 'pending',
    });
  }

  /** Start the scheduler loop */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.abortController = new AbortController();

    this.updateStatus('running');
    this.ctx.log.info(`Scheduler started with ${this.tasks.length} tasks`);

    // Run first check immediately
    this.tick();

    // Then check periodically
    this.timer = setInterval(() => this.tick(), CHECK_INTERVAL_MS);
  }

  /** Stop the scheduler */
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.updateStatus('stopped');
    this.ctx.log.info('Scheduler stopped');
  }

  /** Check if any task is due and execute it */
  private async tick(): Promise<void> {
    if (!this.running || this.currentTask) return;

    for (const task of this.tasks) {
      if (!this.running) break;

      // Check if task is enabled
      const enabledKey = `task.${this.taskConfigKey(task.name)}.enabled`;
      if (!this.ctx.config.getBool(enabledKey)) continue;

      // Check if enough time has passed
      const intervalKey = `task.${this.taskConfigKey(task.name)}.interval`;
      const intervalMinutes = this.ctx.config.getNumber(intervalKey);
      if (intervalMinutes <= 0) continue;

      const state = this.taskState.get(task.name)!;
      const elapsed = Date.now() - state.lastRunAt;
      const intervalMs = intervalMinutes * 60_000;

      if (elapsed < intervalMs) continue;

      // Special handling for daily brief (run at specific hour)
      if (task.name === 'daily-brief') {
        const hour = this.ctx.config.getNumber('task.dailyBrief.hour');
        const now = new Date();
        if (now.getHours() !== hour) continue;
        // Only run once per day — check if already ran today
        if (state.lastRunAt > 0) {
          const lastRun = new Date(state.lastRunAt);
          if (lastRun.toDateString() === now.toDateString()) continue;
        }
      }

      // Execute this task
      await this.executeTask(task);
      break; // Only one task per tick (serial execution)
    }
  }

  private async executeTask(task: DaemonTask): Promise<void> {
    this.currentTask = task.name;
    this.updateStatus('running', task.name);
    this.ctx.log.task(task.name, `Starting task: ${task.description}`);

    const state = this.taskState.get(task.name)!;
    const startTime = Date.now();

    try {
      const summary = await task.run(this.ctx);
      state.lastRunAt = Date.now();
      state.lastResult = 'success';
      state.lastError = undefined;

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.ctx.log.task(task.name, `Completed in ${elapsed}s: ${summary}`);
    } catch (err) {
      state.lastRunAt = Date.now();
      state.lastResult = 'error';
      state.lastError = err instanceof Error ? err.message : String(err);

      this.ctx.log.error(`Task ${task.name} failed: ${state.lastError}`);
    } finally {
      this.currentTask = null;
      this.updateStatus('running');
    }
  }

  /** Update daemon_status table for web UI polling */
  private updateStatus(state: string, currentTask?: string): void {
    try {
      this.ctx.sqlite.prepare(
        `INSERT INTO daemon_status (id, pid, state, current_task, started_at, updated_at)
         VALUES ('singleton', ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           pid=excluded.pid, state=excluded.state,
           current_task=excluded.current_task, updated_at=excluded.updated_at`
      ).run(
        process.pid,
        state,
        currentTask ?? null,
        state === 'running' ? Date.now() : null,
        Date.now(),
      );
    } catch {
      // Non-critical — don't crash if status write fails
    }
  }

  /** Convert task name to config key format */
  private taskConfigKey(name: string): string {
    // "connection-finder" → "connectionFinder"
    return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  }

  /** Get current status for HTTP endpoint */
  getStatus(): {
    running: boolean;
    currentTask: string | null;
    tasks: Array<{ name: string; description: string; lastRunAt: number; lastResult: string; lastError?: string }>;
  } {
    return {
      running: this.running,
      currentTask: this.currentTask,
      tasks: this.tasks.map(t => {
        const state = this.taskState.get(t.name)!;
        return {
          name: t.name,
          description: t.description,
          lastRunAt: state.lastRunAt,
          lastResult: state.lastResult,
          lastError: state.lastError,
        };
      }),
    };
  }
}
