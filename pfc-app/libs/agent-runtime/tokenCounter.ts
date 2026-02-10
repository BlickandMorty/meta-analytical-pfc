// ═══════════════════════════════════════════════════════════════════
// Token Counter & Context Compression
// Ported from LobeChat's tokenCounter.ts utility
// ═══════════════════════════════════════════════════════════════════

/** Default maximum context window (tokens) */
export const DEFAULT_MAX_CONTEXT = 128_000;

/** Trigger compression at this ratio of max context */
export const DEFAULT_THRESHOLD_RATIO = 0.5;

/**
 * Estimate token count for a string.
 * Uses the ~4 chars per token heuristic (GPT-family average).
 * More accurate than character count, cheaper than a real tokenizer.
 */
export function estimateTokens(content: string | unknown): number {
  if (content === null || content === undefined) return 0;
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  if (!text) return 0;
  // ~4 characters per token on average for English text
  // Adjusted: CJK characters count as ~1.5 tokens each
  const asciiChars = text.replace(/[^\x00-\x7F]/g, '').length;
  const nonAsciiChars = text.length - asciiChars;
  return Math.ceil(asciiChars / 4 + nonAsciiChars / 1.5);
}

export interface TokenCountMessage {
  role: string;
  content: string;
  metadata?: {
    usage?: {
      totalOutputTokens?: number;
    };
  };
}

/**
 * Calculate total tokens for a message array.
 * Prefers recorded output tokens for assistant messages when available.
 */
export function calculateMessageTokens(messages: TokenCountMessage[]): number {
  return messages.reduce((total, msg) => {
    // For assistant messages, prefer recorded token count from usage metadata
    if (msg.role === 'assistant' || msg.role === 'system') {
      const outputTokens = msg.metadata?.usage?.totalOutputTokens;
      if (outputTokens && outputTokens > 0) {
        return total + outputTokens;
      }
    }
    return total + estimateTokens(msg.content);
  }, 0);
}

export interface TokenCountOptions {
  maxWindowToken?: number;
  thresholdRatio?: number;
}

/**
 * Get the compression threshold in tokens.
 */
export function getCompressionThreshold(options: TokenCountOptions = {}): number {
  const maxContext = options.maxWindowToken ?? DEFAULT_MAX_CONTEXT;
  const ratio = options.thresholdRatio ?? DEFAULT_THRESHOLD_RATIO;
  return Math.floor(maxContext * ratio);
}

export interface CompressionCheckResult {
  currentTokenCount: number;
  needsCompression: boolean;
  threshold: number;
}

/**
 * Check if the conversation needs context compression.
 * Returns true if current token count exceeds the threshold.
 */
export function shouldCompress(
  messages: TokenCountMessage[],
  options: TokenCountOptions = {},
): CompressionCheckResult {
  const currentTokenCount = calculateMessageTokens(messages);
  const threshold = getCompressionThreshold(options);
  return {
    currentTokenCount,
    needsCompression: currentTokenCount > threshold,
    threshold,
  };
}

/**
 * Estimate the token count for a single chat message (for display purposes).
 */
export function estimateMessageTokens(text: string): number {
  return estimateTokens(text);
}

/**
 * Format token count for display (e.g., "12.3k tokens")
 */
export function formatTokenCount(count: number): string {
  if (count < 1000) return `${count} tokens`;
  if (count < 10_000) return `${(count / 1000).toFixed(1)}k tokens`;
  return `${Math.round(count / 1000)}k tokens`;
}
