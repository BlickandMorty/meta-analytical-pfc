import { describe, it, expect } from 'vitest';
import {
  classifyFile,
  validateFile,
  extractTextContent,
  detectFilePaths,
  type FileCategory,
} from '@/lib/engine/file-processor';

// ---------------------------------------------------------------------------
// classifyFile
// ---------------------------------------------------------------------------
describe('classifyFile', () => {
  it.each<[string, string, FileCategory]>([
    ['image/png', '.png', 'image'],
    ['image/jpeg', '.jpg', 'image'],
    ['image/jpeg', '.jpeg', 'image'],
    ['image/webp', '.webp', 'image'],
    ['image/svg+xml', '.svg', 'image'],   // generic image/* fallback
  ])('classifies %s / %s as image', (mime, ext, expected) => {
    expect(classifyFile(mime, ext)).toBe(expected);
  });

  it.each<[string, string, FileCategory]>([
    ['text/plain', '.txt', 'text'],
    ['text/markdown', '.md', 'text'],
  ])('classifies %s / %s as text', (mime, ext, expected) => {
    expect(classifyFile(mime, ext)).toBe(expected);
  });

  it.each<[string, string, FileCategory]>([
    ['text/csv', '.csv', 'data'],
    ['application/json', '.json', 'data'],
  ])('classifies %s / %s as data', (mime, ext, expected) => {
    expect(classifyFile(mime, ext)).toBe(expected);
  });

  it.each<[string, string, FileCategory]>([
    ['application/pdf', '.pdf', 'document'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx', 'document'],
    ['application/msword', '.doc', 'document'],
  ])('classifies %s / %s as document', (mime, ext, expected) => {
    expect(classifyFile(mime, ext)).toBe(expected);
  });

  it('falls back to other for unknown types', () => {
    expect(classifyFile('application/octet-stream', '.bin')).toBe('other');
    expect(classifyFile('video/mp4', '.mp4')).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// validateFile
// ---------------------------------------------------------------------------
describe('validateFile', () => {
  it('accepts a valid file under the size limit', () => {
    const result = validateFile({ size: 1024, name: 'data.csv', mimeType: 'text/csv' });
    expect(result).toEqual({ valid: true });
  });

  it('rejects a file exceeding 100 MB', () => {
    const result = validateFile({
      size: 100 * 1024 * 1024 + 1,
      name: 'huge.pdf',
      mimeType: 'application/pdf',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.toLowerCase()).toContain('size');
  });

  it('accepts a file exactly at 100 MB', () => {
    const result = validateFile({
      size: 100 * 1024 * 1024,
      name: 'exact.pdf',
      mimeType: 'application/pdf',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects a file with unsupported extension', () => {
    const result = validateFile({ size: 512, name: 'song.mp3', mimeType: 'audio/mpeg' });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.toLowerCase()).toContain('support');
  });

  it.each(['.png', '.jpg', '.jpeg', '.webp', '.txt', '.md', '.csv', '.json', '.pdf', '.docx', '.doc'])(
    'accepts files with %s extension',
    (ext) => {
      const result = validateFile({ size: 1024, name: `test${ext}`, mimeType: 'application/octet-stream' });
      expect(result.valid).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------
// extractTextContent
// ---------------------------------------------------------------------------
describe('extractTextContent', () => {
  it('returns null for image files', async () => {
    const buf = Buffer.from('fake image data');
    const result = await extractTextContent(buf, 'image/png', '.png');
    expect(result).toBeNull();
  });

  it('returns UTF-8 string for plain text files', async () => {
    const text = 'Hello, world!';
    const buf = Buffer.from(text, 'utf-8');
    const result = await extractTextContent(buf, 'text/plain', '.txt');
    expect(result).toBe(text);
  });

  it('returns UTF-8 string for markdown files', async () => {
    const md = '# Heading\n\nSome paragraph.';
    const buf = Buffer.from(md, 'utf-8');
    const result = await extractTextContent(buf, 'text/markdown', '.md');
    expect(result).toBe(md);
  });

  it('pretty-prints JSON content', async () => {
    const obj = { key: 'value', nested: { a: 1 } };
    const buf = Buffer.from(JSON.stringify(obj), 'utf-8');
    const result = await extractTextContent(buf, 'application/json', '.json');
    expect(result).toBe(JSON.stringify(obj, null, 2));
  });

  it('returns raw CSV content', async () => {
    const csv = 'a,b,c\n1,2,3\n4,5,6';
    const buf = Buffer.from(csv, 'utf-8');
    const result = await extractTextContent(buf, 'text/csv', '.csv');
    expect(result).toBe(csv);
  });

  it('truncates text exceeding 30,000 characters', async () => {
    const longText = 'x'.repeat(35_000);
    const buf = Buffer.from(longText, 'utf-8');
    const result = await extractTextContent(buf, 'text/plain', '.txt');
    expect(result).not.toBeNull();
    expect(result!.length).toBeLessThanOrEqual(30_000 + 200); // allow room for notice
    expect(result).toContain('[truncated');
  });

  it('does not truncate text at exactly 30,000 characters', async () => {
    const exactText = 'y'.repeat(30_000);
    const buf = Buffer.from(exactText, 'utf-8');
    const result = await extractTextContent(buf, 'text/plain', '.txt');
    expect(result).toBe(exactText);
  });
});

// ---------------------------------------------------------------------------
// detectFilePaths
// ---------------------------------------------------------------------------
describe('detectFilePaths', () => {
  it('detects absolute file paths with supported extensions', () => {
    const query = 'Please analyze /Users/me/data/results.csv and /tmp/notes.txt';
    const paths = detectFilePaths(query);
    expect(paths).toContain('/Users/me/data/results.csv');
    expect(paths).toContain('/tmp/notes.txt');
  });

  it('detects home-relative paths', () => {
    const query = 'Check ~/Documents/report.pdf for issues';
    const paths = detectFilePaths(query);
    expect(paths).toContain('~/Documents/report.pdf');
  });

  it('filters out unsupported extensions', () => {
    const query = 'Look at /data/file.mp3 and /data/file.csv';
    const paths = detectFilePaths(query);
    expect(paths).not.toContain('/data/file.mp3');
    expect(paths).toContain('/data/file.csv');
  });

  it('returns empty array when no paths found', () => {
    const query = 'What is the meaning of life?';
    const paths = detectFilePaths(query);
    expect(paths).toEqual([]);
  });

  it('handles multiple paths in one query', () => {
    const query = 'Compare /a/b.json with ~/c/d.png and /e/f.docx';
    const paths = detectFilePaths(query);
    expect(paths).toHaveLength(3);
    expect(paths).toContain('/a/b.json');
    expect(paths).toContain('~/c/d.png');
    expect(paths).toContain('/e/f.docx');
  });
});
