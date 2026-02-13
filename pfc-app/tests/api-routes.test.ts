/**
 * API Route Edge-Case Tests
 *
 * Tests each major API route handler with:
 *   - Valid input  → expected response shape
 *   - Empty/missing body → 400 error
 *   - Malformed JSON → graceful 400 error
 *   - Missing required fields → validation error
 *
 * All external dependencies (DB, LLM, engine) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ────────────────────────────────────────────────────────

// Rate limiter — always allow
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 99, resetMs: 60_000 }),
  resetRateLimits: vi.fn(),
}));

// Logger — silence
vi.mock('@/lib/debug-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// DB queries — return minimal stubs
vi.mock('@/lib/db/queries', () => ({
  saveMessage: vi.fn(async () => {}),
  createChat: vi.fn(async () => {}),
  getChatById: vi.fn(async () => null),
  updateChatTitle: vi.fn(async () => {}),
  getOrCreateUser: vi.fn(async () => ({ id: 'local-user' })),
  getMessagesByChatId: vi.fn(async () => []),
  getChatsByUserId: vi.fn(async () => []),
}));

// Engine pipeline — return a simple async generator
vi.mock('@/lib/engine/simulate', () => ({
  runPipeline: async function* () {
    yield {
      type: 'complete',
      dualMessage: { rawAnalysis: 'test analysis', laymanSummary: {} },
      truthAssessment: {},
      confidence: 0.8,
      grade: 'B',
      mode: 'research',
    };
  },
}));

// Synthesizer
vi.mock('@/lib/engine/synthesizer', () => ({
  generateSynthesisReport: vi.fn(() => ({
    title: 'Test Report',
    overallConfidence: 0.75,
    sections: [],
  })),
}));

// Semantic Scholar (research route)
vi.mock('@/lib/engine/research/semantic-scholar', () => ({
  searchPapers: vi.fn(async () => ({ total: 0, papers: [] })),
  getPaperDetails: vi.fn(async () => null),
  getPaperCitations: vi.fn(async () => []),
  getPaperReferences: vi.fn(async () => []),
}));

// LLM-dependent research tools
vi.mock('@/lib/engine/research/novelty-check', () => ({
  checkNovelty: vi.fn(async () => ({ isNovel: true, score: 0.9 })),
}));
vi.mock('@/lib/engine/research/paper-review', () => ({
  reviewPaper: vi.fn(async () => ({ score: 7, review: 'Good' })),
  ensembleReviewPaper: vi.fn(async () => ({ score: 7, reviews: [] })),
}));
vi.mock('@/lib/engine/research/citation-search', () => ({
  searchCitations: vi.fn(async () => ({ citations: [] })),
  findCitationsForClaim: vi.fn(async () => ({ citations: [] })),
}));
vi.mock('@/lib/engine/research/idea-generator', () => ({
  generateIdeas: vi.fn(async () => ({ ideas: [] })),
  generateQuickIdea: vi.fn(async () => ({ name: 'idea', title: 'Test' })),
  refineIdea: vi.fn(async () => ({ name: 'refined', title: 'Refined' })),
}));

// LLM provider resolver — return a fake model
vi.mock('@/lib/engine/llm/provider', () => ({
  resolveProvider: vi.fn(() => ({ id: 'mock-model' })),
}));

// AI SDK streamText — return a fake text stream
vi.mock('ai', () => ({
  streamText: vi.fn(() => ({
    textStream: (async function* () { yield 'hello'; })(),
  })),
}));

// Assistant prompt builder
vi.mock('@/lib/engine/llm/assistant-prompt', () => ({
  buildAssistantSystemPrompt: vi.fn(() => 'You are a helpful assistant.'),
}));

// File processor (chat attachments)
vi.mock('@/lib/engine/file-processor', () => ({
  classifyFile: vi.fn(() => 'text'),
  extractTextContent: vi.fn(async () => null),
  readFileFromDisk: vi.fn(async () => null),
}));

// ── Helpers ───────────────────────────────────────────────────────

const BASE = 'http://localhost:3000';

function postRequest(path: string, body?: unknown): NextRequest {
  const init: RequestInit = { method: 'POST' };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(new URL(path, BASE), init);
}

function malformedRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, BASE), {
    method: 'POST',
    body: '{not valid json!!!',
    headers: { 'Content-Type': 'application/json' },
  });
}

function getRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, BASE), { method: 'GET' });
}

/** Read an SSE stream fully and return parsed events */
async function readSSEStream(response: Response): Promise<unknown[]> {
  const text = await response.text();
  return text
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => {
      const data = chunk.replace(/^data: /, '');
      if (data === '[DONE]') return { type: '__done__' };
      try { return JSON.parse(data); } catch { return { raw: data }; }
    });
}

async function parseJSON(response: Response) {
  return response.json();
}

