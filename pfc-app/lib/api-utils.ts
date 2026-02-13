import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_MAX_BODY_SIZE = 5 * 1024 * 1024; // 5 MB

export class ApiClientError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
  }
}

export function isAbortLikeError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.name === 'AbortError' ||
    error.message.includes('STREAM_CLOSED') ||
    error.message.includes('Controller is already closed') ||
    error.message.includes('ERR_INVALID_STATE')
  );
}

function jsonError(message: string, status: number): Response {
  return NextResponse.json({ error: message }, { status });
}

function maxSizeLabel(maxBytes: number): string {
  return `${Math.round(maxBytes / 1024 / 1024)}MB`;
}

async function readTextWithLimit(
  request: NextRequest,
  maxBytes: number,
): Promise<{ text: string } | { error: Response }> {
  const body = request.body;
  if (!body) {
    return { text: '' };
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      return {
        error: jsonError(`Request body too large (max ${maxSizeLabel(maxBytes)})`, 413),
      };
    }
    chunks.push(value);
  }

  if (chunks.length === 0) {
    return { text: '' };
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { text: new TextDecoder().decode(merged) };
}

/**
 * Parse JSON body with a strict size limit.
 *
 * Uses Content-Length as an early rejection and also enforces byte limit while
 * reading the stream, so missing/spoofed length headers are still bounded.
 */
export async function parseBodyWithLimit<T = unknown>(
  request: NextRequest,
  maxBytes = DEFAULT_MAX_BODY_SIZE,
): Promise<{ data: T } | { error: Response }> {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const parsedLength = parseInt(contentLength, 10);
    if (!Number.isNaN(parsedLength) && parsedLength > maxBytes) {
      return {
        error: jsonError(`Request body too large (max ${maxSizeLabel(maxBytes)})`, 413),
      };
    }
  }

  const raw = await readTextWithLimit(request, maxBytes);
  if ('error' in raw) {
    return raw;
  }

  if (!raw.text.trim()) {
    return { data: {} as T };
  }

  try {
    const parsed = JSON.parse(raw.text) as T;
    return { data: parsed };
  } catch {
    return { error: jsonError('Invalid JSON body', 400) };
  }
}

interface SSEWriter {
  event: (data: unknown) => boolean;
  raw: (payload: string) => boolean;
  done: () => boolean;
  close: () => void;
  isClosed: () => boolean;
}

export function createSSEWriter(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
): SSEWriter {
  let closed = false;

  const raw = (payload: string): boolean => {
    if (closed) return false;
    try {
      controller.enqueue(encoder.encode(payload));
      return true;
    } catch {
      closed = true;
      return false;
    }
  };

  const event = (data: unknown): boolean => raw(`data: ${JSON.stringify(data)}\n\n`);
  const done = (): boolean => raw('data: [DONE]\n\n');

  const close = () => {
    if (closed) return;
    closed = true;
    try {
      controller.close();
    } catch {
      // Ignore double-close and disconnected client errors.
    }
  };

  return {
    raw,
    event,
    done,
    close,
    isClosed: () => closed,
  };
}
