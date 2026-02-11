import { NextRequest } from 'next/server';
import { getChatsByUserId, getMessagesByChatId } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId') || 'local-user';
  const chatId = request.nextUrl.searchParams.get('chatId');

  if (chatId) {
    // Return messages for a specific chat
    const messages = await getMessagesByChatId(chatId);

    // Parse JSON fields (safely — corrupted rows don't crash the whole response)
    const parsed = messages.map((m) => {
      let dualMessage: unknown;
      let truthAssessment: unknown;
      try { dualMessage = m.dualMessage ? JSON.parse(m.dualMessage) : undefined; } catch { dualMessage = undefined; }
      try { truthAssessment = m.truthAssessment ? JSON.parse(m.truthAssessment) : undefined; } catch { truthAssessment = undefined; }
      return {
        id: m.id,
        chatId: m.chatId,
        role: m.role,
        text: m.content,
        timestamp: m.createdAt instanceof Date ? m.createdAt.getTime() : Number(m.createdAt) * 1000,
        confidence: m.confidence,
        evidenceGrade: m.evidenceGrade,
        mode: m.mode,
        dualMessage,
        truthAssessment,
      };
    });

    return Response.json({ messages: parsed });
  }

  // Return chat list (paginated)
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 50, 200);
  const offset = Math.max(Number(request.nextUrl.searchParams.get('offset')) || 0, 0);
  const chats = await getChatsByUserId(userId, { limit, offset });
  return Response.json({ chats });
}
