import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emit, onStoreEvent, clearAllStoreEvents } from '@/lib/store/events';

describe('store event bus', () => {
  beforeEach(() => {
    clearAllStoreEvents();
  });

  it('delivers events to subscribers', () => {
    const handler = vi.fn();
    onStoreEvent('query:submitted', handler);

    emit('query:submitted', { query: 'test', mode: 'api' });

    expect(handler).toHaveBeenCalledWith({ query: 'test', mode: 'api' });
  });

  it('supports multiple subscribers', () => {
    const a = vi.fn();
    const b = vi.fn();
    onStoreEvent('query:completed', a);
    onStoreEvent('query:completed', b);

    emit('query:completed', { confidence: 0.9, grade: 'A', mode: 'meta-analytical', truthAssessment: null });

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('unsubscribe stops delivery', () => {
    const handler = vi.fn();
    const unsub = onStoreEvent('chat:cleared', handler);

    emit('chat:cleared', {});
    expect(handler).toHaveBeenCalledOnce();

    unsub();
    emit('chat:cleared', {});
    expect(handler).toHaveBeenCalledOnce(); // still 1, not 2
  });

  it('does not deliver to wrong event type', () => {
    const handler = vi.fn();
    onStoreEvent('query:submitted', handler);

    emit('chat:cleared', {});

    expect(handler).not.toHaveBeenCalled();
  });

  it('handles errors in handlers gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const badHandler = vi.fn(() => { throw new Error('boom'); });
    const goodHandler = vi.fn();

    onStoreEvent('query:submitted', badHandler);
    onStoreEvent('query:submitted', goodHandler);

    // Should not throw, and goodHandler should still run
    emit('query:submitted', { query: 'test', mode: 'api' });

    expect(badHandler).toHaveBeenCalled();
    expect(goodHandler).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledOnce();

    consoleSpy.mockRestore();
  });

  it('clearAllStoreEvents removes everything', () => {
    const handler = vi.fn();
    onStoreEvent('query:submitted', handler);

    clearAllStoreEvents();
    emit('query:submitted', { query: 'test', mode: 'api' });

    expect(handler).not.toHaveBeenCalled();
  });
});
