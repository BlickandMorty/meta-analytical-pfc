import { NextRequest } from 'next/server';
import { runPipeline } from '@/lib/engine/simulate';
import {
  saveMessage,
  createChat,
  getChatById,
  updateChatTitle,
  getOrCreateUser,
} from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';

export async function POST(request: NextRequest) {
  let resolvedChatId: string;
  let query: string;
  let existingChat: Awaited<ReturnType<typeof getChatById>>;
  let controls: Record<string, unknown> | undefined;

  try {
    const body = await request.json();
    query = body.query;
    const userId = body.userId;
    const chatId = body.chatId;
    controls = body.controls;

    if (!query || typeof query !== 'string') {
      return new Response('Missing query', { status: 400 });
    }

    const resolvedUserId = userId || 'local-user';
    resolvedChatId = chatId || generateUUID();

    // Ensure user exists first (foreign key constraint)
    await getOrCreateUser(resolvedUserId);

    // Ensure chat exists
    existingChat = await getChatById(resolvedChatId);
    if (!existingChat) {
      await createChat({
        id: resolvedChatId,
        userId: resolvedUserId,
        title: query.slice(0, 80),
      });
    }

    // Save user message
    const userMsgId = generateUUID();
    await saveMessage({
      id: userMsgId,
      chatId: resolvedChatId,
      role: 'user',
      content: query,
    });
  } catch (error) {
    console.error('[chat/route] Setup error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Setup failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const capturedQuery = query;
  const capturedChatId = resolvedChatId;
  const capturedExistingChat = existingChat;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send chatId first so client knows which chat this belongs to
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'chat-id', chatId: capturedChatId })}\n\n`
          )
        );

        // Run the pipeline and stream events
        for await (const event of runPipeline(capturedQuery, controls as Parameters<typeof runPipeline>[1])) {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          // When complete, save the system message to DB
          if (event.type === 'complete') {
            try {
              const sysMsgId = generateUUID();
              await saveMessage({
                id: sysMsgId,
                chatId: capturedChatId,
                role: 'system',
                content: event.dualMessage.rawAnalysis,
                dualMessage: JSON.stringify(event.dualMessage),
                truthAssessment: JSON.stringify(event.truthAssessment),
                confidence: event.confidence,
                evidenceGrade: event.grade,
                mode: event.mode,
              });

              // Update chat title if it's the first message
              if (!capturedExistingChat) {
                const title =
                  capturedQuery.length > 60
                    ? capturedQuery.slice(0, 57) + '...'
                    : capturedQuery;
                await updateChatTitle(capturedChatId, title);
              }
            } catch (dbError) {
              console.error('[chat/route] DB save error:', dbError);
            }
          }
        }

        // Signal end of stream
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        console.error('[chat/route] Pipeline error:', error);
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: errorMsg })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
