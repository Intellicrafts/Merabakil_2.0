"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy, Download, FileText } from "lucide-react";
import jsPDF from "jspdf";

import { Markdown } from "@/components/mera-vakil/markdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DraftPayload } from "@/lib/types";
import { cn } from "@/lib/utils";

const DOC_TYPE_LABELS: Record<string, string> = {
  legal_notice:     "Legal Notice",
  bail_application: "Bail Application",
  complaint:        "Complaint",
  affidavit:        "Affidavit",
  agreement:        "Agreement",
  petition:         "Petition",
  general:          "Legal Document",
};

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*>]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function downloadPdf(title: string, content: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 20;
  const pageH = 297;
  const lineH = 6;
  const maxW = 170;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(title, maxW);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const bodyLines = doc.splitTextToSize(stripMarkdown(content), maxW);
  for (const line of bodyLines) {
    if (y + lineH > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineH;
  }

  doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
}

function downloadTxt(title: string, content: string) {
  const blob = new Blob([`${title}\n${"=".repeat(title.length)}\n\n${stripMarkdown(content)}`], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.toLowerCase().replace(/\s+/g, "-")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

interface DraftDocumentCardProps {
  draft?: DraftPayload;
  loading?: boolean;
}

export function DraftDocumentCard({ draft, loading }: DraftDocumentCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const label = draft ? (DOC_TYPE_LABELS[draft.document_type] ?? "Legal Document") : "Legal Document";

  function handleCopy() {
    if (!draft) return;
    void navigator.clipboard.writeText(draft.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mt-3 overflow-hidden rounded-[1.1rem] border border-black/[0.07] bg-white shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.07]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100/80 dark:bg-amber-500/20">
          <FileText className="h-4 w-4 text-amber-700 dark:text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          {loading && !draft ? (
            <>
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="mt-1.5 h-3 w-40" />
            </>
          ) : (
            <>
              <p className="text-[10.5px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                {label}
              </p>
              <p className="truncate text-[13px] font-semibold leading-snug">
                {draft?.title ?? "Generating…"}
              </p>
            </>
          )}
        </div>
        {draft && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/[0.05] dark:hover:bg-white/10"
            aria-label={expanded ? "Collapse document" : "Expand document"}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Body */}
      {loading && !draft ? (
        <div className="space-y-2 px-4 py-4">
          {[100, 90, 85, 95, 70].map((w, i) => (
            <Skeleton key={i} className="h-3" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : draft && expanded ? (
        <div className="px-4 py-4">
          <div className="prose prose-sm max-w-none text-[13px] leading-relaxed dark:prose-invert">
            <Markdown content={draft.content} />
          </div>
        </div>
      ) : null}

      {/* Action bar */}
      {draft && (
        <div
          className={cn(
            "flex items-center gap-2 border-t border-black/[0.05] px-4 py-2.5 dark:border-white/[0.06]",
            !expanded && "border-t-0",
          )}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 rounded-lg px-2.5 text-[12px] text-muted-foreground hover:text-foreground"
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
            className="h-7 gap-1.5 rounded-lg px-2.5 text-[12px] text-muted-foreground hover:text-foreground"
            onClick={() => downloadPdf(draft.title, draft.content)}
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 rounded-lg px-2.5 text-[12px] text-muted-foreground hover:text-foreground"
            onClick={() => downloadTxt(draft.title, draft.content)}
          >
            <Download className="h-3.5 w-3.5" />
            .txt
          </Button>
        </div>
      )}
    </div>
  );
}
