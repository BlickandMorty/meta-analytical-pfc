// ═══════════════════════════════════════════════════════════════════
// Filesystem Layer — sandboxed file access for the daemon
//
// Security model:
//   - All paths resolved and checked against configured base directory
//   - Requires permissions.level >= 'file-access'
//   - Path traversal attempts rejected with error log
//   - Base directory must be explicitly configured (empty = disabled)
// ═══════════════════════════════════════════════════════════════════

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import type { DaemonContext } from './context';

// ── Security ──

export class FsAccessDenied extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FsAccessDenied';
  }
}

/**
 * Resolve and validate a path is within the allowed base directory.
 * Throws FsAccessDenied on traversal or misconfiguration.
 */
function safePath(baseDir: string, requestedPath: string): string {
  if (!baseDir) {
    throw new FsAccessDenied('No base directory configured. Set permissions.baseDir in daemon config.');
  }

  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, requestedPath);

  // Prefix check: target must be inside base directory
  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
    throw new FsAccessDenied(`Path traversal blocked: "${requestedPath}" resolves outside base directory`);
  }

  return resolvedTarget;
}

function assertFileAccess(ctx: DaemonContext): void {
  const level = ctx.getPermissionLevel();
  if (level === 'sandboxed') {
    throw new FsAccessDenied('Filesystem access requires "file-access" or "full-access" permission level');
  }
}

// ── Read Operations ──

export async function readFile(ctx: DaemonContext, relativePath: string): Promise<string> {
  assertFileAccess(ctx);
  const target = safePath(ctx.getBaseDir(), relativePath);
  const content = await fsp.readFile(target, 'utf-8');
  ctx.log.info(`fs:read ${relativePath} (${content.length} bytes)`);
  return content;
}

export async function listDirectory(
  ctx: DaemonContext,
  relativePath: string,
): Promise<{ name: string; isDirectory: boolean; size: number; modifiedAt: number }[]> {
  assertFileAccess(ctx);
  const target = safePath(ctx.getBaseDir(), relativePath);
  const entries = await fsp.readdir(target, { withFileTypes: true });

  const results = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(target, entry.name);
      try {
        const stat = await fsp.stat(fullPath);
        return {
          name: entry.name,
          isDirectory: entry.isDirectory(),
          size: stat.size,
          modifiedAt: stat.mtimeMs,
        };
      } catch {
        return {
          name: entry.name,
          isDirectory: entry.isDirectory(),
          size: 0,
          modifiedAt: 0,
        };
      }
    }),
  );

  ctx.log.info(`fs:list ${relativePath} (${results.length} entries)`);
  return results;
}