// ── Tests ─────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────
//  Chat route — /api/chat (POST, SSE stream)
// ────────────────────────────────────────────────────────────────

describe('/api/chat', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/(chat)/api/chat/route');
    POST = mod.POST;
  });

  it('returns SSE stream for valid input', async () => {
    const res = await POST(postRequest('/api/chat', { query: 'What is gravity?' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    const events = await readSSEStream(res);
    expect(events.length).toBeGreaterThan(0);
    // First event should be chat-id
    expect(events[0]).toHaveProperty('type', 'chat-id');
  });

  it('returns 400 for missing query', async () => {
    const res = await POST(postRequest('/api/chat', { userId: 'test' }));
    expect(res.status).toBe(400);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('error');
    expect(typeof json.error).toBe('string');
  });

  it('returns 400 for empty body', async () => {
    const res = await POST(postRequest('/api/chat', {}));
    expect(res.status).toBe(400);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('error');
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(malformedRequest('/api/chat'));
    expect(res.status).toBe(400);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('error');
    expect(typeof json.error).toBe('string');
  });

  it('returns 400 for query that is too long', async () => {
    const longQuery = 'a'.repeat(60_000);
    const res = await POST(postRequest('/api/chat', { query: longQuery }));
    expect(res.status).toBe(400);
    const json = await parseJSON(res);
    expect(json.error).toContain('too long');
  });
});

// ────────────────────────────────────────────────────────────────
//  History route — /api/history (GET)
// ────────────────────────────────────────────────────────────────

describe('/api/history', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/(chat)/api/history/route');
    GET = mod.GET;
  });

  it('returns chat list for valid userId', async () => {
    const res = await GET(getRequest('/api/history?userId=local-user'));
    expect(res.status).toBe(200);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('chats');
    expect(Array.isArray(json.chats)).toBe(true);
  });

  it('returns messages when chatId is provided', async () => {
    const res = await GET(getRequest('/api/history?userId=local-user&chatId=abc-123'));
    expect(res.status).toBe(200);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('messages');
    expect(Array.isArray(json.messages)).toBe(true);
  });

  it('returns 400 for invalid chatId format', async () => {
    // chatId with special chars should fail ID_RE validation
    const res = await GET(getRequest('/api/history?chatId=../../../etc/passwd'));
    expect(res.status).toBe(400);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('error');
    expect(typeof json.error).toBe('string');
  });

  it('returns 400 for invalid userId format', async () => {
    const res = await GET(getRequest('/api/history?userId=' + 'x'.repeat(200)));
    expect(res.status).toBe(400);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('error');
  });

  it('defaults to local-user when userId is omitted', async () => {
    const res = await GET(getRequest('/api/history'));
    expect(res.status).toBe(200);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('chats');
  });
});

// ────────────────────────────────────────────────────────────────
//  Synthesis route — /api/synthesis (POST)
// ────────────────────────────────────────────────────────────────

