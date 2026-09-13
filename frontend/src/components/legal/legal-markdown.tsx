"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface LegalMarkdownProps {
  content: string;
}

export function LegalMarkdown({ content }: LegalMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="mb-6 text-3xl font-semibold tracking-tight text-foreground">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-3 mt-10 scroll-mt-24 text-xl font-semibold text-foreground">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-6 text-lg font-medium text-foreground">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="mb-4 text-[15px] leading-relaxed text-muted-foreground">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-4 list-disc space-y-1.5 pl-6 text-[15px] text-muted-foreground">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-4 list-decimal space-y-1.5 pl-6 text-[15px] text-muted-foreground">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            className="font-medium text-primary underline-offset-2 hover:underline"
            {...(href?.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-4 border-l-4 border-primary/30 pl-4 text-[15px] italic text-muted-foreground">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="mb-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-black/[0.08] bg-black/[0.03] px-3 py-2 text-left font-semibold dark:border-white/10 dark:bg-white/[0.04]">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-black/[0.08] px-3 py-2 text-muted-foreground dark:border-white/10">
            {children}
          </td>
        ),
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