export async function fileExists(ctx: DaemonContext, relativePath: string): Promise<boolean> {
  assertFileAccess(ctx);
  const target = safePath(ctx.getBaseDir(), relativePath);
  try {
    await fsp.access(target, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// ── Write Operations ──

export async function writeFile(
  ctx: DaemonContext,
  relativePath: string,
  content: string,
): Promise<void> {
  assertFileAccess(ctx);
  const target = safePath(ctx.getBaseDir(), relativePath);

  // Ensure parent directory exists
  const dir = path.dirname(target);
  await fsp.mkdir(dir, { recursive: true });

  await fsp.writeFile(target, content, 'utf-8');
  ctx.log.info(`fs:write ${relativePath} (${content.length} bytes)`);
}

export async function deleteFile(ctx: DaemonContext, relativePath: string): Promise<void> {
  assertFileAccess(ctx);
  const target = safePath(ctx.getBaseDir(), relativePath);
  await fsp.unlink(target);
  ctx.log.info(`fs:delete ${relativePath}`);
}

export async function ensureDir(ctx: DaemonContext, relativePath: string): Promise<void> {
  assertFileAccess(ctx);
  const target = safePath(ctx.getBaseDir(), relativePath);
  await fsp.mkdir(target, { recursive: true });
}

// ── Markdown Sync: Export ──

export async function syncExport(
  ctx: DaemonContext,
  vaultId: string,
  subDir?: string,
): Promise<{ exported: number; dir: string }> {
  assertFileAccess(ctx);

  const pages = ctx.notes.getPages(vaultId);
  const blocks = ctx.notes.getBlocks(vaultId);
  const exportDir = subDir || 'pfc-notes';
  const baseTarget = safePath(ctx.getBaseDir(), exportDir);

  await fsp.mkdir(baseTarget, { recursive: true });

  let exported = 0;

  for (const page of pages) {
    // Build YAML frontmatter
    const frontmatter = [
      '---',
      `id: "${page.id}"`,
      `title: "${page.title.replace(/"/g, '\\"')}"`,
      `created: ${new Date(page.createdAt).toISOString()}`,
      `updated: ${new Date(page.updatedAt).toISOString()}`,
      `journal: ${page.isJournal}`,
    ];
    if (page.tags.length > 0) {
      frontmatter.push(`tags: [${page.tags.map(t => `"${t}"`).join(', ')}]`);
    }
    if (page.favorite) frontmatter.push('favorite: true');
    if (page.pinned) frontmatter.push('pinned: true');
    if (Object.keys(page.properties).length > 0) {
      frontmatter.push(`properties:`);
      for (const [k, v] of Object.entries(page.properties)) {
        frontmatter.push(`  ${k}: "${v}"`);
      }
    }
    frontmatter.push('---', '');

    // Build markdown body from blocks
    const pageBlocks = blocks
      .filter(b => b.pageId === page.id)
      .sort((a, b) => a.order.localeCompare(b.order));

    const body = pageBlocks.map(block => blockToMarkdown(block)).join('\n');
    const content = frontmatter.join('\n') + `# ${page.title}\n\n` + body + '\n';

    // Sanitize filename
    const filename = sanitizeFilename(page.title) + '.md';
    const filePath = path.join(baseTarget, filename);

    await fsp.writeFile(filePath, content, 'utf-8');
    exported++;
  }

  ctx.log.info(`fs:sync-export ${exported} pages to ${exportDir}`);
  return { exported, dir: baseTarget };
}

// ── Markdown Sync: Import ──

export async function syncImport(
  ctx: DaemonContext,
  vaultId: string,
  subDir?: string,
): Promise<{ imported: number; updated: number }> {
  assertFileAccess(ctx);

  const importDir = subDir || 'pfc-notes';
  const baseTarget = safePath(ctx.getBaseDir(), importDir);

  let entries: string[];
  try {
    entries = (await fsp.readdir(baseTarget)).filter(f => f.endsWith('.md'));
  } catch {
    return { imported: 0, updated: 0 };
  }

  const existingPages = ctx.notes.getPages(vaultId);
  const existingById = new Map(existingPages.map(p => [p.id, p]));

  let imported = 0;
  let updated = 0;
  const { generatePageId, generateBlockId } = await import('@/lib/notes/types');

  for (const filename of entries) {
    const filePath = path.join(baseTarget, filename);
    const raw = await fsp.readFile(filePath, 'utf-8');

    const { frontmatter, body } = parseFrontmatter(raw);
    const now = Date.now();

    // Determine if update or new
    const existingId = frontmatter.id as string | undefined;
    const isUpdate = existingId && existingById.has(existingId);
    const pageId: string = isUpdate ? existingId : generatePageId();

    const title: string = (frontmatter.title as string)
      || filename.replace(/\.md$/, '').replace(/-/g, ' ');

    ctx.notes.upsertPage({
      id: pageId,
      title,
      name: title.toLowerCase(),
      isJournal: frontmatter.journal === 'true' || frontmatter.journal === true,
      properties: (frontmatter.properties as Record<string, string>) || {},
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags as string[] : [],
      favorite: frontmatter.favorite === true || frontmatter.favorite === 'true',
      pinned: frontmatter.pinned === true || frontmatter.pinned === 'true',
      createdAt: frontmatter.created ? new Date(frontmatter.created as string).getTime() : now,
      updatedAt: now,
    }, vaultId);

    // Parse markdown body into blocks
    const lines = body.split('\n');
    const blockTexts = mergeIntoBlocks(lines);

    blockTexts.forEach((text, i) => {
      ctx.notes.upsertBlock({
        id: generateBlockId(),
        pageId: pageId,
        type: detectBlockType(text),
        content: text,
        parentId: null,
        order: `a${String(i).padStart(4, '0')}`,
        collapsed: false,
        indent: 0,
        properties: {},
        refs: [],
        createdAt: now,
        updatedAt: now,
      });
    });

    if (isUpdate) updated++;
    else imported++;
  }

  ctx.log.info(`fs:sync-import ${imported} new, ${updated} updated from ${importDir}`);
  return { imported, updated };
}

// ── Helpers ──

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200) || 'untitled';
}

function blockToMarkdown(block: { type: string; content: string; indent: number }): string {
  // Strip HTML tags for markdown output
  const text = block.content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();

  const indent = '  '.repeat(block.indent);

  switch (block.type) {
    case 'heading':
      return `## ${text}\n`;
    case 'code':
      return `\`\`\`\n${text}\n\`\`\`\n`;
    case 'math':
      return `$$\n${text}\n$$\n`;
    case 'quote':
      return `${indent}> ${text}\n`;
    case 'callout':
      return `${indent}> **Note:** ${text}\n`;
    case 'list-item':
      return `${indent}- ${text}`;
    case 'numbered-item':
      return `${indent}1. ${text}`;
    case 'todo':
      return `${indent}- [ ] ${text}`;
    case 'divider':
      return '---\n';
    case 'image':
      return `![](${text})\n`;
    case 'toggle':
      return `<details><summary>${text}</summary></details>\n`;
    default:
      return `${indent}${text}\n`;
  }
}

function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; body: string } {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) return { frontmatter: {}, body: raw };

  const fm: Record<string, unknown> = {};
  const lines = fmMatch[1].split('\n');

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const raw = line.slice(colonIdx + 1).trim();
    let value: unknown = raw;

    // Parse simple values
    // Remove quotes
    if (raw.startsWith('"') && raw.endsWith('"')) {
      value = raw.slice(1, -1);
    }
    // Parse arrays: [a, b, c]
    else if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        value = JSON.parse(raw.replace(/'/g, '"'));
      } catch {
        value = raw.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^["']|["']$/g, ''));
      }
    }
    // Parse booleans
    else if (raw === 'true') value = true;
    else if (raw === 'false') value = false;

    fm[key] = value;
  }

  return { frontmatter: fm, body: fmMatch[2] };
}

function mergeIntoBlocks(lines: string[]): string[] {
  const blocks: string[] = [];
  let current = '';

  for (const line of lines) {
    // Skip the title heading (already captured as page title)
    if (line.startsWith('# ') && blocks.length === 0 && !current) continue;

    if (line.trim() === '') {
      if (current.trim()) blocks.push(current.trim());
      current = '';
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current.trim()) blocks.push(current.trim());

  return blocks;
}

function detectBlockType(text: string): 'paragraph' | 'heading' | 'code' | 'quote' | 'list-item' | 'todo' {
  if (text.startsWith('## ') || text.startsWith('### ')) return 'heading';
  if (text.startsWith('```')) return 'code';
  if (text.startsWith('> ')) return 'quote';
  if (text.startsWith('- [ ] ') || text.startsWith('- [x] ')) return 'todo';
  if (text.startsWith('- ') || text.startsWith('* ')) return 'list-item';
  return 'paragraph';
}
