import { NextRequest, NextResponse } from 'next/server';
import { withMiddleware } from '@/lib/api-middleware';
import { logger } from '@/lib/debug-logger';
import { getChatsByUserId, getMessagesByChatId } from '@/lib/db/queries';

async function _GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId') || 'local-user';
  const chatId = request.nextUrl.searchParams.get('chatId');

  // Validate inputs: IDs should be reasonable alphanumeric/dash/underscore strings
  const ID_RE = /^[\w-]{1,128}$/;
  if (chatId && !ID_RE.test(chatId)) {
    return NextResponse.json({ error: 'Invalid chatId' }, { status: 400 });
  }
  if (!ID_RE.test(userId)) {
    return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });
  }

  try {
    if (chatId) {
      // Return messages for a specific chat
      const messages = await getMessagesByChatId(chatId);

      // Parse JSON fields (safely — corrupted rows don't crash the whole response)
      const parsed = messages.map((m) => {
        let dualMessage: unknown;
        let truthAssessment: unknown;
        try { dualMessage = m.dualMessage ? JSON.parse(m.dualMessage) : undefined; } catch { dualMessage = undefined; }
        try { truthAssessment = m.truthAssessment ? JSON.parse(m.truthAssessment) : undefined; } catch { truthAssessment = undefined; }

        const ts = m.createdAt instanceof Date
          ? m.createdAt.getTime()
          : typeof m.createdAt === 'number'
            ? m.createdAt * 1000
            : 0;

        return {
          id: m.id,
          chatId: m.chatId,
          role: m.role,
          text: m.content,
          timestamp: ts,
          confidence: m.confidence,
          evidenceGrade: m.evidenceGrade,
          mode: m.mode,
          dualMessage,
          truthAssessment,
        };
      });

      return NextResponse.json({ messages: parsed });
    }

    // Return chat list (paginated)
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 50, 200);
    const offset = Math.max(Number(request.nextUrl.searchParams.get('offset')) || 0, 0);
    const chats = await getChatsByUserId(userId, { limit, offset });
    return NextResponse.json({ chats });
  } catch (error) {
    logger.error('history', 'DB error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = withMiddleware(_GET, { maxRequests: 60, windowMs: 60_000, skipAuth: true });
