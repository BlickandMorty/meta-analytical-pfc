import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
  id: text('id').primaryKey().notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const chat = sqliteTable('chat', {
  id: text('id').primaryKey().notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  title: text('title').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const message = sqliteTable('message', {
  id: text('id').primaryKey().notNull(),
  chatId: text('chat_id')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'system'] }).notNull(),
  content: text('content').notNull(),
  // Stored as JSON string for dual message data
  dualMessage: text('dual_message'),
  truthAssessment: text('truth_assessment'),
  confidence: real('confidence'),
  evidenceGrade: text('evidence_grade'),
  mode: text('mode'),
  attachments: text('attachments'), // JSON array of FileAttachment metadata
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const chatSignals = sqliteTable('chat_signals', {
  id: text('id').primaryKey().notNull(),
  chatId: text('chat_id')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  confidence: real('confidence').notNull().default(0.5),
  entropy: real('entropy').notNull().default(0),
  dissonance: real('dissonance').notNull().default(0),
  healthScore: real('health_score').notNull().default(1.0),
  safetyState: text('safety_state').notNull().default('green'),
  riskScore: real('risk_score').notNull().default(0),
  focusDepth: real('focus_depth').notNull().default(3),
  temperatureScale: real('temperature_scale').notNull().default(1.0),
  queriesProcessed: integer('queries_processed').notNull().default(0),
  // TDA snapshot as JSON
  tda: text('tda'),
  // Concepts as JSON
  concepts: text('concepts'),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const pipelineRun = sqliteTable('pipeline_run', {
  id: text('id').primaryKey().notNull(),
  chatId: text('chat_id')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  messageId: text('message_id')
    .notNull()
    .references(() => message.id, { onDelete: 'cascade' }),
  // Full pipeline stages as JSON
  stages: text('stages').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

// ═══════════════════════════════════════════════════════════════════
// Notes System Tables
// ═══════════════════════════════════════════════════════════════════

export const noteVault = sqliteTable('note_vault', {
  id: text('id').primaryKey().notNull(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  pageCount: integer('page_count').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const notePage = sqliteTable('note_page', {
  id: text('id').primaryKey().notNull(),
  vaultId: text('vault_id').notNull().references(() => noteVault.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  name: text('name').notNull(),
  isJournal: integer('is_journal', { mode: 'boolean' }).notNull().default(false),
  journalDate: text('journal_date'),
  icon: text('icon'),
  coverImage: text('cover_image'),
  properties: text('properties').notNull().default('{}'),  // JSON
  tags: text('tags').notNull().default('[]'),               // JSON array
  favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const noteBlock = sqliteTable('note_block', {
  id: text('id').primaryKey().notNull(),
  pageId: text('page_id').notNull().references(() => notePage.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('paragraph'),
  content: text('content').notNull().default(''),
  parentId: text('parent_id'),
  blockOrder: text('block_order').notNull().default('a0'),
  collapsed: integer('collapsed', { mode: 'boolean' }).notNull().default(false),
  indent: integer('indent').notNull().default(0),
  properties: text('properties').notNull().default('{}'),   // JSON
  refs: text('refs').notNull().default('[]'),                // JSON array
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const noteBook = sqliteTable('note_book', {
  id: text('id').primaryKey().notNull(),
  vaultId: text('vault_id').notNull().references(() => noteVault.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  icon: text('icon'),
  coverColor: text('cover_color'),
  pageIds: text('page_ids').notNull().default('[]'),         // JSON array
  chapters: text('chapters').notNull().default('[]'),        // JSON array of NoteBookChapter
  autoGenerated: integer('auto_generated', { mode: 'boolean' }).notNull().default(false),
  category: text('category'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const noteConcept = sqliteTable('note_concept', {
  id: text('id').primaryKey().notNull(),
  vaultId: text('vault_id').notNull().references(() => noteVault.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sourcePageId: text('source_page_id').notNull(),
  sourceBlockId: text('source_block_id').notNull(),
  type: text('type').notNull(),  // heading, key-term, entity, definition, custom
  context: text('context').notNull().default(''),
  createdAt: integer('created_at').notNull(),
});

export const noteConceptCorrelation = sqliteTable('note_concept_correlation', {
  id: text('id').primaryKey().notNull(),
  conceptAId: text('concept_a_id').notNull(),
  conceptBId: text('concept_b_id').notNull(),
  pageAId: text('page_a_id').notNull(),
  pageBId: text('page_b_id').notNull(),
  correlationType: text('correlation_type').notNull(),
  description: text('description').notNull().default(''),
  strength: real('strength').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});

export const notePageLink = sqliteTable('note_page_link', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourcePageId: text('source_page_id').notNull(),
  targetPageId: text('target_page_id').notNull(),
  sourceBlockId: text('source_block_id').notNull(),
  context: text('context').notNull().default(''),
});

// ═══════════════════════════════════════════════════════════════════
// Daemon Tables (for Phase B)
// ═══════════════════════════════════════════════════════════════════

export const daemonEventLog = sqliteTable('daemon_event_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventType: text('event_type').notNull(),
  taskName: text('task_name'),
  payload: text('payload'),  // JSON
  createdAt: integer('created_at').notNull(),
});

export const daemonStatus = sqliteTable('daemon_status', {
  id: text('id').primaryKey().notNull().default('singleton'),
  pid: integer('pid'),
  state: text('state').notNull().default('stopped'),
  currentTask: text('current_task'),
  startedAt: integer('started_at'),
  updatedAt: integer('updated_at').notNull(),
});

export const daemonConfig = sqliteTable('daemon_config', {
  key: text('key').primaryKey().notNull(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// Type helpers
export type User = typeof user.$inferSelect;
export type Chat = typeof chat.$inferSelect;
export type Message = typeof message.$inferSelect;
export type ChatSignals = typeof chatSignals.$inferSelect;
export type PipelineRun = typeof pipelineRun.$inferSelect;
export type NoteVaultRow = typeof noteVault.$inferSelect;
export type NotePageRow = typeof notePage.$inferSelect;
export type NoteBlockRow = typeof noteBlock.$inferSelect;
export type NoteBookRow = typeof noteBook.$inferSelect;
export type NoteConceptRow = typeof noteConcept.$inferSelect;
export type NoteConceptCorrelationRow = typeof noteConceptCorrelation.$inferSelect;
export type NotePageLinkRow = typeof notePageLink.$inferSelect;
export type DaemonEventLogRow = typeof daemonEventLog.$inferSelect;
export type DaemonStatusRow = typeof daemonStatus.$inferSelect;
export type DaemonConfigRow = typeof daemonConfig.$inferSelect;
