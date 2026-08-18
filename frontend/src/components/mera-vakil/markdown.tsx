"use client";

import { ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CodeBlock } from "@/components/mera-vakil/code-block";
import type { WebSearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  content: string;
  className?: string;
  onCitationClick?: (marker: string) => void;
  webSources?: WebSearchResult[];
}

function preprocessCitations(
  content: string,
  webSources: WebSearchResult[],
  hasClickHandler: boolean,
): string {
  // [WEB-N] → real markdown link using the source URL
  let result = content.replace(/\[WEB-(\d+)\]/g, (_, num) => {
    const src = webSources[parseInt(num) - 1];
    return src?.url ? `[WEB-${num}](${src.url})` : `[WEB-${num}]`;
  });
  // [KB-N] → pseudo-link intercepted by the <a> renderer to trigger onCitationClick
  if (hasClickHandler) {
    result = result.replace(/\[KB-(\d+)\]/g, (_, num) => `[KB-${num}](#citation:KB-${num})`);
  }
  return result;
}

export function Markdown({ content, className, onCitationClick, webSources = [] }: MarkdownProps) {
  const processed = preprocessCitations(content, webSources, !!onCitationClick);

  return (
    <div className={cn("prose-mera-vakil text-sm leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1.5 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1.5 pl-5">{children}</ol>,
          li: ({ children }) => <li className="text-foreground/90">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          h1: ({ children }) => (
            <h1 className="mb-3 text-lg font-semibold tracking-tight">{children}</h1>
          ),
          h2: ({ children }) => <h2 className="mv-section-heading">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 text-sm font-semibold">{children}</h3>,
          a: ({ href, children }) => {
            // [KB-N] pseudo-links → scroll to KB source card
            if (href?.startsWith("#citation:")) {
              const marker = `[${href.replace("#citation:", "")}]`;
              return (
                <button
                  type="button"
                  onClick={() => onCitationClick?.(marker)}
                  className="inline-flex cursor-pointer items-center rounded-sm bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {children}
                </button>
              );
            }
            // [WEB-N] links and any other external hrefs
            return (
              <a
                href={href}
                className="inline-flex items-center gap-0.5 font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
                <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
              </a>
            );
          },
          code: ({ className: codeClass, children, ...props }) => {
            const match = /language-(\w+)/.exec(codeClass ?? "");
            const text = String(children).replace(/\n$/, "");
            const isBlock = match || text.includes("\n");
            if (isBlock) {
              return <CodeBlock language={match?.[1]}>{text}</CodeBlock>;
            }
            return (
              <code
                className="rounded-md bg-black/[0.05] px-1.5 py-0.5 font-mono text-xs dark:bg-white/10"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          blockquote: ({ children }) => (
            <blockquote className="mv-blockquote">{children}</blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl glass-inset">
              <table className="w-full text-left text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-white/20 px-3 py-2 font-medium">{children}</th>
          ),
          td: ({ children }) => <td className="border-b border-white/10 px-3 py-2">{children}</td>,
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
