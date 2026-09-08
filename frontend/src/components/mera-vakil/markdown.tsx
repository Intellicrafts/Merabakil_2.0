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
          p: ({ children }) => <p className="mv-md-p">{children}</p>,

          h1: ({ children }) => <h1 className="mv-md-h1">{children}</h1>,

          h2: ({ children }) => {
            const irac = IRAC_RE.test(headingText(children).trim());
            return (
              <h2 className={cn("mv-md-h2", irac && "mv-md-h2-section")}>
                <span className="mv-md-h2-bar" aria-hidden />
                <span className="mv-md-h2-text">{children}</span>
              </h2>
            );
          },

          h3: ({ children }) => <h3 className="mv-md-h3">{children}</h3>,
          h4: ({ children }) => <h4 className="mv-md-h4">{children}</h4>,
          h5: ({ children }) => <h5 className="mv-md-h5">{children}</h5>,
          h6: ({ children }) => <h6 className="mv-md-h6">{children}</h6>,

          hr: () => <hr className="mv-md-hr" />,

          ul: ({ children, className: listClass }) => (
            <ul className={cn("mv-md-ul", listClass)}>{children}</ul>
          ),
          ol: ({ children, className: listClass, start }) => (
            <ol
              className={cn("mv-md-ol", listClass)}
              start={start}
              style={
                start && start !== 1
                  ? { counterReset: `mv-ol ${start - 1}` }
                  : undefined
              }
            >
              {children}
            </ol>
          ),
          li: ({ children, className: itemClass }) => (
            <li className={cn("mv-md-li", itemClass)}>{children}</li>
          ),

          strong: ({ children }) => <strong className="mv-md-strong">{children}</strong>,
          em: ({ children }) => <em className="mv-md-em">{children}</em>,
          del: ({ children }) => <del className="mv-md-del">{children}</del>,

          blockquote: ({ children }) => (
            <blockquote className="mv-blockquote">
              <span className="mv-bench-label">Bench note</span>
              {children}
            </blockquote>
          ),

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
                className="mv-md-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
                <ExternalLink className="h-3 w-3 shrink-0 opacity-55" />
              </a>
            );
          },

          img: ({ src, alt }) => {
            if (!src || typeof src !== "string") return null;
            return (
              <button
                type="button"
                className="mv-md-figure"
                onClick={() =>
                  openImageLightbox([{ title: alt || "Figure", image_url: src, caption: alt }], 0)
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={alt || ""} loading="lazy" />
                {alt ? <span>{alt}</span> : null}
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
              <code className="mv-md-code" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,

          table: ({ children }) => (
            <div className="mv-table-wrap">
              <table>{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          th: ({ children }) => <th>{children}</th>,
          tr: ({ children }) => <tr>{children}</tr>,
          td: ({ children }) => <td>{children}</td>,

          input: ({ type, checked, disabled, ...props }) => {
            if (type === "checkbox") {
              return (
                <input
                  type="checkbox"
                  checked={Boolean(checked)}
                  disabled
                  readOnly
                  className="mv-md-check"
                  {...props}
                />
              );
            }
            return <input type={type} checked={checked} disabled={disabled} {...props} />;
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
});
