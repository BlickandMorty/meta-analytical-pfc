// ═══════════════════════════════════════════════════════════════════
// Auto-Organizer — suggests tags for untagged pages
//
// Runs weekly. Finds pages with empty tags, asks LLM to suggest
// 3-5 tags based on content. Tags are written directly to SQLite.
// ═══════════════════════════════════════════════════════════════════

import { generateText } from 'ai';
import { stripHtml } from '@/lib/notes/types';
import type { DaemonTask } from '../scheduler';
import type { DaemonContext } from '../context';

export const autoOrganizer: DaemonTask = {
  name: 'auto-organizer',
  description: 'Auto-tag and organize untagged pages',

  async run(ctx: DaemonContext): Promise<string> {
    const vaultId = ctx.notes.getActiveVaultId();
    if (!vaultId) return 'No active vault';

    const pages = ctx.notes.getPages(vaultId);
    const blocks = ctx.notes.getBlocks(vaultId);

    // Find untagged pages with content
    const untaggedPages = pages.filter(p => {
      if (p.tags.length > 0) return false;
      const pageBlocks = blocks.filter(b => b.pageId === p.id);
      const content = pageBlocks.map(b => stripHtml(b.content)).join('').trim();
      return content.length > 50; // Only tag pages with meaningful content
    });

    if (untaggedPages.length === 0) return 'All pages are already tagged';

    // Limit batch size to avoid overwhelming the LLM
    const batch = untaggedPages.slice(0, 10);
    const model = ctx.resolveModel();

    ctx.log.task('auto-organizer', `Tagging ${batch.length} untagged pages (${untaggedPages.length} total)`);

    let tagged = 0;

    for (const page of batch) {
      const pageBlocks = blocks
        .filter(b => b.pageId === page.id)
        .sort((a, b) => a.order.localeCompare(b.order));
      const content = pageBlocks.map(b => stripHtml(b.content)).filter(Boolean).join('\n').slice(0, 2000);

      try {
        const result = await generateText({
          model,
          system: `You are a knowledge organizer. Given a page title and its content, suggest 3-5 concise tags that categorize its topic. Tags should be lowercase, single-word or hyphenated (e.g., "machine-learning", "philosophy", "daily-log").

Respond with ONLY a JSON array of strings. No explanation.
Example: ["machine-learning", "neural-networks", "optimization"]`,
          prompt: `Title: ${page.title}\n\nContent:\n${content}`,
          maxOutputTokens: 128,
          temperature: 0.3,
        });

        // Parse tags
        const match = result.text.match(/\[[\s\S]*?\]/);
        if (match) {
          const tags: string[] = JSON.parse(match[0]);
          if (Array.isArray(tags) && tags.length > 0) {
            const cleanTags = tags
              .map(t => String(t).toLowerCase().trim().replace(/\s+/g, '-'))
              .filter(t => t.length > 0 && t.length < 30)
              .slice(0, 5);

            if (cleanTags.length > 0) {
              ctx.notes.updatePageTags(page.id, cleanTags);
              tagged++;
              ctx.log.task('auto-organizer', `Tagged "${page.title}": ${cleanTags.join(', ')}`);
            }
          }
        }
      } catch (err) {
        ctx.log.error(`Failed to tag page "${page.title}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return `Tagged ${tagged}/${batch.length} pages`;
  },
};
