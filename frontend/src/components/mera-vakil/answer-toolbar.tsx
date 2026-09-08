"use client";

import { useRef, useState, type ReactNode } from "react";
import { Check, Copy, FileDown, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import { ReadAloudControl } from "@/components/mera-vakil/read-aloud-control";
import { useToast } from "@/components/ui/toast";
import type { ReadAloudStatus } from "@/hooks/use-read-aloud";
import { downloadCounselReportPdf } from "@/lib/counsel-report-pdf";
import type { CounselReportSource } from "@/lib/counsel-report-model";
import { cn } from "@/lib/utils";

interface AnswerToolbarProps {
  content: string;
  title?: string;
  question?: string;
  sources?: CounselReportSource[];
  disclaimer?: string;
  messageId: string;
  onRegenerate?: () => void;
  readAloudStatus?: ReadAloudStatus;
  readAloudActiveId?: string | null;
  onReadAloudToggle?: (messageId: string, content: string) => void;
  onReadAloudStop?: () => void;
  hasGrounding?: boolean;
  groundingOpen?: boolean;
  onGroundingToggle?: () => void;
}

function stripCitationMarkup(text: string): string {
  return text.replace(/\[(?:KB|WEB)-\d+\]/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors",
        "hover:bg-black/[0.05] hover:text-foreground disabled:opacity-40 dark:hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

export function AnswerToolbar({
  content,
  title = "Counsel note",
  question,
  sources = [],
  disclaimer,
  messageId,
  onRegenerate,
  readAloudStatus = "idle",
  readAloudActiveId = null,
  onReadAloudToggle,
  onReadAloudStop,
  hasGrounding = false,
  groundingOpen = false,
  onGroundingToggle,
}: AnswerToolbarProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<"plain" | "md" | null>(null);
  const [exporting, setExporting] = useState(false);
  const copiedTimer = useRef<number | null>(null);

  function flash(kind: "plain" | "md") {
    setCopied(kind);
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(null), 1600);
  }

  return (
    <div className="mv-answer-toolbar flex flex-wrap items-center gap-0.5">
      <ToolButton
        label="Copy answer"
        onClick={async () => {
          const ok = await copyText(stripCitationMarkup(content));
          if (ok) {
            flash("plain");
            toast({ title: "Copied", description: "Answer copied without citation markers." });
          }
        }}
      >
        {copied === "plain" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        Copy
      </ToolButton>
      <ToolButton
        label="Copy as Markdown"
        onClick={async () => {
          const ok = await copyText(content);
          if (ok) {
            flash("md");
            toast({ title: "Copied", description: "Markdown copied to clipboard." });
          }
        }}
      >
        {copied === "md" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        MD
      </ToolButton>
      {hasGrounding && onGroundingToggle && (
        <ToolButton
          label={groundingOpen ? "Hide sources" : "View sources & grounding"}
          onClick={onGroundingToggle}
        >
          <ShieldCheck
            className={cn(
              "h-3.5 w-3.5 transition-colors",
              groundingOpen ? "text-emerald-600 dark:text-emerald-400" : "",
            )}
          />
          <span className={cn(groundingOpen && "text-emerald-600 dark:text-emerald-400")}>
            Sources
          </span>
        </ToolButton>
      )}
      {onRegenerate && (
        <ToolButton label="Regenerate answer" onClick={onRegenerate}>
          <RefreshCw className="h-3.5 w-3.5" />
          Regen
        </ToolButton>
      )}
      <ToolButton
        label="Export PDF"
        disabled={exporting}
        onClick={async () => {
          setExporting(true);
          try {
            await downloadCounselReportPdf({
              question: question || title,
              answer: content,
              sources,
              disclaimer,
            });
            toast({ title: "Exported", description: "Counsel report downloaded." });
          } catch {
            toast({ title: "Export failed", description: "Could not generate PDF.", variant: "destructive" });
          } finally {
            setExporting(false);
          }
        }}
      >
        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
        PDF
      </ToolButton>
      {onReadAloudToggle && onReadAloudStop && (
        <ReadAloudControl
          messageId={messageId}
          content={content}
          status={readAloudStatus}
          activeMessageId={readAloudActiveId}
          onToggle={onReadAloudToggle}
          onStop={onReadAloudStop}
        />
      )}
    </div>
  );
}
