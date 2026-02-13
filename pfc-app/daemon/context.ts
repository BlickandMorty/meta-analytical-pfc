// ═══════════════════════════════════════════════════════════════════
// Daemon Context — shared context object passed to all tasks
//
// Provides: database access, LLM model, config, logger, notes data
// ═══════════════════════════════════════════════════════════════════

import Database from 'better-sqlite3';
import path from 'path';
import type { LanguageModel } from 'ai';
import { logger } from '@/lib/debug-logger';
import { resolveProvider } from '@/lib/engine/llm/provider';
import type { InferenceConfig } from '@/lib/engine/llm/config';
import type { DaemonConfig } from './config';
import { createConfig } from './config';
import type {
  NotePage, NoteBlock, NoteBook, Vault, Concept, PageLink,
} from '@/lib/notes/types';

const DB_PATH = path.join(process.cwd(), 'pfc.db');

// ── Event logger ──

export interface DaemonLogger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  task(taskName: string, message: string, data?: Record<string, unknown>): void;
}

function createLogger(sqlite: Database.Database): DaemonLogger {
  const logStmt = sqlite.prepare(
    `INSERT INTO daemon_event_log (event_type, task_name, payload, created_at) VALUES (?, ?, ?, ?)`
  );

  function log(level: string, message: string, taskName?: string, data?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const prefix = taskName ? `[${taskName}]` : '[daemon]';
    logger.info('daemon', `${timestamp} ${level.toUpperCase()} ${prefix} ${message}`);

    logStmt.run(
      level,
      taskName ?? null,
      JSON.stringify({ message, ...data }),
      Date.now(),
    );
  }

  return {
    info: (msg, data) => log('info', msg, undefined, data),
    warn: (msg, data) => log('warn', msg, undefined, data),
    error: (msg, data) => log('error', msg, undefined, data),
    task: (taskName, msg, data) => log('info', msg, taskName, data),
  };
}

// ── Notes data access (direct SQLite reads, no Drizzle needed) ──

export interface NotesData {
  getVaults(): Vault[];
  getPages(vaultId: string): NotePage[];
  getBlocks(vaultId: string): NoteBlock[];
  getBooks(vaultId: string): NoteBook[];
  getConcepts(vaultId: string): Concept[];
  getPageLinks(vaultId: string): PageLink[];
  getActiveVaultId(): string | null;

  // Write operations
  upsertPage(page: NotePage, vaultId: string): void;
  upsertBlock(block: NoteBlock): void;
  upsertPageLinks(vaultId: string, links: PageLink[]): void;
  upsertConcept(concept: Concept, vaultId: string): void;
  updatePageTags(pageId: string, tags: string[]): void;
}

