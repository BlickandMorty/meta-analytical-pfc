import { NextRequest } from 'next/server';
import { getChatsByUserId, getMessagesByChatId } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId') || 'local-user';
  const chatId = request.nextUrl.searchParams.get('chatId');

  if (chatId) {
    // Return messages for a specific chat
    const messages = await getMessagesByChatId(chatId);

    // Parse JSON fields
    const parsed = messages.map((m) => ({
      id: m.id,
      chatId: m.chatId,
      role: m.role,
      text: m.content,
      timestamp: m.createdAt instanceof Date ? m.createdAt.getTime() : Number(m.createdAt) * 1000,
      confidence: m.confidence,
      evidenceGrade: m.evidenceGrade,
      mode: m.mode,
      dualMessage: m.dualMessage ? JSON.parse(m.dualMessage) : undefined,
      truthAssessment: m.truthAssessment ? JSON.parse(m.truthAssessment) : undefined,
    }));

    return Response.json({ messages: parsed });
  }

  // Return chat list
  const chats = await getChatsByUserId(userId);
  return Response.json({ chats });
}
