'use client';

// ═══════════════════════════════════════════════════════════════════
// Insight Extractor — heuristic-based extraction from text
// ═══════════════════════════════════════════════════════════════════
// Pure function module: no side effects, no store access.
// Extracts structured insights from assistant messages using
// regex/heuristic patterns (no LLM calls required).

// ── Types ──

export interface InsightExtraction {
  concepts: string[];
  definitions: string[];
  facts: string[];
  actionItems: string[];
  questions: string[];
}

// ── Constants ──

/** Minimum word count for a line to be considered meaningful */
const MIN_LINE_WORDS = 4;

/** Maximum number of concepts to extract */
const MAX_CONCEPTS = 15;

/** Words to exclude from concept extraction (common filler) */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'just', 'because', 'but', 'and', 'or', 'if', 'while', 'although',
  'this', 'that', 'these', 'those', 'it', 'its', 'also', 'which',
  'what', 'who', 'whom', 'their', 'they', 'them', 'we', 'us', 'our',
  'you', 'your', 'he', 'she', 'him', 'her', 'his', 'my', 'me', 'i',
  'however', 'therefore', 'thus', 'hence', 'yet', 'still', 'already',
  'about', 'up', 'down', 'like', 'well', 'back', 'much', 'even', 'new',
  'one', 'two', 'three', 'four', 'five', 'first', 'second', 'third',
  'now', 'way', 'may', 'say', 'get', 'make', 'go', 'see', 'look',
  'come', 'think', 'know', 'take', 'find', 'give', 'tell', 'work',
  'call', 'try', 'ask', 'use', 'keep', 'let', 'begin', 'seem',
]);

// ── Definition patterns ──

const DEFINITION_PATTERNS = [
  /^(.+?)\s+(?:is|are)\s+(?:a|an|the)\s+(.+)/i,
  /^(.+?)\s+refers?\s+to\s+(.+)/i,
  /^(.+?)\s+means?\s+(.+)/i,
  /^(.+?)\s+(?:is|are)\s+defined\s+as\s+(.+)/i,
  /^(.+?)\s+can\s+be\s+(?:defined|described|understood)\s+as\s+(.+)/i,
  /^(?:by\s+)?definition[,:]?\s+(.+)/i,
];

// ── Fact patterns (lines containing numbers, statistics, dates) ──

const FACT_PATTERNS = [
  /\d+\.?\d*\s*%/,                         // percentages
  /\d{4}(?:\s*[-–]\s*\d{4})?/,             // years / year ranges
  /\b(?:study|studies|research|trial|experiment|survey|meta-analysis)\b/i,
  /\b(?:found|showed|demonstrated|revealed|indicated|suggested)\s+that\b/i,
  /\b(?:approximately|roughly|about|nearly|over|under)\s+\d/i,
  /\$\s*\d/,                               // dollar amounts
  /\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:million|billion|trillion|thousand)\b/i,
  /\bp\s*[<>=]\s*0?\.\d+/i,               // p-values
  /\b(?:OR|RR|HR|CI|NNT)\s*[=:]\s*\d/i,   // epidemiological measures
];

// ── Action item patterns ──

const ACTION_PATTERNS = [
  /\b(?:should|must|need\s+to|ought\s+to|have\s+to|required?\s+to)\b/i,
  /\bTODO\b/i,
  /\b(?:consider|recommend|suggest|advise|important\s+to|essential\s+to)\b/i,
  /\b(?:make\s+sure|ensure|verify|check|confirm|remember\s+to)\b/i,
];

// ── Technical term patterns (multi-word capitalized terms, acronyms) ──

