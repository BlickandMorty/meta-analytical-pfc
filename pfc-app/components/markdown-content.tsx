'use client';

import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

/**
 * Generate a stable slug from heading text for TOC anchor linking.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Extract heading entries from markdown text for the TOC sidebar.
 */
export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

export function extractHeadings(text: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const regex = /^(#{1,4})\s+(.+)$/gm;
  let match;
  const seen = new Map<string, number>();

  while ((match = regex.exec(text)) !== null) {
    const rawText = match[2].replace(/\*\*/g, '').replace(/`/g, '').trim();
    const baseSlug = slugify(rawText);
    const count = seen.get(baseSlug) ?? 0;
    seen.set(baseSlug, count + 1);
    const id = count > 0 ? `${baseSlug}-${count}` : baseSlug;

    entries.push({
      id,
      text: rawText,
      level: match[1].length,
    });
  }

  return entries;
}

/**
 * M3-styled markdown renderer with heading IDs for TOC anchor linking.
 */
function MarkdownContentInner({ content, className }: { content: string; className?: string }) {
  const components = useMemo<Components>(() => {
    // Track heading slugs for deduplication within a single render
    const slugCounts = new Map<string, number>();

    function makeHeadingId(text: string): string {
      const base = slugify(text);
      const count = slugCounts.get(base) ?? 0;
      slugCounts.set(base, count + 1);
      return count > 0 ? `${base}-${count}` : base;
    }

    return {
      h1: ({ children }) => {
        const text = String(children);
        return <h1 id={makeHeadingId(text)}>{children}</h1>;
      },
      h2: ({ children }) => {
        const text = String(children);
        return <h2 id={makeHeadingId(text)}>{children}</h2>;
      },
      h3: ({ children }) => {
        const text = String(children);
        return <h3 id={makeHeadingId(text)}>{children}</h3>;
      },
      h4: ({ children }) => {
        const text = String(children);
        return <h4 id={makeHeadingId(text)}>{children}</h4>;
      },
      a: ({ href, children }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--m3-primary)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
        >
          {children}
        </a>
      ),
    };
  }, []);

  return (
    <div className={`prose-pfc ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownContent = memo(MarkdownContentInner);
