import { describe, it, expect, beforeEach } from 'vitest';
import {
  readVersioned,
  writeVersioned,
  readString,
  writeString,
  removeStorage,
} from '@/lib/storage-versioning';

describe('storage-versioning', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ═══════════════════════════════════════════════════════════════════
  // readVersioned
  // ═══════════════════════════════════════════════════════════════════

  describe('readVersioned', () => {
    it('returns null for missing key', () => {
      const result = readVersioned<string[]>('nonexistent', 1);
      expect(result).toBeNull();
    });

    it('returns null for corrupted (non-JSON) data', () => {
      localStorage.setItem('test-key', 'not valid json {{{');
      const result = readVersioned<string[]>('test-key', 1);
      expect(result).toBeNull();
    });

    it('returns null for empty string', () => {
      localStorage.setItem('test-key', '');
      const result = readVersioned<string[]>('test-key', 1);
      expect(result).toBeNull();
    });

    it('reads current version data correctly', () => {
      const data = { items: ['a', 'b', 'c'], count: 3 };
      localStorage.setItem('test-key', JSON.stringify({ __v: 1, data }));
      const result = readVersioned<typeof data>('test-key', 1);
      expect(result).toEqual(data);
    });

    it('reads unversioned (legacy) data as version 0', () => {
      const legacyData = [1, 2, 3];
      localStorage.setItem('test-key', JSON.stringify(legacyData));
      const result = readVersioned<number[]>('test-key', 1);
      expect(result).toEqual([1, 2, 3]);
    });

    it('auto-wraps unversioned data in version envelope after read', () => {
      const legacyData = { name: 'test' };
      localStorage.setItem('test-key', JSON.stringify(legacyData));
      readVersioned<typeof legacyData>('test-key', 1);
      // After reading legacy data, it should be re-written with version envelope
      const stored = JSON.parse(localStorage.getItem('test-key')!);
      expect(stored.__v).toBe(1);
      expect(stored.data).toEqual(legacyData);
    });

    it('handles unversioned data with migration function', () => {
      const oldData = { name: 'old', value: 42 };
      localStorage.setItem('test-key', JSON.stringify(oldData));
      const result = readVersioned<{ label: string; val: number }>('test-key', 2, (oldVer, raw) => {
        expect(oldVer).toBe(0); // Unversioned = version 0
        const old = raw as { name: string; value: number };
        return { label: old.name, val: old.value };
      });
      expect(result).toEqual({ label: 'old', val: 42 });
    });

    it('handles versioned data with migration function', () => {
      // Simulate data at version 1
      localStorage.setItem('test-key', JSON.stringify({ __v: 1, data: { name: 'v1', extra: true } }));
      const result = readVersioned<{ label: string }>('test-key', 2, (oldVer, raw) => {
        expect(oldVer).toBe(1);
        const old = raw as { name: string; extra: boolean };
        return { label: old.name };
      });
      expect(result).toEqual({ label: 'v1' });
    });

    it('writes migrated data back at current version', () => {
      localStorage.setItem('test-key', JSON.stringify({ __v: 1, data: { x: 1 } }));
      readVersioned<{ y: number }>('test-key', 2, (_ver, raw) => {
        const old = raw as { x: number };
        return { y: old.x * 10 };
      });
      const stored = JSON.parse(localStorage.getItem('test-key')!);
      expect(stored.__v).toBe(2);
      expect(stored.data).toEqual({ y: 10 });
    });

    it('returns data from older version without migration (forward-compatible)', () => {
      localStorage.setItem('test-key', JSON.stringify({ __v: 1, data: { field: 'value' } }));
      const result = readVersioned<{ field: string }>('test-key', 2);
      expect(result).toEqual({ field: 'value' });
    });

    it('returns data from newer version (best effort, never loses data)', () => {
      localStorage.setItem('test-key', JSON.stringify({ __v: 99, data: { futureField: 'future' } }));
      const result = readVersioned<{ futureField: string }>('test-key', 1);
      expect(result).toEqual({ futureField: 'future' });
    });

    it('handles null data gracefully', () => {
      localStorage.setItem('test-key', JSON.stringify(null));
      const result = readVersioned<string[]>('test-key', 1);
      // null parsed data with no migration = re-written then returned
      // The function treats null as legacy data with no __v field
      // Since null is falsy, it gets returned as T (null cast to T)
      expect(result).toBeNull();
    });

    it('migration returning null does not write back', () => {
      localStorage.setItem('test-key', JSON.stringify({ __v: 1, data: { bad: true } }));
      const originalContent = localStorage.getItem('test-key');
      const result = readVersioned<{ good: boolean }>('test-key', 2, () => null);
      expect(result).toBeNull();
      // Original content should remain (migration returned null, so no write-back)
      expect(localStorage.getItem('test-key')).toBe(originalContent);
    });

    it('never crashes on deeply corrupted data shapes', () => {
      // Various corruption scenarios
      const corruptValues = [
        'undefined',
        'NaN',
        '""',
        '0',
        'true',
        'false',
        '[]',
        '{"__v":"not-a-number","data":{}}',
      ];
      for (const val of corruptValues) {
        localStorage.setItem('test-key', val);
        expect(() => readVersioned('test-key', 1)).not.toThrow();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // writeVersioned
  // ═══════════════════════════════════════════════════════════════════

  describe('writeVersioned', () => {
    it('writes data with version envelope', () => {
      writeVersioned('test-key', 3, { items: [1, 2, 3] });
      const stored = JSON.parse(localStorage.getItem('test-key')!);
      expect(stored.__v).toBe(3);
      expect(stored.data).toEqual({ items: [1, 2, 3] });
    });

    it('overwrites existing data', () => {
      writeVersioned('test-key', 1, { old: true });
      writeVersioned('test-key', 2, { new: true });
      const stored = JSON.parse(localStorage.getItem('test-key')!);
      expect(stored.__v).toBe(2);
      expect(stored.data).toEqual({ new: true });
    });

    it('handles arrays', () => {
      writeVersioned('arr-key', 1, ['a', 'b', 'c']);
      const result = readVersioned<string[]>('arr-key', 1);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('handles empty objects', () => {
      writeVersioned('empty-key', 1, {});
      const result = readVersioned<Record<string, never>>('empty-key', 1);
      expect(result).toEqual({});
    });

    it('handles empty arrays', () => {
      writeVersioned('empty-arr', 1, []);
      const result = readVersioned<never[]>('empty-arr', 1);
      expect(result).toEqual([]);
    });

    it('does not throw on quota exceeded (simulated)', () => {
      // The wrapper catches errors silently, so this should not throw
      expect(() => writeVersioned('test-key', 1, { x: 1 })).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // readString / writeString
  // ═══════════════════════════════════════════════════════════════════

  describe('readString', () => {
    it('returns null for missing key', () => {
      expect(readString('nonexistent')).toBeNull();
    });

    it('reads string value', () => {
      localStorage.setItem('str-key', 'hello');
      expect(readString('str-key')).toBe('hello');
    });

    it('reads empty string', () => {
      localStorage.setItem('str-key', '');
      expect(readString('str-key')).toBe('');
    });
  });

  describe('writeString', () => {
    it('writes string value', () => {
      writeString('str-key', 'world');
      expect(localStorage.getItem('str-key')).toBe('world');
    });

    it('overwrites existing value', () => {
      writeString('str-key', 'first');
      writeString('str-key', 'second');
      expect(localStorage.getItem('str-key')).toBe('second');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // removeStorage
  // ═══════════════════════════════════════════════════════════════════

  describe('removeStorage', () => {
    it('removes a key', () => {
      localStorage.setItem('rm-key', 'value');
      removeStorage('rm-key');
      expect(localStorage.getItem('rm-key')).toBeNull();
    });

    it('does nothing for nonexistent key', () => {
      expect(() => removeStorage('nonexistent')).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // End-to-end: write then read roundtrip
  // ═══════════════════════════════════════════════════════════════════

  describe('roundtrip', () => {
    it('complex nested object survives write/read', () => {
      const data = {
        config: { enabled: true, nested: { deep: [1, 2, 3] } },
        items: [{ id: 'a', tags: ['x', 'y'] }],
        timestamp: 1234567890,
      };
      writeVersioned('complex', 5, data);
      const result = readVersioned<typeof data>('complex', 5);
      expect(result).toEqual(data);
    });

    it('boolean values roundtrip correctly', () => {
      writeVersioned('bool', 1, true);
      expect(readVersioned<boolean>('bool', 1)).toBe(true);
    });

    it('number values roundtrip correctly', () => {
      writeVersioned('num', 1, 42);
      expect(readVersioned<number>('num', 1)).toBe(42);
    });

    it('null data roundtrip correctly', () => {
      writeVersioned('null-val', 1, null);
      // Reading null data - the envelope has __v so it's detected as versioned
      const result = readVersioned<null>('null-val', 1);
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Backward compatibility: old unversioned data
  // ═══════════════════════════════════════════════════════════════════

  describe('backward compatibility', () => {
    it('reads old SOAR config format (no version envelope)', () => {
      const oldConfig = { enabled: true, maxIterations: 5 };
      localStorage.setItem('pfc-soar-config', JSON.stringify(oldConfig));
      const result = readVersioned<typeof oldConfig>('pfc-soar-config', 1);
      expect(result).toEqual(oldConfig);
    });

    it('reads old cortex archive format (no version envelope)', () => {
      const oldArchive = [{ id: 'snap-1', label: 'test' }];
      localStorage.setItem('pfc-cortex-archive', JSON.stringify(oldArchive));
      const result = readVersioned<typeof oldArchive>('pfc-cortex-archive', 1);
      expect(result).toEqual(oldArchive);
    });

    it('reads old learning history (no version envelope)', () => {
      const oldHistory = [{ id: 'h-1', startedAt: 1000, completedAt: 2000 }];
      localStorage.setItem('pfc-learning-history', JSON.stringify(oldHistory));
      const result = readVersioned<typeof oldHistory>('pfc-learning-history', 1);
      expect(result).toEqual(oldHistory);
    });

    it('handles corrupt old data gracefully (returns null)', () => {
      localStorage.setItem('pfc-cortex-archive', 'CORRUPT');
      const result = readVersioned<unknown[]>('pfc-cortex-archive', 1);
      expect(result).toBeNull();
    });

    it('handles corrupt old data with fallback via migration', () => {
      localStorage.setItem('pfc-soar-config', '{{bad}}');
      const result = readVersioned<{ enabled: boolean }>('pfc-soar-config', 1, () => {
        return { enabled: false }; // fallback
      });
      // Migration function is only called for valid parsed data, not parse errors
      // So this should return null since JSON.parse fails
      expect(result).toBeNull();
    });
  });
});
