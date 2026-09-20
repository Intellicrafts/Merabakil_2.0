"use client";

import { useState } from "react";
import { Check, Copy, Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

interface DraftDocumentCardProps {
  draft?: DraftPayload;
  loading?: boolean;
}

export function DraftDocumentCard({ draft, loading }: DraftDocumentCardProps) {
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
    <div className="mt-3 flex items-center gap-3 rounded-[1rem] border border-black/[0.07] bg-white px-4 py-3 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04]">
      {/* Icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100/80 dark:bg-amber-500/20">
        <FileText className="h-4.5 w-4.5 text-amber-700 dark:text-amber-400" />
      </div>

      {/* Label + title */}
      <div className="min-w-0 flex-1">
        {loading && !draft ? (
          <>
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="mt-1.5 h-3.5 w-44" />
          </>
        ) : (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
              {label}
            </p>
            <p className="truncate text-[13px] font-semibold leading-snug">
              {draft?.title ?? "Generating…"}
            </p>
          </>
        )}
      </div>

      {/* Actions */}
      {draft && (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 rounded-lg p-0 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
            title="Copy"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 rounded-lg p-0 text-muted-foreground hover:text-foreground"
            onClick={() => downloadPdf(draft.title, draft.content)}
            title="Download PDF"
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
