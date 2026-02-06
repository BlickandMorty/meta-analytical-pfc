import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'pfc.db');

let _sqlite: ReturnType<typeof Database> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _initialized = false;

function getSqlite() {
  if (!_sqlite) {
    _sqlite = new Database(DB_PATH);
    _sqlite.pragma('journal_mode = WAL');
    _sqlite.pragma('busy_timeout = 5000');
    _sqlite.pragma('synchronous = NORMAL');
    _sqlite.pragma('foreign_keys = true');
    _sqlite.pragma('temp_store = memory');
  }
  return _sqlite;
}

function initDb() {
  if (_initialized) return;
  const sqlite = getSqlite();

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS chat (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES user(id),
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS message (
      id TEXT PRIMARY KEY NOT NULL,
      chat_id TEXT NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'system')),
      content TEXT NOT NULL,
      dual_message TEXT,
      truth_assessment TEXT,
      confidence REAL,
      evidence_grade TEXT,
      mode TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS chat_signals (
      id TEXT PRIMARY KEY NOT NULL,
      chat_id TEXT NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
      confidence REAL NOT NULL DEFAULT 0.5,
      entropy REAL NOT NULL DEFAULT 0,
      dissonance REAL NOT NULL DEFAULT 0,
      health_score REAL NOT NULL DEFAULT 1.0,
      safety_state TEXT NOT NULL DEFAULT 'green',
      risk_score REAL NOT NULL DEFAULT 0,
      focus_depth REAL NOT NULL DEFAULT 3,
      temperature_scale REAL NOT NULL DEFAULT 1.0,
      queries_processed INTEGER NOT NULL DEFAULT 0,
      tda TEXT,
      concepts TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS pipeline_run (
      id TEXT PRIMARY KEY NOT NULL,
      chat_id TEXT NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
      message_id TEXT NOT NULL REFERENCES message(id) ON DELETE CASCADE,
      stages TEXT NOT NULL,
      started_at INTEGER NOT NULL DEFAULT (unixepoch()),
      completed_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_chat_user ON chat(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_updated ON chat(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_message_chat ON message(chat_id);
    CREATE INDEX IF NOT EXISTS idx_message_created ON message(created_at);
    CREATE INDEX IF NOT EXISTS idx_signals_chat ON chat_signals(chat_id);
    CREATE INDEX IF NOT EXISTS idx_pipeline_chat ON pipeline_run(chat_id);
  `);

  _initialized = true;
}

// Lazy getter — only creates the connection when accessed
export function getDb() {
  initDb();
  if (!_db) {
    _db = drizzle(getSqlite(), { schema });
  }
  return _db;
}

// For backward compatibility, export as `db` using a Proxy
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const realDb = getDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (realDb as any)[prop];
    if (typeof value === 'function') {
      return value.bind(realDb);
    }
    return value;
  },
});