function createNotesAccess(sqlite: Database.Database, config: DaemonConfig): NotesData {
  // Prepare read statements
  const getVaultsStmt = sqlite.prepare('SELECT * FROM note_vault');
  const getPagesStmt = sqlite.prepare('SELECT * FROM note_page WHERE vault_id = ?');
  const getBlocksStmt = sqlite.prepare(
    `SELECT b.* FROM note_block b
     INNER JOIN note_page p ON b.page_id = p.id
     WHERE p.vault_id = ?`
  );
  const getBooksStmt = sqlite.prepare('SELECT * FROM note_book WHERE vault_id = ?');
  const getConceptsStmt = sqlite.prepare('SELECT * FROM note_concept WHERE vault_id = ?');
  const getLinksStmt = sqlite.prepare(
    `SELECT l.* FROM note_page_link l
     INNER JOIN note_page p ON l.source_page_id = p.id
     WHERE p.vault_id = ?`
  );

  // Prepare write statements
  const upsertPageStmt = sqlite.prepare(
    `INSERT INTO note_page (id, vault_id, title, name, is_journal, journal_date, icon, cover_image, properties, tags, favorite, pinned, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title, name=excluded.name, properties=excluded.properties,
       tags=excluded.tags, updated_at=excluded.updated_at`
  );

  const upsertBlockStmt = sqlite.prepare(
    `INSERT INTO note_block (id, page_id, type, content, parent_id, block_order, collapsed, indent, properties, refs, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       content=excluded.content, type=excluded.type, properties=excluded.properties,
       refs=excluded.refs, updated_at=excluded.updated_at`
  );

  const insertLinkStmt = sqlite.prepare(
    `INSERT INTO note_page_link (source_page_id, target_page_id, source_block_id, context)
     VALUES (?, ?, ?, ?)`
  );

  const deleteLinksByPageStmt = sqlite.prepare(
    `DELETE FROM note_page_link WHERE source_page_id = ?`
  );

  const upsertConceptStmt = sqlite.prepare(
    `INSERT INTO note_concept (id, vault_id, name, source_page_id, source_block_id, type, context, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, context=excluded.context`
  );

  const updateTagsStmt = sqlite.prepare(
    `UPDATE note_page SET tags = ?, updated_at = ? WHERE id = ?`
  );

  function parseJSON<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function rowToVault(r: Record<string, unknown>): Vault {
    return {
      id: r.id as string,
      name: r.name as string,
      description: r.description as string | undefined,
      icon: r.icon as string | undefined,
      pageCount: (r.page_count as number) || 0,
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
    };
  }

  function rowToPage(r: Record<string, unknown>): NotePage {
    return {
      id: r.id as string,
      title: r.title as string,
      name: r.name as string,
      isJournal: !!(r.is_journal as number),
      journalDate: (r.journal_date as string) || undefined,
      icon: (r.icon as string) || undefined,
      coverImage: (r.cover_image as string) || undefined,
      properties: parseJSON(r.properties as string, {}),
      tags: parseJSON(r.tags as string, []),
      favorite: !!(r.favorite as number),
      pinned: !!(r.pinned as number),
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
    };
  }

  function rowToBlock(r: Record<string, unknown>): NoteBlock {
    return {
      id: r.id as string,
      pageId: r.page_id as string,
      type: (r.type as string) as NoteBlock['type'],
      content: r.content as string,
      parentId: (r.parent_id as string) || null,
      order: r.block_order as string,
      collapsed: !!(r.collapsed as number),
      indent: (r.indent as number) || 0,
      properties: parseJSON(r.properties as string, {}),
      refs: parseJSON(r.refs as string, []),
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
    };
  }

  return {
    getVaults: () => (getVaultsStmt.all() as Record<string, unknown>[]).map(rowToVault),
    getPages: (vid) => (getPagesStmt.all(vid) as Record<string, unknown>[]).map(rowToPage),
    getBlocks: (vid) => (getBlocksStmt.all(vid) as Record<string, unknown>[]).map(rowToBlock),
    getBooks: (vid) => {
      const rows = getBooksStmt.all(vid) as Record<string, unknown>[];
      return rows.map(r => ({
        id: r.id as string,
        title: r.title as string,
        description: (r.description as string) || undefined,
        icon: (r.icon as string) || undefined,
        coverColor: (r.cover_color as string) || undefined,
        pageIds: parseJSON(r.page_ids as string, []),
        chapters: parseJSON(r.chapters as string, []),
        autoGenerated: !!(r.auto_generated as number),
        category: (r.category as string) || undefined,
        createdAt: r.created_at as number,
        updatedAt: r.updated_at as number,
      }));
    },
    getConcepts: (vid) => {
      const rows = getConceptsStmt.all(vid) as Record<string, unknown>[];
      return rows.map(r => ({
        id: r.id as string,
        name: r.name as string,
        sourcePageId: r.source_page_id as string,
        sourceBlockId: r.source_block_id as string,
        type: r.type as Concept['type'],
        context: r.context as string,
        createdAt: r.created_at as number,
      }));
    },
    getPageLinks: (vid) => {
      const rows = getLinksStmt.all(vid) as Record<string, unknown>[];
      return rows.map(r => ({
        sourcePageId: r.source_page_id as string,
        targetPageId: r.target_page_id as string,
        sourceBlockId: r.source_block_id as string,
        context: (r.context as string) || '',
      }));
    },
    getActiveVaultId: () => config.get('vault.activeId') || null,

    // Write operations
    upsertPage: (page, vaultId) => {
      upsertPageStmt.run(
        page.id, vaultId, page.title, page.name,
        page.isJournal ? 1 : 0, page.journalDate ?? null,
        page.icon ?? null, page.coverImage ?? null,
        JSON.stringify(page.properties), JSON.stringify(page.tags),
        page.favorite ? 1 : 0, page.pinned ? 1 : 0,
        page.createdAt, page.updatedAt,
      );
    },
    upsertBlock: (block) => {
      upsertBlockStmt.run(
        block.id, block.pageId, block.type, block.content,
        block.parentId ?? null, block.order,
        block.collapsed ? 1 : 0, block.indent,
        JSON.stringify(block.properties), JSON.stringify(block.refs),
        block.createdAt, block.updatedAt,
      );
    },
    upsertPageLinks: (vaultId, links) => {
      // Get vault pages for scoped delete
      const pages = getPagesStmt.all(vaultId) as Record<string, unknown>[];
      const pageIds = new Set(pages.map(p => p.id as string));
      for (const pid of pageIds) {
        deleteLinksByPageStmt.run(pid);
      }
      for (const link of links) {
        insertLinkStmt.run(link.sourcePageId, link.targetPageId, link.sourceBlockId, link.context);
      }
    },
    upsertConcept: (concept, vaultId) => {
      upsertConceptStmt.run(
        concept.id, vaultId, concept.name,
        concept.sourcePageId, concept.sourceBlockId,
        concept.type, concept.context, concept.createdAt,
      );
    },
    updatePageTags: (pageId, tags) => {
      updateTagsStmt.run(JSON.stringify(tags), Date.now(), pageId);
    },
  };
}