const TECHNICAL_TERM_RE = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
const ACRONYM_RE = /\b([A-Z]{2,6})\b/g;
const QUOTED_TERM_RE = /["""]([^"""]+?)["""]/g;
const BOLD_TERM_RE = /\*\*([^*]+?)\*\*/g;

// ═══════════════════════════════════════════════════════════════════
// Core extraction function
// ═══════════════════════════════════════════════════════════════════

/**
 * Extract structured insights from a block of text using
 * heuristic pattern matching (no LLM needed).
 */
export function extractInsightsFromText(text: string): InsightExtraction {
  const result: InsightExtraction = {
    concepts: [],
    definitions: [],
    facts: [],
    actionItems: [],
    questions: [],
  };

  // Normalize: strip markdown headers but keep content
  const cleaned = text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/```[\s\S]*?```/g, '')   // Remove code blocks
    .replace(/`[^`]+`/g, '')          // Remove inline code
    .trim();

  // Split into lines and clean each
  const lines = cleaned
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-*>•]\s*/, '').trim())
    .filter((l) => l.length > 0);

  // ── Extract concepts ──
  const conceptSet = new Set<string>();

  // (a) Multi-word capitalized terms (e.g., "Prefrontal Cortex")
  let match: RegExpExecArray | null;
  TECHNICAL_TERM_RE.lastIndex = 0;
  while ((match = TECHNICAL_TERM_RE.exec(cleaned)) !== null) {
    const term = match[1].trim();
    if (term.split(/\s+/).length <= 5) {
      conceptSet.add(term);
    }
  }

  // (b) Acronyms (2-6 uppercase letters)
  ACRONYM_RE.lastIndex = 0;
  while ((match = ACRONYM_RE.exec(cleaned)) !== null) {
    const acr = match[1];
    // Skip very common non-technical acronyms
    if (!STOP_WORDS.has(acr.toLowerCase()) && acr.length >= 2) {
      conceptSet.add(acr);
    }
  }

  // (c) Bold terms (markdown **term**)
  BOLD_TERM_RE.lastIndex = 0;
  while ((match = BOLD_TERM_RE.exec(cleaned)) !== null) {
    const term = match[1].trim();
    if (term.split(/\s+/).length <= 6 && term.length > 2) {
      conceptSet.add(term);
    }
  }

  // (d) Quoted terms
  QUOTED_TERM_RE.lastIndex = 0;
  while ((match = QUOTED_TERM_RE.exec(cleaned)) !== null) {
    const term = match[1].trim();
    if (term.split(/\s+/).length <= 6 && term.length > 2) {
      conceptSet.add(term);
    }
  }

  result.concepts = Array.from(conceptSet).slice(0, MAX_CONCEPTS);

  // ── Process each line for definitions, facts, action items, questions ──

  const seenDefs = new Set<string>();
  const seenFacts = new Set<string>();
  const seenActions = new Set<string>();

  for (const line of lines) {
    const words = line.split(/\s+/);
    if (words.length < MIN_LINE_WORDS) continue;

    const trimmedLine = line.replace(/[.!;,]+$/, '').trim();

    // Questions
    if (line.endsWith('?')) {
      result.questions.push(line);
      continue;
    }

    // Definitions
    let isDef = false;
    for (const pattern of DEFINITION_PATTERNS) {
      if (pattern.test(line)) {
        const key = trimmedLine.toLowerCase().slice(0, 60);
        if (!seenDefs.has(key)) {
          seenDefs.add(key);
          result.definitions.push(line);
          isDef = true;
        }
        break;
      }
    }
    if (isDef) continue;

    // Action items
    let isAction = false;
    for (const pattern of ACTION_PATTERNS) {
      if (pattern.test(line)) {
        const key = trimmedLine.toLowerCase().slice(0, 60);
        if (!seenActions.has(key)) {
          seenActions.add(key);
          result.actionItems.push(line);
          isAction = true;
        }
        break;
      }
    }
    if (isAction) continue;

    // Facts (lines with numeric/statistical content)
    for (const pattern of FACT_PATTERNS) {
      if (pattern.test(line)) {
        const key = trimmedLine.toLowerCase().slice(0, 60);
        if (!seenFacts.has(key)) {
          seenFacts.add(key);
          result.facts.push(line);
        }
        break;
      }
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// Format insights as note blocks
// ═══════════════════════════════════════════════════════════════════

/**
 * Converts an InsightExtraction into an array of markdown-formatted
 * strings suitable for creating note blocks.
 *
 * @param extraction  The extraction result
 * @param sourceLabel A short label for the source (e.g., timestamp or query snippet)
 * @returns Array of markdown strings, one per note block
 */
export function formatInsightsAsBlocks(
  extraction: InsightExtraction,
  sourceLabel: string,
): string[] {
  const blocks: string[] = [];

  // Concepts block
  if (extraction.concepts.length > 0) {
    const conceptList = extraction.concepts
      .slice(0, 8)
      .map((c) => `\`${c}\``)
      .join(', ');
    blocks.push(`**Concepts** (${sourceLabel}): ${conceptList}`);
  }

  // Definitions block
  if (extraction.definitions.length > 0) {
    const defs = extraction.definitions.slice(0, 3);
    for (const def of defs) {
      blocks.push(`**Definition:** ${def}`);
    }
  }

  // Facts block
  if (extraction.facts.length > 0) {
    const facts = extraction.facts.slice(0, 3);
    for (const fact of facts) {
      blocks.push(`**Fact:** ${fact}`);
    }
  }

  // Action items block
  if (extraction.actionItems.length > 0) {
    const items = extraction.actionItems.slice(0, 3);
    for (const item of items) {
      blocks.push(`TODO ${item}`);
    }
  }

  // Questions block
  if (extraction.questions.length > 0) {
    const qs = extraction.questions.slice(0, 2);
    for (const q of qs) {
      blocks.push(`**Question:** ${q}`);
    }
  }

  return blocks;
}

// ═══════════════════════════════════════════════════════════════════
// Utility: check if extraction has meaningful content
// ═══════════════════════════════════════════════════════════════════

/**
 * Returns true if the extraction contains at least one non-empty category.
 */
export function hasInsights(extraction: InsightExtraction): boolean {
  return (
    extraction.concepts.length > 0 ||
    extraction.definitions.length > 0 ||
    extraction.facts.length > 0 ||
    extraction.actionItems.length > 0 ||
    extraction.questions.length > 0
  );
}
