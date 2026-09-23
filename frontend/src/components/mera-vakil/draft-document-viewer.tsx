"use client";

import { useState } from "react";
import { Check, Copy, Download, FileText, X } from "lucide-react";

import { Markdown } from "@/components/mera-vakil/markdown";
import { Button } from "@/components/ui/button";
import { CLARITY_MASK } from "@/lib/analytics/clarity-mask";
import { downloadPdf, downloadTxt } from "@/lib/draft-utils";
import type { DraftPayload } from "@/lib/types";

const DOC_TYPE_LABELS: Record<string, string> = {
  legal_notice:     "Legal Notice",
  bail_application: "Bail Application",
  complaint:        "Complaint",
  affidavit:        "Affidavit",
  agreement:        "Agreement",
  petition:         "Petition",
  general:          "Legal Document",
};

interface DraftDocumentViewerProps {
  draft: DraftPayload;
  onClose: () => void;
}

export function DraftDocumentViewer({ draft, onClose }: DraftDocumentViewerProps) {
  const [copied, setCopied] = useState(false);
  const label = DOC_TYPE_LABELS[draft.document_type] ?? "Legal Document";

  function handleCopy() {
    void navigator.clipboard.writeText(draft.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      {...CLARITY_MASK}
      className="fixed inset-0 z-80 flex flex-col bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-black/[0.08] bg-white/95 px-6 py-3.5 backdrop-blur dark:border-white/[0.08] dark:bg-[#111]/95">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100/80 dark:bg-amber-500/20">
          <FileText className="h-4 w-4 text-amber-700 dark:text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
            {label}
          </p>
          <p className="truncate text-[13.5px] font-semibold leading-snug">
            {draft.title}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-lg px-3 text-[12px] text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-lg px-3 text-[12px] text-muted-foreground hover:text-foreground"
            onClick={() => downloadPdf(draft.title, draft.content)}
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 rounded-lg px-3 text-[12px] text-muted-foreground hover:text-foreground"
            onClick={() => downloadTxt(draft.title, draft.content)}
          >
            <Download className="h-3.5 w-3.5" />
            .txt
          </Button>
          <div className="mx-1.5 h-5 w-px bg-black/10 dark:bg-white/10" />
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable document area */}
      <div className="flex-1 overflow-y-auto bg-gray-100 p-6 dark:bg-[#0d0d0d] md:p-10">
        {/* A4 paper */}
        <div className="mx-auto max-w-[760px] rounded-sm bg-white px-10 py-12 shadow-xl dark:bg-[#111] md:px-16 md:py-14">
          <div className="prose prose-base max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-p:leading-relaxed prose-li:leading-relaxed">
            <Markdown content={draft.content} />
          </div>
        </div>
      </div>
    </div>
  );
}
