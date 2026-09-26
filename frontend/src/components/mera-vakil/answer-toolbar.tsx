"use client";

import { useRef, useState, type ReactNode } from "react";
import { Check, Copy, FileDown, Loader2, ShieldCheck } from "lucide-react";

import { ReadAloudControl } from "@/components/mera-vakil/read-aloud-control";
import { useToast } from "@/components/ui/toast";
import type { ReadAloudStatus } from "@/hooks/use-read-aloud";
import { AnalyticsEvents, track } from "@/lib/analytics";
import { downloadCounselReportPdf } from "@/lib/counsel-report-pdf";
import type { CounselReportSource } from "@/lib/counsel-report-model";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface AnswerToolbarProps {
  content: string;
  title?: string;
  question?: string;
  sources?: CounselReportSource[];
  disclaimer?: string;
  messageId: string;
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
  readAloudStatus = "idle",
  readAloudActiveId = null,
  onReadAloudToggle,
  onReadAloudStop,
  hasGrounding = false,
  groundingOpen = false,
  onGroundingToggle,
}: AnswerToolbarProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
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
        label={t("chat.copyAnswer")}
        onClick={async () => {
          const ok = await copyText(stripCitationMarkup(content));
          if (ok) {
            track(AnalyticsEvents.AI_RESPONSE_COPIED, { interaction_type: "plain" });
            flash("plain");
            toast({ title: t("common.copied"), description: t("chat.copiedAnswer") });
          } else {
            toast({ title: t("chat.copyFailed"), variant: "destructive" });
          }
        }}
      >
        {copied === "plain" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {t("chat.copy")}
      </ToolButton>
      <ToolButton
        label={t("chat.copyMarkdown")}
        onClick={async () => {
          const ok = await copyText(content);
          if (ok) {
            track(AnalyticsEvents.AI_RESPONSE_COPIED, { interaction_type: "markdown" });
            flash("md");
            toast({ title: t("common.copied"), description: t("chat.copiedMarkdown") });
          }
        }}
      >
        {copied === "md" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        MD
      </ToolButton>
      {hasGrounding && onGroundingToggle && (
        <ToolButton
          label={groundingOpen ? t("chat.hideSources") : t("chat.viewSources")}
          onClick={onGroundingToggle}
        >
          <ShieldCheck
            className={cn(
              "h-3.5 w-3.5 transition-colors",
              groundingOpen ? "text-emerald-600 dark:text-emerald-400" : "",
            )}
          />
          <span className={cn(groundingOpen && "text-emerald-600 dark:text-emerald-400")}>
            {t("chat.sources")}
          </span>
        </ToolButton>
      )}
      <ToolButton
        label={t("chat.exportPdf")}
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
            toast({ title: t("common.exported"), description: t("chat.pdfDownloaded") });
          } catch {
            toast({ title: t("chat.exportFailed"), description: t("chat.pdfError"), variant: "destructive" });
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
