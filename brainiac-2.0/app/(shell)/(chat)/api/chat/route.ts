import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api-middleware';
import { logger } from '@/lib/debug-logger';
import { runPipeline, type ConversationContext } from '@/lib/engine/simulate';
import type { PipelineControls } from '@/lib/engine/types';
import type { SteeringBias } from '@/lib/engine/steering/types';
import type { InferenceConfig } from '@/lib/engine/llm/config';
import type { SOARConfig } from '@/lib/engine/soar/types';
import {
  classifyFile,
  extractTextContent,
  readFileFromDisk,
} from '@/lib/engine/file-processor';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname, resolve, basename } from 'path';
import {
  saveMessage,
  createChat,
  getChatById,
  updateChatTitle,
  getOrCreateUser,
  getMessagesByChatId,
} from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';
import { userId as toUserId, chatId as toChatId, messageId as toMessageId } from '@/lib/branded';
import type { ChatId } from '@/lib/branded';
import {
  createSSEWriter,
  isAbortLikeError,
  parseBodyWithLimit,
  sanitizeErrorMessage,
} from '@/lib/api-utils';

interface ChatRequestBody {
  query?: unknown;
  userId?: unknown;
  chatId?: unknown;
  controls?: unknown;
  steeringBias?: unknown;
  inferenceConfig?: unknown;
  soarConfig?: unknown;
  analyticsEngineEnabled?: unknown;
  chatMode?: unknown;
  attachments?: unknown;
  filePaths?: unknown;
}

/** Processed attachment ready for pipeline consumption */
interface ProcessedAttachment {
  id: string;
  name: string;
  category: 'image' | 'text' | 'data' | 'document' | 'other';
  mimeType: string;
  size: number;
  savedPath: string;
  base64?: string;
  extractedText: string | null;
}

/**
 * Build conversation context from prior messages so the pipeline can detect
 * follow-up queries and inherit the original topic.
 */
async function buildConversationContext(chatId: ChatId): Promise<ConversationContext | undefined> {
  try {
    // Only fetch the most recent 20 messages (desc) for context — avoids loading entire history
    const messages = await getMessagesByChatId(chatId, { limit: 20, orderBy: 'desc' });
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

    // Messages are already in desc order (most recent first) from the query
    return {
      previousQueries: userMessages, // already most recent first
      previousEntities: [...new Set(previousEntities)].slice(0, 8),
      rootQuestion: userMessages[userMessages.length - 1], // oldest in batch ≈ original question
    };
  } catch {
    return undefined;
  }
}

