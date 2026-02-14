// ═══════════════════════════════════════════════════════════════════
// Daemon Config — reads/writes daemon_config SQLite table
// ═══════════════════════════════════════════════════════════════════

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'pfc.db');

// Default config values
const DEFAULTS: Record<string, string> = {
  // LLM settings
  'llm.mode': 'local',                         // 'local' | 'api'
  'llm.provider': 'anthropic',                  // 'openai' | 'anthropic' | 'google'
  'llm.apiKey': '',
  'llm.ollamaBaseUrl': 'http://localhost:11434',
  'llm.ollamaModel': 'llama3.1',
  'llm.openaiModel': 'gpt-4o',
  'llm.anthropicModel': 'claude-sonnet-4-20250514',
  'llm.googleModel': 'gemini-2.5-flash',
  'llm.allowCloudFallback': 'false',

  // Task intervals (in minutes)
  'task.connectionFinder.interval': '480',       // 8 hours
  'task.connectionFinder.enabled': 'true',
  'task.dailyBrief.hour': '8',                   // 8 AM
  'task.dailyBrief.enabled': 'true',
  'task.autoOrganizer.interval': '10080',         // 7 days
  'task.autoOrganizer.enabled': 'true',
  'task.researchAssistant.interval': '240',       // 4 hours
  'task.researchAssistant.enabled': 'true',
  'task.learningRunner.interval': '1440',         // 24 hours
  'task.learningRunner.enabled': 'true',
  'task.learningRunner.depth': 'moderate',        // shallow | moderate | deep
  'task.learningRunner.maxIterations': '2',

  // Permissions
  'permissions.level': 'sandboxed',              // sandboxed | file-access | full-access
  'permissions.baseDir': '',                     // Filesystem base directory

  // Active vault
  'vault.activeId': '',
};

export interface DaemonConfig {
  get(key: string): string;
  getNumber(key: string): number;
  getBool(key: string): boolean;
  set(key: string, value: string): void;
  getAll(): Record<string, string>;
}

export function createConfig(dbPath?: string): DaemonConfig {
  const sqlite = new Database(dbPath || DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');

  // Prepare statements
  const getStmt = sqlite.prepare('SELECT value FROM daemon_config WHERE key = ?');
  const setStmt = sqlite.prepare(
    `INSERT INTO daemon_config (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  );
  const getAllStmt = sqlite.prepare('SELECT key, value FROM daemon_config');

  return {
    get(key: string): string {
      const row = getStmt.get(key) as { value: string } | undefined;
      return row?.value ?? DEFAULTS[key] ?? '';
    },

    getNumber(key: string): number {
      return parseFloat(this.get(key)) || 0;
    },

    getBool(key: string): boolean {
      return this.get(key) === 'true';
    },

    set(key: string, value: string): void {
      setStmt.run(key, value, Date.now());
    },

    getAll(): Record<string, string> {
      const rows = getAllStmt.all() as { key: string; value: string }[];
      const result: Record<string, string> = { ...DEFAULTS };
      for (const row of rows) {
        result[row.key] = row.value;
      }
      return result;
    },
  };
}
