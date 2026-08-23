"use client";

import { memo, useMemo } from "react";
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

function headingText(children: React.ReactNode): string {
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
    <div className={cn("prose-mera-vakil", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          /* ── Paragraphs ── */
          p: ({ children }) => (
            <p className="mb-[0.9em] text-[13.5px] leading-[1.8] text-foreground/85 last:mb-0">
              {children}
            </p>
          ),

          /* ── Headings ── */
          h1: ({ children }) => (
            <h1 className="mb-3 mt-1 border-b border-black/[0.08] pb-2.5 text-[18px] font-bold tracking-tight text-foreground first:mt-0 dark:border-white/[0.09]">
              {children}
            </h1>
          ),

          h2: ({ children }) => {
            const text = headingText(children);
            const irac = IRAC_RE.test(text.trim());
            return (
              <h2 className={cn(
                "mb-2.5 mt-5 flex items-center gap-2.5 text-[15.5px] font-semibold tracking-tight text-foreground first:mt-0",
                irac && "mv-irac-heading",
              )}>
                {irac ? (
                  <span className="mv-irac-chip">{text.trim().split(/\s+/)[0]}</span>
                ) : (
                  <span
                    className="h-[1em] w-[3px] shrink-0 self-center rounded-full bg-slate-400/80 dark:bg-slate-500/80"
                    aria-hidden
                  />
                )}
                <span>{children}</span>
              </h2>
            );
          },

          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-[14px] font-semibold text-foreground/90 first:mt-0">
              {children}
            </h3>
          ),

          h4: ({ children }) => (
            <h4 className="mb-1.5 mt-3.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground first:mt-0">
              {children}
            </h4>
          ),

          /* ── Divider ── */
          hr: () => (
            <hr className="my-4 border-t border-black/[0.06] dark:border-white/[0.07]" />
          ),

          /* ── Lists ── */
          ul: ({ children }) => (
            <ul className="mb-3.5 list-disc space-y-1.5 pl-5 text-[13.5px] text-foreground/85 marker:text-slate-400/80 dark:marker:text-slate-500">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3.5 list-decimal space-y-1.5 pl-5 text-[13.5px] text-foreground/85 marker:font-semibold marker:text-slate-400/80 dark:marker:text-slate-500">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-[1.75]">{children}</li>
          ),

          /* ── Inline ── */
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground/75">{children}</em>
          ),

          /* ── Blockquote ── */
          blockquote: ({ children }) => (
            <blockquote className="mv-blockquote">
              <span className="mv-bench-label">Bench note</span>
              {children}
            </blockquote>
          ),

          /* ── Links & citations ── */
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
                className="inline-flex items-center gap-0.5 font-medium text-slate-700 underline underline-offset-2 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
                <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
              </a>
            );
          },

          /* ── Images ── */
          img: ({ src, alt }) => {
            if (!src || typeof src !== "string") return null;
            return (
              <button
                type="button"
                className="my-3 block w-full overflow-hidden rounded-xl border border-black/[0.06] text-left dark:border-white/10"
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

          /* ── Code ── */
          code: ({ className: codeClass, children, ...props }) => {
            const match = /language-(\w+)/.exec(codeClass ?? "");
            const text = String(children).replace(/\n$/, "");
            const isBlock = match || text.includes("\n");
            if (isBlock) {
              return <CodeBlock language={match?.[1]}>{text}</CodeBlock>;
            }
            return (
              <code
                className="rounded-md bg-black/[0.06] px-1.5 py-0.5 font-mono text-[12px] dark:bg-white/10"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,

          /* ── Tables ── */
          table: ({ children }) => (
            <div className="mv-table-wrap my-4">
              <table className="w-full text-left text-[12.5px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-black/[0.08] bg-slate-50/90 px-3 py-2.5 font-semibold text-foreground/90 dark:border-white/10 dark:bg-zinc-900/80">
              {children}
            </th>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-black/[0.04] last:border-0 even:bg-black/[0.015] dark:border-white/[0.05] dark:even:bg-white/[0.02]">
              {children}
            </tr>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 align-top text-foreground/80">{children}</td>
          ),
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
});
