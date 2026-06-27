'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

/**
 * Renders an assistant/AI message as Markdown — headings, bold, italics,
 * ordered/unordered lists, tables, code, blockquotes and links — styled to
 * match the design system. Used inside chat bubbles, so spacing is compact and
 * the first/last block margins are collapsed to keep the bubble tight. No
 * `prose` plugin dependency; every element is styled explicitly.
 */
export function MarkdownMessage({ content, className }: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        'text-sm leading-relaxed break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h3 className="mt-3 mb-1.5 text-[15px] font-semibold text-foreground">{children}</h3>,
          h2: ({ children }) => <h4 className="mt-3 mb-1.5 text-sm font-semibold text-foreground">{children}</h4>,
          h3: ({ children }) => (
            <h5 className="mt-3 mb-1 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</h5>
          ),
          h4: ({ children }) => <h6 className="mt-2 mb-1 text-[13px] font-semibold text-foreground">{children}</h6>,
          p: ({ children }) => <p className="my-1.5">{children}</p>,
          ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5 marker:text-muted-foreground">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5 marker:text-muted-foreground">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5 [&>ul]:mt-1 [&>ol]:mt-1">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2 hover:opacity-80">
              {children}
            </a>
          ),
          hr: () => <hr className="my-3 border-foreground/10" />,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-primary/40 pl-3 italic text-muted-foreground">{children}</blockquote>
          ),
          code: ({ className: codeClass, children }) => {
            const isBlock = /language-/.test(codeClass ?? '');
            if (isBlock) {
              return <code className="block font-mono text-[12px] leading-relaxed">{children}</code>;
            }
            return <code className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[12px]">{children}</code>;
          },
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg bg-foreground/5 p-3 sanctuary-scrollbar">{children}</pre>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto sanctuary-scrollbar">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-foreground/15 text-left">{children}</thead>,
          th: ({ children }) => <th className="px-2 py-1 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-t border-foreground/10 px-2 py-1 align-top">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