async function _POST(request: NextRequest) {
  let resolvedChatId = toChatId('');
  let query = '';
  let existingChat: Awaited<ReturnType<typeof getChatById>> | null = null;
  let controls: PipelineControls | undefined;
  let steeringBias: SteeringBias | undefined;
  let inferenceConfig: InferenceConfig | undefined;
  let soarConfig: SOARConfig | undefined;
  let analyticsEngineEnabled = true;
  let chatMode: 'research' | 'plain' | undefined;
  let conversationContext: ConversationContext | undefined;
  const processedAttachments: ProcessedAttachment[] = [];

  try {
    const parsedBody = await parseBodyWithLimit<ChatRequestBody>(request, 25 * 1024 * 1024);
    if ('error' in parsedBody) {
      return parsedBody.error;
    }
    const body = parsedBody.data;

    query = typeof body.query === 'string' ? body.query : '';
    const userId = typeof body.userId === 'string' ? body.userId : undefined;
    const chatId = typeof body.chatId === 'string' ? body.chatId : undefined;
    controls = body.controls as PipelineControls | undefined;
    steeringBias = body.steeringBias as SteeringBias | undefined;
    inferenceConfig = body.inferenceConfig as InferenceConfig | undefined;
    soarConfig = body.soarConfig as SOARConfig | undefined;
    analyticsEngineEnabled = body.analyticsEngineEnabled !== false; // default true
    const rawMode = typeof body.chatMode === 'string' ? body.chatMode : undefined;
    if (rawMode === 'research' || rawMode === 'plain') {
      chatMode = rawMode;
    }

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    // Enforce max query length to prevent abuse
    if (query.length > 50_000) {
      return NextResponse.json({ error: 'Query too long (max 50,000 characters)' }, { status: 400 });
    }

    // ── Process file attachments ─────────────────────────────
    // 1. Base64 attachments from browser upload
    if (Array.isArray(body.attachments)) {
      for (const att of body.attachments as Array<{ id: string; name: string; type: string; uri: string; size: number; mimeType: string }>) {
        try {
          const base64Data = (att.uri || '').split(',')[1] || '';
          const buffer = Buffer.from(base64Data, 'base64');
          // Sanitize attachment name: use only the base filename to prevent path traversal
          const safeName = basename(att.name || 'file');
          const ext = extname(safeName).toLowerCase();
          const category = classifyFile(att.mimeType, ext);

          // Sanitize attachment id: strip any path separators to prevent traversal
          const safeId = (att.id || generateUUID()).replace(/[/\\]/g, '_');

          // Save to uploads directory
          const uploadsDir = join(process.cwd(), 'uploads');
          await mkdir(uploadsDir, { recursive: true });
          const savedPath = join(uploadsDir, `${safeId}${ext}`);

          // Final guard: ensure the resolved path is still within uploads dir
          if (!resolve(savedPath).startsWith(resolve(uploadsDir))) {
            logger.error('chat/route', `Path traversal blocked for attachment: ${att.id}`);
            continue;
          }

          await writeFile(savedPath, buffer);

          const extractedText = await extractTextContent(buffer, att.mimeType, ext);

          processedAttachments.push({
            id: att.id,
            name: att.name,
            category,
            mimeType: att.mimeType,
            size: att.size,
            savedPath,
            base64: category === 'image' ? att.uri : undefined,
            extractedText,
          });
        } catch (attError) {
          logger.error('chat/route', `Failed to process attachment ${att.name}:`, attError);
        }
      }
    }

    // 2. File paths detected in query text — restricted to user home directory
    if (Array.isArray(body.filePaths)) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      for (const rawPath of body.filePaths as string[]) {
        try {
          // Security: resolve and restrict to home directory to prevent arbitrary file reads
          const expandedPath = rawPath.startsWith('~') ? rawPath.replace(/^~/, homeDir) : rawPath;
          const resolvedPath = resolve(expandedPath);
          if (!homeDir || !resolvedPath.startsWith(homeDir)) {
            logger.warn('chat/route', `Blocked file path outside home directory: ${rawPath}`);
            continue;
          }
          // Block sensitive directories even within home
          const sensitivePatterns = ['.ssh', '.gnupg', '.aws', '.azure', '.config/gcloud', '.kube', '.env'];
          const relPath = resolvedPath.slice(homeDir.length);
          if (sensitivePatterns.some((p) => relPath.includes(p))) {
            logger.warn('chat/route', `Blocked sensitive file path: ${rawPath}`);
            continue;
          }
          const fileData = await readFileFromDisk(rawPath);
          if (!fileData) continue;
          const category = classifyFile(fileData.mimeType, fileData.ext);
          const extractedText = await extractTextContent(fileData.buffer, fileData.mimeType, fileData.ext);

          processedAttachments.push({
            id: `path-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: fileData.name,
            category,
            mimeType: fileData.mimeType,
            size: fileData.size,
            savedPath: rawPath,
            base64: category === 'image' ? `data:${fileData.mimeType};base64,${fileData.buffer.toString('base64')}` : undefined,
            extractedText,
          });
        } catch (pathError) {
          logger.error('chat/route', `Failed to process file path ${rawPath}:`, pathError);
        }
      }
    }

    // Augment query with extracted text from documents
    const textAttachments = processedAttachments.filter((a) => a.extractedText);
    if (textAttachments.length > 0) {
      const attachmentContext = textAttachments
        .map((a) => `--- Attached file: ${a.name} ---\n${a.extractedText}\n--- End of ${a.name} ---`)
        .join('\n\n');
      query = `${attachmentContext}\n\n${query}`;
    }

    const resolvedUserId = toUserId(userId || 'local-user');
    resolvedChatId = toChatId(chatId || generateUUID());

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

    // Save user message (with attachment metadata if any)
    const userMsgId = toMessageId(generateUUID());
    await saveMessage({
      id: userMsgId,
      chatId: resolvedChatId,
      role: 'user',
      content: query,
      attachments: processedAttachments.length > 0
        ? JSON.stringify(processedAttachments.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.category,
            uri: a.savedPath,
            size: a.size,
            mimeType: a.mimeType,
          })))
        : undefined,
    });
  } catch (error) {
    logger.error('chat/route', 'Setup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const capturedQuery = query;
  const capturedChatId = resolvedChatId;
  const capturedExistingChat = existingChat;
  const capturedControls = controls;
  const capturedContext = conversationContext;
  const capturedSteeringBias = steeringBias;
  const capturedInferenceConfig = inferenceConfig;
  const capturedSoarConfig = soarConfig;
  const capturedAnalyticsEnabled = analyticsEngineEnabled;
  const capturedChatMode = chatMode;
  const capturedImages = processedAttachments
    .filter((a) => a.category === 'image' && a.base64)
    .map((a) => ({ mimeType: a.mimeType, base64: a.base64! }));

  // Use request.signal to detect client disconnect
  const clientSignal = request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      const writer = createSSEWriter(controller, encoder);

      try {
        // Send chatId first so client knows which chat this belongs to
        if (!writer.event({ type: 'chat-id', chatId: capturedChatId })) {
          writer.close();
          return;
        }

        // Run the pipeline and stream events (with conversation context)
        for await (const event of runPipeline(
          capturedQuery,
          capturedControls,
          capturedContext,
          capturedSteeringBias,
          capturedInferenceConfig,
          capturedSoarConfig,
          capturedAnalyticsEnabled,
          capturedChatMode,
          capturedImages.length > 0 ? capturedImages : undefined,
        )) {
          // Stop if client disconnected
          if (clientSignal.aborted || writer.isClosed()) {
            writer.close();
            return;
          }

          if (!writer.event(event)) {
            writer.close();
            return;
          }

          // When complete, save the system message to DB
          if (event.type === 'complete') {
            try {
              const sysMsgId = toMessageId(generateUUID());
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
              logger.error('chat/route', 'DB save error:', dbError);
              // Notify client that DB save failed (non-fatal)
              writer.event({
                type: 'error',
                message: 'Message saved to chat but failed to persist to database',
              });
            }
          }
        }

        // Signal end of stream
        writer.done();
        writer.close();
      } catch (error) {
        if (clientSignal.aborted || writer.isClosed() || isAbortLikeError(error)) {
          writer.close();
          return;
        }
        logger.error('chat/route', 'Pipeline error:', error);
        writer.event({ type: 'error', message: sanitizeErrorMessage(error) });
        writer.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const POST = withRateLimit(_POST, { maxRequests: 30, windowMs: 60_000 });
