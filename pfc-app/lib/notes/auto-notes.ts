'use client';

// ═══════════════════════════════════════════════════════════════════
// Auto-Notes — Automatically create notes from chat messages
// ═══════════════════════════════════════════════════════════════════
// Integrates the insight extractor with the notes slice of the
// PFC store. Processes assistant messages and creates blocks
// in a dedicated "AI Chat Insights" page.

import {
  extractInsightsFromText,
  formatInsightsAsBlocks,
  hasInsights,
} from '@/lib/notes/insight-extractor';
import type { InsightExtraction } from '@/lib/notes/insight-extractor';
import type { ChatMessage } from '@/lib/engine/types';

// ── Constants ──

/** Title for the auto-generated insights page */
export const AUTO_NOTES_PAGE_TITLE = 'AI Chat Insights';

/** Minimum content length (chars) to consider extraction worthwhile */
const MIN_CONTENT_LENGTH = 100;

/** Maximum blocks to create per single message (avoid spam) */
const MAX_BLOCKS_PER_MESSAGE = 5;

// ── Types ──

/**
 * Minimal store interface needed by auto-notes.
 * This avoids importing the full PFCState type, keeping the module
 * loosely coupled. The hook passes the real store at runtime.
 */
export interface AutoNotesStore {
  notePages: Array<{ id: string; name: string; title: string }>;
  ensurePage: (title: string) => string;
  createBlock: (
    pageId: string,
    parentId?: string | null,
    afterBlockId?: string | null,
    content?: string,
  ) => string;
  noteBlocks: Array<{ id: string; pageId: string; order: string }>;
}

// ═══════════════════════════════════════════════════════════════════
// Guard: should we extract from this message?
// ═══════════════════════════════════════════════════════════════════

/**
 * Returns true only for system (assistant) messages with enough
 * content to warrant insight extraction.
 *
 * Note: In the PFC engine, assistant messages use role='system'
 * in the ChatMessage type and have a dualMessage with rawAnalysis.
 * We check for 'system' role and/or the presence of dualMessage.
 */
export function shouldExtractFromMessage(
  message: Pick<ChatMessage, 'role' | 'text'> & { dualMessage?: { rawAnalysis?: string } },
): boolean {
  // Only process assistant/system messages (not user messages)
  if (message.role !== 'system') return false;

  // Prefer rawAnalysis content; fall back to text
  const content = message.dualMessage?.rawAnalysis || message.text || '';
  return content.length >= MIN_CONTENT_LENGTH;
}

// ═══════════════════════════════════════════════════════════════════
// Core: process a message and create note blocks
// ═══════════════════════════════════════════════════════════════════

/**
 * Extracts insights from a chat message and creates blocks in the
 * "AI Chat Insights" notes page.
 *
 * @param message  The chat message to process
 * @param store    The PFC store (or a compatible subset)
 * @returns The InsightExtraction result, or null if nothing was extracted
 */
export function processMessageForNotes(
  message: Pick<ChatMessage, 'role' | 'text' | 'timestamp'> & {
    dualMessage?: { rawAnalysis?: string };
  },
  store: AutoNotesStore,
): InsightExtraction | null {
  // Guard: only assistant messages with substantial content
  if (message.role !== 'system') return null;

  const content = message.dualMessage?.rawAnalysis || message.text || '';
  if (content.length < MIN_CONTENT_LENGTH) return null;

  // Extract insights
  const extraction = extractInsightsFromText(content);
  if (!hasInsights(extraction)) return null;

  // Ensure the "AI Chat Insights" page exists
  const pageId = store.ensurePage(AUTO_NOTES_PAGE_TITLE);

  // Build a timestamp label for the source
  const ts = message.timestamp ? new Date(message.timestamp) : new Date();
  const timeLabel = ts.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Create a short source label from the message text
  const snippet = (message.text || '').slice(0, 50).replace(/\n/g, ' ').trim();
  const sourceLabel = snippet ? `${timeLabel} — "${snippet}..."` : timeLabel;

  // Format insights into block strings
  const blockContents = formatInsightsAsBlocks(extraction, sourceLabel);
  if (blockContents.length === 0) return null;

  // Find the last block on this page to append after it
  const pageBlocks = store.noteBlocks
    .filter((b) => b.pageId === pageId)
    .sort((a, b) => a.order.localeCompare(b.order));
  const lastBlockId = pageBlocks.length > 0
    ? pageBlocks[pageBlocks.length - 1].id
    : null;

  // Create a header/separator block with the timestamp
  let prevBlockId = store.createBlock(
    pageId,
    null,
    lastBlockId,
    `---\n**Chat Insight** \u2014 ${timeLabel}`,
  );

  // Create insight blocks (capped to avoid spam)
  const toCreate = blockContents.slice(0, MAX_BLOCKS_PER_MESSAGE);
  for (const content of toCreate) {
    prevBlockId = store.createBlock(pageId, null, prevBlockId, content);
  }

  return extraction;
}

// ═══════════════════════════════════════════════════════════════════
// Utility: get total insight count from an extraction
// ═══════════════════════════════════════════════════════════════════

export function countInsights(extraction: InsightExtraction): number {
  return (
    extraction.concepts.length +
    extraction.definitions.length +
    extraction.facts.length +
    extraction.actionItems.length +
    extraction.questions.length
  );
}
