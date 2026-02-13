import fs from 'fs';
import path from 'path';
import os from 'os';


// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_TEXT_LENGTH = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FileCategory = 'image' | 'text' | 'data' | 'document' | 'other';

/** Shape of the optional mammoth module for DOCX text extraction */
interface MammothLike {
  extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
}

// ---------------------------------------------------------------------------
// Supported extensions
// ---------------------------------------------------------------------------

const SUPPORTED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp',
  '.txt', '.md',
  '.csv', '.json',
  '.pdf', '.docx', '.doc',
]);

// ---------------------------------------------------------------------------
// Extension-to-MIME mapping
// ---------------------------------------------------------------------------

const EXT_TO_MIME: Record<string, string> = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.txt':  'text/plain',
  '.md':   'text/markdown',
  '.csv':  'text/csv',
  '.json': 'application/json',
  '.pdf':  'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc':  'application/msword',
};

// ---------------------------------------------------------------------------
// classifyFile
// ---------------------------------------------------------------------------

export function classifyFile(mimeType: string, ext: string): FileCategory {
  const e = ext.toLowerCase();
  const m = mimeType.toLowerCase();

  // Image
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(e) || m.startsWith('image/')) {
    return 'image';
  }

  // Text
  if (['.txt', '.md'].includes(e) || m === 'text/plain' || m === 'text/markdown') {
    return 'text';
  }

  // Data
  if (['.csv', '.json'].includes(e) || m === 'text/csv' || m === 'application/json') {
    return 'data';
  }

  // Document
  if (
    ['.pdf', '.docx', '.doc'].includes(e) ||
    m === 'application/pdf' ||
    m.includes('wordprocessingml')
  ) {
    return 'document';
  }

  return 'other';
}

// ---------------------------------------------------------------------------
// validateFile
// ---------------------------------------------------------------------------

export function validateFile(file: {
  size: number;
  name: string;
  mimeType: string;
}): { valid: boolean; error?: string } {
  // Size check
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 100 MB limit.`,
    };
  }

  // Extension check
  const ext = path.extname(file.name).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Unsupported file type "${ext}". Supported extensions: ${[...SUPPORTED_EXTENSIONS].join(', ')}.`,
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Truncation helper
// ---------------------------------------------------------------------------

function truncate(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text;
  return (
    text.slice(0, MAX_TEXT_LENGTH) +
    `\n\n[truncated — content exceeded ${MAX_TEXT_LENGTH.toLocaleString()} characters]`
  );
}

// ---------------------------------------------------------------------------
// extractTextContent
// ---------------------------------------------------------------------------

export async function extractTextContent(
  buffer: Buffer,
  mimeType: string,
  ext: string,
): Promise<string | null> {
  const e = ext.toLowerCase();
  const m = mimeType.toLowerCase();

  // Images → no text
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(e) || m.startsWith('image/')) {
    return null;
  }

  // Plain text / Markdown
  if (['.txt', '.md'].includes(e) || m === 'text/plain' || m === 'text/markdown') {
    return truncate(buffer.toString('utf-8'));
  }

  // JSON — pretty-print
  if (e === '.json' || m === 'application/json') {
    try {
      const parsed: unknown = JSON.parse(buffer.toString('utf-8'));
      return truncate(JSON.stringify(parsed, null, 2));
    } catch {
      // Not valid JSON, return raw
      return truncate(buffer.toString('utf-8'));
    }
  }

  // CSV — raw text
  if (e === '.csv' || m === 'text/csv') {
    return truncate(buffer.toString('utf-8'));
  }

  // PDF — dynamic import
  if (e === '.pdf' || m === 'application/pdf') {
    try {
      // @ts-expect-error -- pdf-parse has no type declarations
      const pdfParse = (await import('pdf-parse')).default as (buf: Buffer) => Promise<{ text: string }>;
      const data = await pdfParse(buffer);
      return truncate(data.text);
    } catch {
      return null;
    }
  }

  // DOCX / DOC — dynamic import
  if (['.docx', '.doc'].includes(e) || m.includes('wordprocessingml') || m === 'application/msword') {
    try {
      // SAFETY: mammoth is an optional dependency without bundled types.
      // The dynamic import returns a module with extractRawText on its default or named export.
      const mammothModule: { default?: MammothLike; extractRawText?: MammothLike['extractRawText'] } = await import('mammoth');
      const mammoth = mammothModule.default ?? mammothModule as unknown as MammothLike;
      const result = await mammoth.extractRawText({ buffer });
      return truncate(result.value);
    } catch {
      return null;
    }
  }

  // Fallback: try UTF-8
  try {
    return truncate(buffer.toString('utf-8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// resolveFilePath
// ---------------------------------------------------------------------------

export function resolveFilePath(rawPath: string): string | null {
  let resolved = rawPath;

  // Expand ~
  if (resolved.startsWith('~')) {
    resolved = resolved.replace(/^~/, os.homedir());
  }

  // Resolve relative paths
  resolved = path.resolve(resolved);

  // Check existence
  if (!fs.existsSync(resolved)) {
    return null;
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// detectFilePaths
// ---------------------------------------------------------------------------

const FILE_PATH_REGEX = /(?:\/[\w./-]+\.\w{2,5}|~\/[\w./-]+\.\w{2,5})/g;

export function detectFilePaths(query: string): string[] {
  const matches = query.match(FILE_PATH_REGEX);
  if (!matches) return [];

  return matches.filter((p) => {
    const ext = path.extname(p).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(ext);
  });
}

// ---------------------------------------------------------------------------
// readFileFromDisk
// ---------------------------------------------------------------------------

export async function readFileFromDisk(
  filePath: string,
): Promise<{
  buffer: Buffer;
  name: string;
  size: number;
  mimeType: string;
  ext: string;
} | null> {
  const resolved = resolveFilePath(filePath);
  if (!resolved) return null;

  try {
    const buffer = await fs.promises.readFile(resolved);
    const name = path.basename(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const mimeType = EXT_TO_MIME[ext] ?? 'application/octet-stream';

    return {
      buffer,
      name,
      size: buffer.length,
      mimeType,
      ext,
    };
  } catch {
    return null;
  }
}
