"use client";

import { memo, useMemo, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CitationPopover } from "@/components/mera-vakil/citation-popover";
import { CodeBlock } from "@/components/mera-vakil/code-block";
import { openImageLightbox } from "@/components/mera-vakil/image-gallery";
import type { Citation, RetrievedSource, WebSearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  content: string;
  className?: string;
  onCitationClick?: (marker: string) => void;
  webSources?: WebSearchResult[];
  sources?: RetrievedSource[];
  citations?: Citation[];
}

const IRAC_RE =
  /^(issue|rule|application|conclusion|next steps|summary|holdings|remedies|key points)\b/i;

function headingText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(headingText).join("");
  return "";
}

function preprocessCitations(
  content: string,
  webSources: WebSearchResult[],
  hasClickHandler: boolean,
): string {
  let result = content.replace(/\[WEB-(\d+)\]/g, (_, num) => {
    const src = webSources[parseInt(num, 10) - 1];
    return src?.url ? `[WEB-${num}](${src.url})` : `[WEB-${num}]`;
  });
  if (hasClickHandler) {
    result = result.replace(/\[KB-(\d+)\]/g, (_, num) => `[KB-${num}](#citation:KB-${num})`);
  }
  return result;
}

function IracHeading({ children }: { children: ReactNode }) {
  const text = headingText(children);
  const irac = IRAC_RE.test(text.trim());
  return (
    <h2 className={cn("mv-section-heading", irac && "mv-irac-heading")}>
      {irac && <span className="mv-irac-chip">{text.trim().split(/\s+/)[0]}</span>}
      <span>{children}</span>
    </h2>
  );
}

export const Markdown = memo(function Markdown({
  content,
  className,
  onCitationClick,
  webSources = [],
  sources = [],
  citations = [],
}: MarkdownProps) {
  const processed = useMemo(
    () => preprocessCitations(content, webSources, !!onCitationClick),
    [content, webSources, onCitationClick],
  );

  return (
    <div className={cn("prose-mera-vakil mv-brief-canvas text-sm leading-relaxed", className)}>
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
          h2: ({ children }) => <IracHeading>{children}</IracHeading>,
          h3: ({ children }) => <h3 className="mb-2 text-sm font-semibold">{children}</h3>,
          a: ({ href, children }) => {
            if (href?.startsWith("#citation:")) {
              const marker = `[${href.replace("#citation:", "")}]`;
              return (
                <CitationPopover
                  marker={marker}
                  onClick={() => onCitationClick?.(marker)}
                  citations={citations}
                  sources={sources}
                  webSources={webSources}
                >
                  {children}
                </CitationPopover>
              );
            }
            const webMatch =
              typeof children === "string"
                ? children.match(/^WEB-(\d+)$/)
                : Array.isArray(children) && typeof children[0] === "string"
                  ? String(children[0]).match(/^WEB-(\d+)$/)
                  : null;
            if (webMatch) {
              const marker = `[WEB-${webMatch[1]}]`;
              return (
                <CitationPopover
                  marker={marker}
                  onClick={() => href && window.open(href, "_blank", "noopener,noreferrer")}
                  citations={citations}
                  sources={sources}
                  webSources={webSources}
                >
                  {children}
                </CitationPopover>
              );
            }
            return (
              <a
                href={href}
                className="inline-flex items-center gap-0.5 font-medium text-slate-800 underline underline-offset-2 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
                <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
              </a>
            );
          },
          img: ({ src, alt }) => {
            if (!src) return null;
            return (
              <button
                type="button"
                className="mv-md-figure my-3 block w-full overflow-hidden rounded-xl border border-black/[0.06] text-left dark:border-white/10"
                onClick={() =>
                  openImageLightbox([{ title: alt || "Figure", image_url: src, caption: alt }], 0)
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={alt || ""} loading="lazy" className="max-h-72 w-full object-cover" />
                {alt && (
                  <span className="block px-3 py-2 text-[11px] text-muted-foreground">{alt}</span>
                )}
              </button>
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
            <blockquote className="mv-blockquote">
              <span className="mv-bench-label">Bench note</span>
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="mv-table-wrap my-3">
              <table className="w-full text-left text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="mv-table-head">{children}</thead>,
          th: ({ children }) => (
            <th className="sticky top-0 border-b border-black/[0.08] bg-slate-50/95 px-3 py-2 font-semibold dark:border-white/10 dark:bg-zinc-900/90">
              {children}
            </th>
          ),
          tr: ({ children }) => <tr className="mv-table-row even:bg-black/[0.02] dark:even:bg-white/[0.03]">{children}</tr>,
          td: ({ children }) => (
            <td className="border-b border-black/[0.05] px-3 py-2 dark:border-white/10">{children}</td>
          ),
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
});