describe('/api/synthesis', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/(chat)/api/synthesis/route');
    POST = mod.POST;
  });

  it('returns report for valid input', async () => {
    const res = await POST(postRequest('/api/synthesis', {
      messages: [{ role: 'user', content: 'hello' }],
      signals: { confidence: 0.8, entropy: 0.3 },
    }));
    expect(res.status).toBe(200);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('title');
    expect(json).toHaveProperty('overallConfidence');
  });

  it('returns 400 when messages is missing', async () => {
    const res = await POST(postRequest('/api/synthesis', {
      signals: { confidence: 0.5 },
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when signals is missing', async () => {
    const res = await POST(postRequest('/api/synthesis', {
      messages: [{ role: 'user', content: 'test' }],
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(malformedRequest('/api/synthesis'));
    expect(res.status).toBe(400);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('error');
  });

  it('returns 400 when messages is not an array', async () => {
    const res = await POST(postRequest('/api/synthesis', {
      messages: 'not-an-array',
      signals: { confidence: 0.5 },
    }));
    expect(res.status).toBe(400);
  });
});

// ────────────────────────────────────────────────────────────────
//  Research route — /api/research/[action] (POST)
// ────────────────────────────────────────────────────────────────

describe('/api/research/[action]', () => {
  let POST: (req: NextRequest, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/(chat)/api/research/[action]/route');
    POST = mod.POST;
  });

  function withAction(action: string) {
    return { params: Promise.resolve({ action }) };
  }

  // ── search-papers ──

  it('search-papers: returns results for valid query', async () => {
    const res = await POST(
      postRequest('/api/research/search-papers', { query: 'neural networks' }),
      withAction('search-papers'),
    );
    expect(res.status).toBe(200);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('total');
    expect(json).toHaveProperty('papers');
  });

  it('search-papers: returns 400 for missing query', async () => {
    const res = await POST(
      postRequest('/api/research/search-papers', {}),
      withAction('search-papers'),
    );
    expect(res.status).toBe(400);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('error');
    expect(typeof json.error).toBe('string');
  });

  it('search-papers: returns 400 for query too long', async () => {
    const res = await POST(
      postRequest('/api/research/search-papers', { query: 'x'.repeat(501) }),
      withAction('search-papers'),
    );
    expect(res.status).toBe(400);
    const json = await parseJSON(res);
    expect(json.error).toContain('too long');
  });

  // ── paper-details ──

  it('paper-details: returns 400 for missing paperId', async () => {
    const res = await POST(
      postRequest('/api/research/paper-details', {}),
      withAction('paper-details'),
    );
    expect(res.status).toBe(400);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('error');
  });

  it('paper-details: returns 404 when paper not found', async () => {
    const res = await POST(
      postRequest('/api/research/paper-details', { paperId: 'nonexistent' }),
      withAction('paper-details'),
    );
    expect(res.status).toBe(404);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('error');
  });

  // ── unknown action ──

  it('returns 404 for unknown action', async () => {
    const res = await POST(
      postRequest('/api/research/fake-action', {}),
      withAction('fake-action'),
    );
    expect(res.status).toBe(404);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('error');
    expect(json.error).toContain('Unknown');
  });

  // ── malformed JSON ──

  it('returns 400 for malformed JSON body', async () => {
    const res = await POST(
      malformedRequest('/api/research/search-papers'),
      withAction('search-papers'),
    );
    expect(res.status).toBe(400);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('error');
  });

  // ── LLM-dependent actions without inferenceConfig ──

  it('check-novelty: returns 400 when inferenceConfig is missing', async () => {
    const res = await POST(
      postRequest('/api/research/check-novelty', {
        title: 'Test',
        description: 'A test description',
      }),
      withAction('check-novelty'),
    );
    expect(res.status).toBe(400);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('error');
    expect(json.error).toContain('inferenceConfig');
  });

  it('review-paper: returns 400 when required fields are missing', async () => {
    const res = await POST(
      postRequest('/api/research/review-paper', {
        inferenceConfig: { mode: 'api', provider: 'openai', model: 'gpt-4' },
      }),
      withAction('review-paper'),
    );
    expect(res.status).toBe(400);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('error');
    expect(json.error).toContain('title');
  });
});

// ────────────────────────────────────────────────────────────────
//  Assistant route — /api/assistant (POST, SSE stream)
// ────────────────────────────────────────────────────────────────

describe('/api/assistant', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/api/assistant/route');
    POST = mod.POST;
  });

  it('returns SSE stream for valid input (simulation mode)', async () => {
    const res = await POST(postRequest('/api/assistant', {
      query: 'What is entropy?',
      context: {},
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    const events = await readSSEStream(res);
    expect(events.length).toBeGreaterThan(0);
    // Last event should be done
    const doneEvents = events.filter((e: any) => e.type === 'done');
    expect(doneEvents.length).toBeGreaterThan(0);
  });

  it('returns 400 for missing query', async () => {
    const res = await POST(postRequest('/api/assistant', { context: {} }));
    expect(res.status).toBe(400);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('error');
    expect(typeof json.error).toBe('string');
  });

  it('returns 400 for query that is too long', async () => {
    const res = await POST(postRequest('/api/assistant', {
      query: 'x'.repeat(11_000),
      context: {},
    }));
    expect(res.status).toBe(400);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('error');
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(malformedRequest('/api/assistant'));
    expect(res.status).toBe(400);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('error');
  });

  it('returns 400 for empty body (query will be falsy)', async () => {
    const res = await POST(postRequest('/api/assistant', {}));
    expect(res.status).toBe(400);
    const json = await parseJSON(res);
    expect(json).toHaveProperty('error');
  });
});

// ────────────────────────────────────────────────────────────────
//  Error shape consistency check
// ────────────────────────────────────────────────────────────────

describe('Error response shape', () => {
  it('all error responses have { error: string } shape', async () => {
    // Collect error responses from various routes
    const [chatMod, synthMod, histMod, assistMod] = await Promise.all([
      import('@/app/(chat)/api/chat/route'),
      import('@/app/(chat)/api/synthesis/route'),
      import('@/app/(chat)/api/history/route'),
      import('@/app/api/assistant/route'),
    ]);

    const errorResponses = await Promise.all([
      chatMod.POST(postRequest('/api/chat', {})),
      synthMod.POST(malformedRequest('/api/synthesis')),
      histMod.GET(getRequest('/api/history?chatId=../../evil')),
      assistMod.POST(postRequest('/api/assistant', {})),
    ]);

    for (const res of errorResponses) {
      expect(res.status).toBeGreaterThanOrEqual(400);
      const json = await parseJSON(res);
      expect(json).toHaveProperty('error');
      expect(typeof json.error).toBe('string');
      expect(json.error.length).toBeGreaterThan(0);
    }
  });
});
