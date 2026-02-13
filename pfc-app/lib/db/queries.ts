import { db } from './index';
import { chat, message, chatSignals, user } from './schema';
import { desc, eq } from 'drizzle-orm';
import { generateUUID } from '@/lib/utils';

// --- User ---

export async function getOrCreateUser(userId: string) {
  const existing = await db.query.user.findFirst({
    where: eq(user.id, userId),
  });

  if (existing) return existing;

  const newUser = { id: userId, createdAt: new Date() };
  // Use onConflictDoNothing to handle concurrent insertions safely
  await db.insert(user).values(newUser).onConflictDoNothing().run();
  // Re-fetch to handle the case where another request inserted first
  return await db.query.user.findFirst({ where: eq(user.id, userId) }) ?? newUser;
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
  attachments,
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
  attachments?: string; // JSON stringified FileAttachment[]
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
      attachments: attachments ?? null,
      createdAt: new Date(),
    })
    .run();

  // Update chat's updatedAt
  await db.update(chat)
    .set({ updatedAt: new Date() })
    .where(eq(chat.id, chatId))
    .run();
}
