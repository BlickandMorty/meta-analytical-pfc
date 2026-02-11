import { db } from './index';
import { chat, message, chatSignals, user, pipelineRun } from './schema';
import { desc, eq, and } from 'drizzle-orm';
import { generateUUID } from '@/lib/utils';

// --- User ---

export async function getOrCreateUser(userId: string) {
  const existing = await db.query.user.findFirst({
    where: eq(user.id, userId),
  });

  if (existing) return existing;

  const newUser = { id: userId, createdAt: new Date() };
  await db.insert(user).values(newUser).run();
  return newUser;
}

// --- Chat ---

export async function createChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  const now = new Date();
  await db.insert(chat)
    .values({ id, userId, title, createdAt: now, updatedAt: now })
    .run();

  // Create default signals for this chat
  await db.insert(chatSignals)
    .values({
      id: generateUUID(),
      chatId: id,
      updatedAt: now,
    })
    .run();

  return { id, userId, title, createdAt: now, updatedAt: now };
}

export async function getChatsByUserId(
  userId: string,
  opts?: { limit?: number; offset?: number },
) {
  return db.query.chat.findMany({
    where: eq(chat.userId, userId),
    orderBy: [desc(chat.updatedAt)],
    limit: opts?.limit ?? 50,
    offset: opts?.offset ?? 0,
  });
}

export async function getChatById(chatId: string) {
  return db.query.chat.findFirst({
    where: eq(chat.id, chatId),
  });
}

export async function updateChatTitle(chatId: string, title: string) {
  await db.update(chat)
    .set({ title, updatedAt: new Date() })
    .where(eq(chat.id, chatId))
    .run();
}

export async function deleteChat(chatId: string) {
  await db.delete(chat).where(eq(chat.id, chatId)).run();
}

// --- Messages ---

export async function getMessagesByChatId(
  chatId: string,
  opts?: { limit?: number; orderBy?: 'asc' | 'desc' },
) {
  const results = db.query.message.findMany({
    where: eq(message.chatId, chatId),
    orderBy: opts?.orderBy === 'desc' ? [desc(message.createdAt)] : [message.createdAt],
    ...(opts?.limit ? { limit: opts.limit } : {}),
  });
  return results;
}

export async function saveMessage({
  id,
  chatId,
  role,
  content,
  dualMessage: dualMsg,
  truthAssessment: truthAss,
  confidence: conf,
  evidenceGrade,
  mode,
}: {
  id: string;
  chatId: string;
  role: 'user' | 'system';
  content: string;
  dualMessage?: string;
  truthAssessment?: string;
  confidence?: number;
  evidenceGrade?: string;
  mode?: string;
}) {
  await db.insert(message)
    .values({
      id,
      chatId,
      role,
      content,
      dualMessage: dualMsg || null,
      truthAssessment: truthAss || null,
      confidence: conf ?? null,
      evidenceGrade: evidenceGrade || null,
      mode: mode || null,
      createdAt: new Date(),
    })
    .run();

  // Update chat's updatedAt
  await db.update(chat)
    .set({ updatedAt: new Date() })
    .where(eq(chat.id, chatId))
    .run();
}

// --- Signals ---

export async function getSignalsByChatId(chatId: string) {
  return db.query.chatSignals.findFirst({
    where: eq(chatSignals.chatId, chatId),
  });
}

export async function updateSignals(
  chatId: string,
  signals: Partial<{
    confidence: number;
    entropy: number;
    dissonance: number;
    healthScore: number;
    safetyState: string;
    riskScore: number;
    focusDepth: number;
    temperatureScale: number;
    queriesProcessed: number;
    tda: string;
    concepts: string;
  }>
) {
  await db.update(chatSignals)
    .set({ ...signals, updatedAt: new Date() })
    .where(eq(chatSignals.chatId, chatId))
    .run();
}

// --- Pipeline Runs ---

export async function savePipelineRun({
  id,
  chatId,
  messageId,
  stages,
}: {
  id: string;
  chatId: string;
  messageId: string;
  stages: string;
}) {
  await db.insert(pipelineRun)
    .values({
      id,
      chatId,
      messageId,
      stages,
      startedAt: new Date(),
    })
    .run();
}

export async function completePipelineRun(runId: string) {
  await db.update(pipelineRun)
    .set({ completedAt: new Date() })
    .where(eq(pipelineRun.id, runId))
    .run();
}
