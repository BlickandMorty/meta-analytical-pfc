import { describe, it, expect, beforeEach } from 'vitest';
import { usePFCStore } from '@/lib/store/use-pfc-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capture a baseline snapshot of every state key for comparison */
function getStateKeys() {
  return Object.keys(usePFCStore.getState());
}

/** Validate that the core invariants hold for the current state */
function assertValidState() {
  const s = usePFCStore.getState();

  // Messages is always an array
  expect(Array.isArray(s.messages)).toBe(true);

  // Streaming flags are booleans
  expect(typeof s.isStreaming).toBe('boolean');
  expect(typeof s.isProcessing).toBe('boolean');
  expect(typeof s.isReasoning).toBe('boolean');

  // Numeric signals are numbers within sane bounds
  expect(typeof s.confidence).toBe('number');
  expect(typeof s.entropy).toBe('number');
  expect(typeof s.dissonance).toBe('number');
  expect(typeof s.healthScore).toBe('number');
  expect(typeof s.riskScore).toBe('number');
  expect(Number.isFinite(s.confidence)).toBe(true);
  expect(Number.isFinite(s.entropy)).toBe(true);

  // Pipeline stages is always an array with correct length (10 stages)
  expect(Array.isArray(s.pipelineStages)).toBe(true);
  expect(s.pipelineStages.length).toBe(10);

  // Signal history is capped and always an array
  expect(Array.isArray(s.signalHistory)).toBe(true);
  expect(s.signalHistory.length).toBeLessThanOrEqual(50);

  // String fields are strings
  expect(typeof s.streamingText).toBe('string');
  expect(typeof s.reasoningText).toBe('string');
  expect(typeof s.learningStreamText).toBe('string');

  // Collections are arrays
  expect(Array.isArray(s.pendingAttachments)).toBe(true);
  expect(Array.isArray(s.researchPapers)).toBe(true);
  expect(Array.isArray(s.currentCitations)).toBe(true);
  expect(Array.isArray(s.toasts)).toBe(true);
  expect(Array.isArray(s.chatThreads)).toBe(true);
  expect(Array.isArray(s.portalStack)).toBe(true);
  expect(Array.isArray(s.notePages)).toBe(true);
  expect(Array.isArray(s.noteBlocks)).toBe(true);

  // Concept weights is always a plain object
  expect(typeof s.conceptWeights).toBe('object');
  expect(s.conceptWeights !== null).toBe(true);
}

// ---------------------------------------------------------------------------
// Store integrity tests
// ---------------------------------------------------------------------------

