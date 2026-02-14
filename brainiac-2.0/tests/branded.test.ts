import { describe, it, expect } from 'vitest';
import {
  userId, chatId, messageId, pageId, blockId, vaultId, threadId,
} from '@/lib/branded';

describe('branded ID factories', () => {
  it('userId preserves the raw string', () => {
    const id = userId('user-abc');
    expect(id as string).toBe('user-abc');
  });

  it('chatId preserves the raw string', () => {
    const id = chatId('chat-123');
    expect(id as string).toBe('chat-123');
  });

  it('messageId preserves the raw string', () => {
    const id = messageId('msg-456');
    expect(id as string).toBe('msg-456');
  });

  it('pageId preserves the raw string', () => {
    const id = pageId('page-789');
    expect(id as string).toBe('page-789');
  });

  it('blockId preserves the raw string', () => {
    const id = blockId('block-xyz');
    expect(id as string).toBe('block-xyz');
  });

  it('vaultId preserves the raw string', () => {
    const id = vaultId('vault-001');
    expect(id as string).toBe('vault-001');
  });

  it('threadId preserves the raw string', () => {
    const id = threadId('thread-t1');
    expect(id as string).toBe('thread-t1');
  });

  // Runtime: branded types are still strings, so equality works
  it('branded IDs compare as strings at runtime', () => {
    const a = messageId('same');
    const b = messageId('same');
    expect(a).toBe(b);
  });
});
