// ═══════════════════════════════════════════════════════════════════
// Connection Finder — discovers links between notes
//
// Runs every 4-8h. Reads all pages + blocks, asks LLM to find
// connections, creates page_link rows and optionally a
// "Connections" summary page.
// ═══════════════════════════════════════════════════════════════════

import { generateText } from 'ai';
import { buildCrossReferencePrompt } from '@/lib/notes/learning-prompts';
import { stripHtml } from '@/lib/notes/types';
import type { DaemonTask } from '../scheduler';
import type { DaemonContext } from '../context';

export const connectionFinder: DaemonTask = {
  name: 'connection-finder',
  description: 'Find connections between notes using AI',

  async run(ctx: DaemonContext): Promise<string> {
    const vaultId = ctx.notes.getActiveVaultId();
    if (!vaultId) return 'No active vault';

    const pages = ctx.notes.getPages(vaultId);
    const blocks = ctx.notes.getBlocks(vaultId);

    if (pages.length < 2) return 'Need at least 2 pages to find connections';

    // Build notes content for the prompt
    const notesContent = pages.map(page => {
      const pageBlocks = blocks
        .filter(b => b.pageId === page.id)
        .sort((a, b) => a.order.localeCompare(b.order));
      const content = pageBlocks.map(b => stripHtml(b.content)).filter(Boolean).join('\n');
      return `## ${page.title}\n${content}`;
    }).join('\n\n---\n\n');

    // Truncate if too long (keep under ~8k tokens ≈ 32k chars)
    const truncated = notesContent.slice(0, 32_000);

    const model = ctx.resolveModel();
    const prompt = buildCrossReferencePrompt(truncated);

    ctx.log.task('connection-finder', `Analyzing ${pages.length} pages for connections...`);

    const result = await generateText({
      model,
      system: prompt.system,
      prompt: prompt.user,
      maxOutputTokens: 2048,
      temperature: 0.4,
    });

    // Parse connections from response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return 'LLM response did not contain valid JSON';

    let parsed: { connections?: Array<{
      sourcePageTitle: string;
      targetPageTitle: string;
      relationship: string;
    }> };

    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return 'Failed to parse LLM response as JSON';
    }

    const connections = parsed.connections ?? [];
    if (connections.length === 0) return 'No new connections found';

    // Resolve page titles to IDs and create links
    const pageByName = new Map(pages.map(p => [p.name.toLowerCase(), p.id]));
    const pageByTitle = new Map(pages.map(p => [p.title.toLowerCase(), p.id]));

    const newLinks = connections
      .map(conn => {
        const sourceId = pageByTitle.get(conn.sourcePageTitle.toLowerCase())
          ?? pageByName.get(conn.sourcePageTitle.toLowerCase());
        const targetId = pageByTitle.get(conn.targetPageTitle.toLowerCase())
          ?? pageByName.get(conn.targetPageTitle.toLowerCase());
        if (!sourceId || !targetId || sourceId === targetId) return null;
        return {
          sourcePageId: sourceId,
          targetPageId: targetId,
          sourceBlockId: 'daemon-connection-finder',
          context: conn.relationship.slice(0, 200),
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    if (newLinks.length > 0) {
      // Merge with existing links (don't replace, append unique)
      const existing = ctx.notes.getPageLinks(vaultId);
      const existingSet = new Set(existing.map(l => `${l.sourcePageId}->${l.targetPageId}`));
      const unique = newLinks.filter(l => !existingSet.has(`${l.sourcePageId}->${l.targetPageId}`));

      if (unique.length > 0) {
        ctx.notes.upsertPageLinks(vaultId, [...existing, ...unique]);
      }
    }

    return `Found ${connections.length} connections, ${newLinks.length} new links created`;
  },
};
