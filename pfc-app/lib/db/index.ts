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

    -- Notes system tables
    CREATE TABLE IF NOT EXISTS note_vault (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      page_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_page (
      id TEXT PRIMARY KEY NOT NULL,
      vault_id TEXT NOT NULL REFERENCES note_vault(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      name TEXT NOT NULL,
      is_journal INTEGER NOT NULL DEFAULT 0,
      journal_date TEXT,
      icon TEXT,
      cover_image TEXT,
      properties TEXT NOT NULL DEFAULT '{}',
      tags TEXT NOT NULL DEFAULT '[]',
      favorite INTEGER NOT NULL DEFAULT 0,
      pinned INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_block (
      id TEXT PRIMARY KEY NOT NULL,
      page_id TEXT NOT NULL REFERENCES note_page(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'paragraph',
      content TEXT NOT NULL DEFAULT '',
      parent_id TEXT,
      block_order TEXT NOT NULL DEFAULT 'a0',
      collapsed INTEGER NOT NULL DEFAULT 0,
      indent INTEGER NOT NULL DEFAULT 0,
      properties TEXT NOT NULL DEFAULT '{}',
      refs TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_book (
      id TEXT PRIMARY KEY NOT NULL,
      vault_id TEXT NOT NULL REFERENCES note_vault(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      cover_color TEXT,
      page_ids TEXT NOT NULL DEFAULT '[]',
      chapters TEXT NOT NULL DEFAULT '[]',
      auto_generated INTEGER NOT NULL DEFAULT 0,
      category TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_concept (
      id TEXT PRIMARY KEY NOT NULL,
      vault_id TEXT NOT NULL REFERENCES note_vault(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      source_page_id TEXT NOT NULL,
      source_block_id TEXT NOT NULL,
      type TEXT NOT NULL,
      context TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_concept_correlation (
      id TEXT PRIMARY KEY NOT NULL,
      concept_a_id TEXT NOT NULL,
      concept_b_id TEXT NOT NULL,
      page_a_id TEXT NOT NULL,
      page_b_id TEXT NOT NULL,
      correlation_type TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      strength REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_page_link (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_page_id TEXT NOT NULL,
      target_page_id TEXT NOT NULL,
      source_block_id TEXT NOT NULL,
      context TEXT NOT NULL DEFAULT ''
    );

    -- Daemon tables (for Phase B)
    CREATE TABLE IF NOT EXISTS daemon_event_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      task_name TEXT,
      payload TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daemon_status (
      id TEXT PRIMARY KEY NOT NULL DEFAULT 'singleton',
      pid INTEGER,
      state TEXT NOT NULL DEFAULT 'stopped',
      current_task TEXT,
      started_at INTEGER,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daemon_config (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Notes indexes
    CREATE INDEX IF NOT EXISTS idx_note_page_vault ON note_page(vault_id);
    CREATE INDEX IF NOT EXISTS idx_note_page_name ON note_page(vault_id, name);
    CREATE INDEX IF NOT EXISTS idx_note_block_page ON note_block(page_id);
    CREATE INDEX IF NOT EXISTS idx_note_block_parent ON note_block(parent_id);
    CREATE INDEX IF NOT EXISTS idx_note_concept_page ON note_concept(source_page_id);
    CREATE INDEX IF NOT EXISTS idx_note_page_link_source ON note_page_link(source_page_id);
    CREATE INDEX IF NOT EXISTS idx_note_page_link_target ON note_page_link(target_page_id);
  `);

  _initialized = true;
}

// Lazy getter — only creates the connection when accessed
function getDb() {
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

