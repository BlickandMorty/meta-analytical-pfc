import { NextRequest } from 'next/server';
import { runPipeline, type ConversationContext } from '@/lib/engine/simulate';
import type { SteeringBias } from '@/lib/engine/steering/types';
import {
  saveMessage,
  createChat,
  getChatById,
  updateChatTitle,
  getOrCreateUser,
  getMessagesByChatId,
} from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';

/**
 * Build conversation context from prior messages so the pipeline can detect
 * follow-up queries and inherit the original topic.
 */
async function buildConversationContext(chatId: string): Promise<ConversationContext | undefined> {
  try {
    const messages = await getMessagesByChatId(chatId);
    if (!messages || messages.length === 0) return undefined;

    const userMessages = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content);

    if (userMessages.length === 0) return undefined;

    // Extract entities from previous system responses (stored in dualMessage JSON)
    const previousEntities: string[] = [];
    for (const msg of messages) {
      if (msg.role === 'system' && msg.dualMessage) {
        try {
          const dual = JSON.parse(msg.dualMessage);
          // The layman summary's whatWasTried often contains the topic
          // But we can also extract entities from the raw analysis tags
          if (dual.laymanSummary?.whatIsLikelyTrue) {
            // Extract topic-relevant nouns from previous analysis
            const text = dual.laymanSummary.whatIsLikelyTrue;
            const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'for', 'and', 'but', 'this', 'that', 'with', 'from', 'not', 'has', 'have', 'its', 'may', 'can', 'more', 'most', 'some', 'all', 'each', 'than', 'also', 'which', 'what', 'where', 'when', 'how', 'about', 'evidence', 'analysis', 'system', 'question', 'answer', 'suggests', 'indicates', 'shows', 'found', 'between', 'through', 'multiple', 'specific']);
            const words = text.split(/\s+/)
              .map((w: string) => w.replace(/[^a-zA-Z]/g, '').toLowerCase())
              .filter((w: string) => w.length > 4 && !stopWords.has(w));
            previousEntities.push(...words.slice(0, 5));
          }
        } catch {
          // Skip malformed dualMessage
        }
      }
    }

    return {
      previousQueries: userMessages.reverse(), // most recent first
      previousEntities: [...new Set(previousEntities)].slice(0, 8),
      rootQuestion: userMessages[userMessages.length - 1], // first user message = original question
    };
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  let resolvedChatId: string;
  let query: string;
  let existingChat: Awaited<ReturnType<typeof getChatById>>;
  let controls: Record<string, unknown> | undefined;
  let steeringBias: SteeringBias | undefined;
  let conversationContext: ConversationContext | undefined;

  try {
    const body = await request.json();
    query = body.query;
    const userId = body.userId;
    const chatId = body.chatId;
    controls = body.controls;
    steeringBias = body.steeringBias;

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

    // Build conversation context from prior messages (for follow-up detection)
    if (existingChat) {
      conversationContext = await buildConversationContext(resolvedChatId);
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
  const capturedContext = conversationContext;
  const capturedSteeringBias = steeringBias;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send chatId first so client knows which chat this belongs to
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'chat-id', chatId: capturedChatId })}\n\n`
          )
        );

        // Run the pipeline and stream events (with conversation context)
        for await (const event of runPipeline(
          capturedQuery,
          controls as Parameters<typeof runPipeline>[1],
          capturedContext,
          capturedSteeringBias,
        )) {
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
