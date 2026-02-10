'use client';

// ═══════════════════════════════════════════════════════════════════
// StreamingHandler — Separates reasoning from output during streaming
// Ported from LobeChat's StreamingHandler pattern
// ═══════════════════════════════════════════════════════════════════

export type StreamChunkType = 'text' | 'reasoning' | 'stop';

export interface StreamChunk {
  type: StreamChunkType;
  text?: string;
}

export interface StreamingCallbacks {
  onContentUpdate: (content: string, reasoning: string) => void;
  onReasoningUpdate: (reasoning: string) => void;
  onReasoningStart: () => void;
  onReasoningComplete: (durationMs: number) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export class StreamingHandler {
  // Reasoning state
  private reasoningContent = '';
  private reasoningStartAt?: number;
  private reasoningDuration?: number;

  // Text state
  private output = '';

  // Callbacks
  private callbacks: StreamingCallbacks;

  constructor(callbacks: StreamingCallbacks) {
    this.callbacks = callbacks;
  }

  handleChunk(chunk: StreamChunk): void {
    switch (chunk.type) {
      case 'reasoning':
        this.handleReasoningChunk(chunk.text || '');
        break;
      case 'text':
        this.handleTextChunk(chunk.text || '');
        break;
      case 'stop':
        this.handleStop();
        break;
    }
  }

  private handleReasoningChunk(text: string): void {
    this.startReasoningIfNeeded();
    this.reasoningContent += text;
    this.callbacks.onReasoningUpdate(this.reasoningContent);
  }

  private handleTextChunk(text: string): void {
    this.endReasoningIfNeeded();
    this.output += text;
    this.callbacks.onContentUpdate(this.output, this.reasoningContent);
  }

  private handleStop(): void {
    this.endReasoningIfNeeded();
    this.callbacks.onComplete();
  }

  private startReasoningIfNeeded(): void {
    if (!this.reasoningStartAt) {
      this.reasoningStartAt = Date.now();
      this.callbacks.onReasoningStart();
    }
  }

  private endReasoningIfNeeded(): void {
    if (this.reasoningStartAt && !this.reasoningDuration) {
      this.reasoningDuration = Date.now() - this.reasoningStartAt;
      this.callbacks.onReasoningComplete(this.reasoningDuration);
    }
  }

  // Getters for final state
  get finalContent(): string { return this.output; }
  get finalReasoning(): string { return this.reasoningContent; }
  get thinkingDuration(): number | undefined { return this.reasoningDuration; }

  // Reset for reuse
  reset(): void {
    this.reasoningContent = '';
    this.reasoningStartAt = undefined;
    this.reasoningDuration = undefined;
    this.output = '';
  }
}

// ═══════════════════════════════════════════════════════════════════
// Artifact Detection — Parses code/math from AI output
// ═══════════════════════════════════════════════════════════════════

export const ARTIFACT_TAG = 'pfcArtifact';
export const THINKING_TAG = 'think';

export const ARTIFACT_TAG_REGEX = /<pfcArtifact\b([^>]*)>([\S\s]*?)(?:<\/pfcArtifact>|$)/;
export const THINKING_TAG_REGEX = /<think\b[^>]*>([\S\s]*?)(?:<\/think>|$)/;

/** Extract attributes from artifact tag */
export function parseArtifactAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = regex.exec(attrString)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

/** Detect code blocks in message content that should be pushed to portal */
export interface DetectedArtifact {
  identifier: string;
  title: string;
  type: string;
  language?: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

export function detectArtifacts(content: string): DetectedArtifact[] {
  const artifacts: DetectedArtifact[] = [];

  // 1. Detect <pfcArtifact> tags
  const tagMatch = ARTIFACT_TAG_REGEX.exec(content);
  if (tagMatch && tagMatch[2]) {
    const attrs = parseArtifactAttributes(tagMatch[1] || '');
    artifacts.push({
      identifier: attrs.identifier || `artifact-${Date.now()}`,
      title: attrs.title || 'Code',
      type: attrs.type || 'code',
      language: attrs.language,
      content: tagMatch[2].trim(),
      startIndex: tagMatch.index,
      endIndex: tagMatch.index + tagMatch[0].length,
    });
  }

  // 2. Detect fenced code blocks (```language ... ```)
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let codeMatch;
  while ((codeMatch = codeBlockRegex.exec(content)) !== null) {
    const language = codeMatch[1] || 'text';
    const code = codeMatch[2].trim();

    // Only push significant code blocks (>5 lines)
    if (code.split('\n').length > 5) {
      artifacts.push({
        identifier: `code-${codeMatch.index}`,
        title: `${language} code`,
        type: 'code',
        language,
        content: code,
        startIndex: codeMatch.index,
        endIndex: codeMatch.index + codeMatch[0].length,
      });
    }
  }

  return artifacts;
}

/** Extract thinking content from <think> tags */
export function extractThinking(content: string): { thinking: string; cleanContent: string } | null {
  const match = THINKING_TAG_REGEX.exec(content);
  if (!match) return null;

  const thinking = match[1].trim();
  const cleanContent = content.replace(match[0], '').trim();

  return { thinking, cleanContent };
}