// ── Full Daemon Context ──

export type PermissionLevel = 'sandboxed' | 'file-access' | 'full-access';

export interface DaemonContext {
  config: DaemonConfig;
  log: DaemonLogger;
  notes: NotesData;
  sqlite: Database.Database;
  resolveModel(): LanguageModel;
  getPermissionLevel(): PermissionLevel;
  getBaseDir(): string;
  shutdown(): void;
}

export function createDaemonContext(dbPath?: string): DaemonContext {
  const resolvedPath = dbPath || DB_PATH;
  const sqlite = new Database(resolvedPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = true');

  const config = createConfig(resolvedPath);
  const log = createLogger(sqlite);
  const notes = createNotesAccess(sqlite, config);

  return {
    config,
    log,
    notes,
    sqlite,

    resolveModel(): LanguageModel {
      const mode = config.get('llm.mode') as 'local' | 'api';
      const allowFallback = config.getBool('llm.allowCloudFallback');
      const apiKey = config.get('llm.apiKey');

      const inferenceConfig: InferenceConfig = {
        mode,
        apiProvider: config.get('llm.provider') as 'openai' | 'anthropic',
        apiKey,
        ollamaBaseUrl: config.get('llm.ollamaBaseUrl'),
        ollamaModel: config.get('llm.ollamaModel'),
        openaiModel: config.get('llm.openaiModel') as InferenceConfig['openaiModel'],
        anthropicModel: config.get('llm.anthropicModel') as InferenceConfig['anthropicModel'],
      };

      try {
        return resolveProvider(inferenceConfig);
      } catch (err) {
        // Fallback: if local mode fails and cloud fallback is allowed, try API
        if (mode === 'local' && allowFallback && apiKey) {
          log.warn(`Local LLM failed, falling back to cloud API: ${err instanceof Error ? err.message : String(err)}`);
          return resolveProvider({ ...inferenceConfig, mode: 'api' });
        }
        throw err;
      }
    },

    getPermissionLevel(): PermissionLevel {
      return (config.get('permissions.level') || 'sandboxed') as PermissionLevel;
    },

    getBaseDir(): string {
      return config.get('permissions.baseDir') || '';
    },

    shutdown() {
      sqlite.close();
    },
  };
}
