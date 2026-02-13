import { describe, it, expect } from 'vitest';
import { ApiClientError, isAbortLikeError, createSSEWriter } from '@/lib/api-utils';

// ── ApiClientError ──

describe('ApiClientError', () => {
  it('sets default status to 400', () => {
    const err = new ApiClientError('bad request');
    expect(err.status).toBe(400);
    expect(err.message).toBe('bad request');
    expect(err.name).toBe('ApiClientError');
  });

  it('accepts custom status', () => {
    const err = new ApiClientError('not found', 404);
    expect(err.status).toBe(404);
  });

  it('is an instanceof Error', () => {
    expect(new ApiClientError('test')).toBeInstanceOf(Error);
  });
});

// ── isAbortLikeError ──

describe('isAbortLikeError', () => {
  it('returns true for AbortError DOMException', () => {
    const err = new DOMException('aborted', 'AbortError');
    expect(isAbortLikeError(err)).toBe(true);
  });

  it('returns true for errors with AbortError name', () => {
    const err = new Error('something');
    err.name = 'AbortError';
    expect(isAbortLikeError(err)).toBe(true);
  });

  it('returns true for STREAM_CLOSED message', () => {
    expect(isAbortLikeError(new Error('STREAM_CLOSED by client'))).toBe(true);
  });

  it('returns true for Controller is already closed', () => {
    expect(isAbortLikeError(new Error('Controller is already closed'))).toBe(true);
  });

  it('returns true for ERR_INVALID_STATE', () => {
    expect(isAbortLikeError(new Error('ERR_INVALID_STATE'))).toBe(true);
  });

  it('returns false for regular errors', () => {
    expect(isAbortLikeError(new Error('something unrelated'))).toBe(false);
  });

  it('returns false for non-Error objects', () => {
    expect(isAbortLikeError('string')).toBe(false);
    expect(isAbortLikeError(42)).toBe(false);
    expect(isAbortLikeError(null)).toBe(false);
    expect(isAbortLikeError(undefined)).toBe(false);
  });
});

// ── createSSEWriter ──

describe('createSSEWriter', () => {
  function makeController() {
    const chunks: Uint8Array[] = [];
    let closed = false;
    // SAFETY: Partial mock — only enqueue/close are exercised by createSSEWriter
    const controller = {
      enqueue: (chunk: Uint8Array) => {
        if (closed) throw new Error('Controller is already closed');
        chunks.push(chunk);
      },
      close: () => { closed = true; },
    } as unknown as ReadableStreamDefaultController<Uint8Array>;
    return { controller, chunks, isClosed: () => closed };
  }

  it('writes SSE event format', () => {
    const { controller, chunks } = makeController();
    const writer = createSSEWriter(controller, new TextEncoder());

    writer.event({ type: 'hello', data: 42 });

    const text = new TextDecoder().decode(chunks[0]!);
    expect(text).toBe('data: {"type":"hello","data":42}\n\n');
  });

  it('writes [DONE] marker', () => {
    const { controller, chunks } = makeController();
    const writer = createSSEWriter(controller, new TextEncoder());

    writer.done();

    const text = new TextDecoder().decode(chunks[0]!);
    expect(text).toBe('data: [DONE]\n\n');
  });

  it('returns false after close', () => {
    const { controller } = makeController();
    const writer = createSSEWriter(controller, new TextEncoder());

    writer.close();
    expect(writer.isClosed()).toBe(true);
    expect(writer.event({ test: true })).toBe(false);
    expect(writer.raw('anything')).toBe(false);
  });

  it('handles enqueue errors gracefully', () => {
    // SAFETY: Partial mock — deliberately throws to test error handling
    const controller = {
      enqueue: () => { throw new Error('detached'); },
      close: () => {},
    } as unknown as ReadableStreamDefaultController<Uint8Array>;

    const writer = createSSEWriter(controller, new TextEncoder());

    // First write fails, but doesn't throw
    expect(writer.event({ x: 1 })).toBe(false);
    // Subsequent writes return false without trying
    expect(writer.isClosed()).toBe(true);
  });

  it('double close is safe', () => {
    const { controller } = makeController();
    const writer = createSSEWriter(controller, new TextEncoder());

    writer.close();
    // Second close should not throw
    expect(() => writer.close()).not.toThrow();
  });
});
