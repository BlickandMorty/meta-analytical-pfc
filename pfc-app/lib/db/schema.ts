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

// Type helpers
export type User = typeof user.$inferSelect;
export type Chat = typeof chat.$inferSelect;
export type Message = typeof message.$inferSelect;
export type ChatSignals = typeof chatSignals.$inferSelect;
export type PipelineRun = typeof pipelineRun.$inferSelect;
