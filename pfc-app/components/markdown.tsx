import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownProps {
  children: string;
  className?: string;
}

function NonMemoizedMarkdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn('prose-pfc', className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Custom components for better rendering
        h1: ({ children }) => (
          <h1 className="text-xl font-bold mt-6 mb-3 text-foreground">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold mt-5 mb-2 text-foreground">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold mt-4 mb-2 text-foreground">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="mb-3 leading-relaxed text-foreground/90">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-3 ml-4 list-disc space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 ml-4 list-decimal space-y-1">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-foreground/90">{children}</li>
        ),
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-pfc-ember" {...props}>
                {children}
              </code>
            );
          }
          return (
            <code className={cn('block', className)} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-3 overflow-x-auto rounded-lg border bg-muted p-4 text-sm font-mono">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-3 border-l-2 border-pfc-ember pl-4 italic text-muted-foreground">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="mb-3 overflow-x-auto">
            <table className="w-full border-collapse border border-border text-sm">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border px-3 py-2">{children}</td>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pfc-violet hover:underline"
          >
            {children}
          </a>
        ),
        hr: () => <hr className="my-4 border-border" />,
      }}
    >
      {children}
    </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prev, next) => prev.children === next.children
);