describe('store integrity', () => {
  beforeEach(() => {
    localStorage.clear();
    // Full reset by calling the store's own reset, then wiping residual state
    usePFCStore.getState().reset();
  });

  // ═══════════════════════════════════════════════════════════════════
  // 1. Initialization
  // ═══════════════════════════════════════════════════════════════════

  it('initializes with all expected state keys', () => {
    const keys = getStateKeys();
    // Spot-check critical keys from each slice
    const required = [
      // message slice
      'messages', 'streamingText', 'isStreaming', 'currentChatId',
      'pendingAttachments', 'reasoningText', 'isReasoning',
      // pipeline slice
      'pipelineStages', 'activeStage', 'isProcessing',
      'confidence', 'entropy', 'dissonance', 'healthScore',
      'safetyState', 'riskScore', 'signalHistory',
      // inference slice
      'inferenceMode', 'apiProvider', 'apiKey',
      // controls slice
      'controls', 'userSignalOverrides',
      // cortex slice
      'cortexArchive',
      // concepts slice
      'conceptWeights', 'queryConceptHistory',
      // tier slice
      'suiteTier', 'measurementEnabled', 'tierFeatures',
      // research slice
      'researchPapers', 'currentCitations',
      // portal slice
      'portalStack', 'showPortal',
      // UI slice
      'chatMode', 'chatMinimized', 'chatThreads', 'activeThreadId',
      // notes slice
      'notePages', 'noteBlocks', 'noteBooks',
      // learning slice
      'learningSession', 'learningStreamText',
      // SOAR slice
      'soarConfig', 'soarSession',
      // toast slice
      'toasts',
      // global
      'reset',
    ];
    for (const key of required) {
      expect(keys).toContain(key);
    }
  });

  it('passes full invariant check on fresh store', () => {
    assertValidState();
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. Core mutation functions produce valid state
  // ═══════════════════════════════════════════════════════════════════

  it('submitQuery adds a user message and clears attachments', () => {
    usePFCStore.getState().submitQuery('What is entropy?');
    const s = usePFCStore.getState();

    expect(s.messages.length).toBe(1);
    expect(s.messages[0]!.role).toBe('user');
    expect(s.messages[0]!.text).toBe('What is entropy?');
    expect(s.pendingAttachments).toEqual([]);
    assertValidState();
  });

  it('clearMessages resets messages and related state', () => {
    usePFCStore.getState().submitQuery('test');
    usePFCStore.getState().clearMessages();
    const s = usePFCStore.getState();

    expect(s.messages).toEqual([]);
    expect(s.currentChatId).toBeNull();
    expect(s.isStreaming).toBe(false);
    expect(s.streamingText).toBe('');
    assertValidState();
  });

  it('startStreaming / appendStreamingText / stopStreaming cycle', () => {
    usePFCStore.getState().startStreaming();
    expect(usePFCStore.getState().isStreaming).toBe(true);
    expect(usePFCStore.getState().streamingText).toBe('');

    usePFCStore.getState().appendStreamingText('Hello');
    usePFCStore.getState().appendStreamingText(' world');
    expect(usePFCStore.getState().streamingText).toBe('Hello world');

    usePFCStore.getState().stopStreaming();
    expect(usePFCStore.getState().isStreaming).toBe(false);
    // streamingText is preserved until explicitly cleared
    expect(usePFCStore.getState().streamingText).toBe('Hello world');

    usePFCStore.getState().clearStreamingText();
    expect(usePFCStore.getState().streamingText).toBe('');
    assertValidState();
  });

  it('reasoning actions follow correct lifecycle', () => {
    usePFCStore.getState().startReasoning();
    expect(usePFCStore.getState().isReasoning).toBe(true);

    usePFCStore.getState().appendReasoningText('Thinking...');
    expect(usePFCStore.getState().reasoningText).toBe('Thinking...');

    usePFCStore.getState().stopReasoning();
    expect(usePFCStore.getState().isReasoning).toBe(false);

    usePFCStore.getState().clearReasoning();
    expect(usePFCStore.getState().reasoningText).toBe('');
    assertValidState();
  });

  it('updateSignals mutates only provided signal fields', () => {
    usePFCStore.getState().updateSignals({ entropy: 0.7, dissonance: 0.3 });
    const s = usePFCStore.getState();

    expect(s.entropy).toBe(0.7);
    expect(s.dissonance).toBe(0.3);
    // Unset fields retain defaults
    expect(s.healthScore).toBe(1.0);
    assertValidState();
  });

  it('applySignalUpdate merges partial signal updates', () => {
    usePFCStore.getState().applySignalUpdate({
      confidence: 0.9,
      entropy: 0.2,
      safetyState: 'orange',
    });
    const s = usePFCStore.getState();

    expect(s.confidence).toBe(0.9);
    expect(s.entropy).toBe(0.2);
    expect(s.safetyState).toBe('orange');
    assertValidState();
  });

  it('loadMessages replaces entire message array', () => {
    usePFCStore.getState().submitQuery('first');
    const msgs = [
      { id: 'a', role: 'user' as const, text: 'loaded', timestamp: Date.now() },
      { id: 'b', role: 'system' as const, text: 'response', timestamp: Date.now() },
    ];
    usePFCStore.getState().loadMessages(msgs);
    expect(usePFCStore.getState().messages.length).toBe(2);
    expect(usePFCStore.getState().messages[0]!.id).toBe('a');
    assertValidState();
  });

  it('toggleMessageLayer alternates between raw and layman', () => {
    expect(usePFCStore.getState().activeMessageLayer).toBe('raw');
    usePFCStore.getState().toggleMessageLayer();
    expect(usePFCStore.getState().activeMessageLayer).toBe('layman');
    usePFCStore.getState().toggleMessageLayer();
    expect(usePFCStore.getState().activeMessageLayer).toBe('raw');
  });

  it('addToast / removeToast manages toast array', () => {
    usePFCStore.getState().addToast({ type: 'info', message: 'Test toast', duration: 0 });
    const s = usePFCStore.getState();
    expect(s.toasts.length).toBe(1);
    expect(s.toasts[0]!.message).toBe('Test toast');

    usePFCStore.getState().removeToast(s.toasts[0]!.id);
    expect(usePFCStore.getState().toasts.length).toBe(0);
    assertValidState();
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. Rapid sequential mutations
  // ═══════════════════════════════════════════════════════════════════

  it('handles 100 rapid submitQuery calls without corruption', () => {
    for (let i = 0; i < 100; i++) {
      usePFCStore.getState().submitQuery(`Query ${i}`);
    }
    const s = usePFCStore.getState();

    expect(s.messages.length).toBe(100);
    // Verify ordering
    expect(s.messages[0]!.text).toBe('Query 0');
    expect(s.messages[99]!.text).toBe('Query 99');
    // All must have unique IDs
    const ids = new Set(s.messages.map((m) => m.id));
    expect(ids.size).toBe(100);
    assertValidState();
  });

  it('handles rapid add-then-clear cycle', () => {
    for (let i = 0; i < 50; i++) {
      usePFCStore.getState().submitQuery(`msg ${i}`);
    }
    expect(usePFCStore.getState().messages.length).toBe(50);

    usePFCStore.getState().clearMessages();
    expect(usePFCStore.getState().messages.length).toBe(0);
    assertValidState();
  });

  it('rapid appendStreamingText does not lose data', () => {
    usePFCStore.getState().startStreaming();
    for (let i = 0; i < 200; i++) {
      usePFCStore.getState().appendStreamingText('x');
    }
    expect(usePFCStore.getState().streamingText.length).toBe(200);
    assertValidState();
  });

  it('rapid signal updates remain numerically valid', () => {
    for (let i = 0; i < 100; i++) {
      usePFCStore.getState().applySignalUpdate({
        confidence: Math.random(),
        entropy: Math.random(),
        dissonance: Math.random(),
      });
    }
    const s = usePFCStore.getState();
    expect(Number.isFinite(s.confidence)).toBe(true);
    expect(Number.isFinite(s.entropy)).toBe(true);
    expect(Number.isFinite(s.dissonance)).toBe(true);
    assertValidState();
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4. Corrupted localStorage hydration
  // ═══════════════════════════════════════════════════════════════════

  it('SOAR hydration handles corrupt JSON gracefully', () => {
    localStorage.setItem('pfc-soar-config', '{{not valid json}}');
    usePFCStore.getState().hydrateSOAR();
    // Should fall back to defaults, not throw
    expect(usePFCStore.getState().soarConfig).toBeTruthy();
    expect(typeof usePFCStore.getState().soarConfig.enabled).toBe('boolean');
    assertValidState();
  });

  it('SOAR hydration handles missing localStorage key', () => {
    localStorage.removeItem('pfc-soar-config');
    usePFCStore.getState().hydrateSOAR();
    expect(usePFCStore.getState().soarConfig).toBeTruthy();
    assertValidState();
  });

  it('cortex loadCortexFromStorage handles corrupt data', () => {
    localStorage.setItem('pfc-cortex-archive', 'CORRUPT');
    usePFCStore.getState().loadCortexFromStorage();
    // Should fall back to empty array
    expect(Array.isArray(usePFCStore.getState().cortexArchive)).toBe(true);
    assertValidState();
  });

  it('learning hydration handles corrupt history', () => {
    localStorage.setItem('pfc-learning-history', '<not json>');
    usePFCStore.getState().hydrateLearning();
    expect(Array.isArray(usePFCStore.getState().learningHistory)).toBe(true);
    assertValidState();
  });

  // ═══════════════════════════════════════════════════════════════════
  // 5. Store reset
  // ═══════════════════════════════════════════════════════════════════

  it('reset clears messages and pipeline but preserves tier', () => {
    // Seed state
    usePFCStore.getState().submitQuery('pre-reset message');
    usePFCStore.getState().startStreaming();
    usePFCStore.getState().appendStreamingText('partial');
    usePFCStore.getState().applySignalUpdate({ confidence: 0.95, entropy: 0.8 });
    usePFCStore.getState().setSuiteTier('full');

    const tierBefore = usePFCStore.getState().suiteTier;

    usePFCStore.getState().reset();
    const s = usePFCStore.getState();

    // Messages should be empty
    expect(s.messages).toEqual([]);
    expect(s.streamingText).toBe('');
    expect(s.isStreaming).toBe(false);
    expect(s.isProcessing).toBe(false);

    // Pipeline signals should be reset
    expect(s.confidence).toBe(0.5);
    expect(s.signalHistory).toEqual([]);

    // Tier should be preserved
    expect(s.suiteTier).toBe(tierBefore);

    assertValidState();
  });

  it('reset does not leak previous message references', () => {
    usePFCStore.getState().submitQuery('leak test');
    const msgsBefore = usePFCStore.getState().messages;

    usePFCStore.getState().reset();
    const msgsAfter = usePFCStore.getState().messages;

    // Ensure no reference sharing between pre-reset and post-reset
    expect(msgsAfter).not.toBe(msgsBefore);
    expect(msgsAfter.length).toBe(0);
  });

  it('double reset does not corrupt state', () => {
    usePFCStore.getState().submitQuery('msg');
    usePFCStore.getState().reset();
    usePFCStore.getState().reset();
    assertValidState();
    expect(usePFCStore.getState().messages).toEqual([]);
  });

  it('state remains valid after reset followed by mutations', () => {
    usePFCStore.getState().submitQuery('before reset');
    usePFCStore.getState().reset();

    // Mutate again after reset
    usePFCStore.getState().submitQuery('after reset');
    usePFCStore.getState().startStreaming();
    usePFCStore.getState().appendStreamingText('new text');

    const s = usePFCStore.getState();
    expect(s.messages.length).toBe(1);
    expect(s.messages[0]!.text).toBe('after reset');
    expect(s.streamingText).toBe('new text');
    assertValidState();
  });
});
