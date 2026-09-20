"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Sparkles, X } from "lucide-react";

import { ChatFileCard, fileKind, formatFileSize } from "@/components/mera-vakil/chat-file-card";
import { fetchDocumentFile, getDocumentText } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface PreviewTarget {
  id: string;
  name: string;
  size?: number;
  contentType?: string;
}

function InsightPanel({
  title,
  text,
  subtitle,
  expanded = false,
}: {
  title: string;
  text: string;
  subtitle: string;
  expanded?: boolean;
}) {
  return (
    <div className={cn("mv-doc-preview-insight", expanded ? "flex min-h-0 flex-1 flex-col" : "shrink-0 sm:shrink")}>
      <div
        className={cn(
          "mx-auto flex w-full max-w-3xl flex-col px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-1 sm:px-4 sm:pb-4 sm:pt-3",
          expanded && "min-h-0 flex-1",
        )}
      >
        <div
          className={cn(
            "flex flex-col overflow-hidden rounded-2xl border",
            "border-amber-900/10 bg-gradient-to-b from-white via-white to-amber-50/40",
            "shadow-[0_8px_32px_rgba(120,53,15,0.08),inset_0_1px_0_rgba(255,255,255,0.8)]",
            "dark:border-amber-500/15 dark:from-zinc-900 dark:via-zinc-900 dark:to-amber-950/20",
            "dark:shadow-[0_12px_40px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)]",
            expanded && "min-h-0 flex-1",
          )}
        >
          <div className="flex items-start gap-3 border-b border-amber-900/[0.07] px-4 py-3 dark:border-amber-500/10">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-amber-800 to-amber-900 text-white shadow-[0_4px_12px_rgba(120,53,15,0.28)] dark:from-amber-600 dark:to-amber-700">
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[13px] font-semibold tracking-tight text-foreground">{title}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div
            className={cn(
              "overflow-y-auto overscroll-contain px-4 py-3.5",
              expanded ? "min-h-0 flex-1" : "max-h-[min(38vh,320px)] sm:max-h-[280px]",
            )}
          >
            <p className="whitespace-pre-wrap text-[14px] leading-[1.68] tracking-[0.01em] text-foreground/90 dark:text-foreground/85">
              {text}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DocumentPreviewDialog({
  target,
  onClose,
}: {
  target: PreviewTarget | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!target) return undefined;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [target]);

  useEffect(() => {
    if (!target) return;
    let revoked: string | null = null;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setText(null);
    setFileUrl(null);

    const kind = fileKind(target.name, target.contentType);
    void (async () => {
      try {
        if (kind === "pdf" || kind === "image") {
          const blob = await fetchDocumentFile(target.id);
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          revoked = url;
          setFileUrl(url);
          if (kind === "image") {
            const body = await getDocumentText(target.id);
            if (!cancelled && body.text?.trim()) setText(body.text);
          }
        } else {
          const body = await getDocumentText(target.id);
          if (cancelled) return;
          setText(body.text || "No extracted text is available yet.");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not open this file.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [target]);

  useEffect(() => {
    if (!target) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  if (!target) return null;

  const kind = fileKind(target.name, target.contentType);
  const isImage = kind === "image";
  const isPdf = kind === "pdf";
  const hasMedia = Boolean(fileUrl && (isImage || isPdf));
  const insightSubtitle = isImage
    ? t("chat.previewInsightImage")
    : kind === "word"
      ? t("chat.previewFromExtract")
      : t("chat.previewInsightDoc");

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="mp-modal-veil absolute inset-0"
        aria-label="Close preview"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${target.name}`}
        className={cn(
          "mv-doc-preview relative z-[81] flex w-full flex-col overflow-hidden",
          "h-[min(94dvh,100%)] max-h-[94dvh] sm:h-auto sm:max-h-[88vh] sm:max-w-3xl",
          "rounded-t-[1.35rem] border border-black/[0.08] bg-white sm:rounded-2xl",
          "shadow-[0_-12px_48px_rgba(15,23,42,0.18)] sm:shadow-2xl",
          "dark:border-white/10 dark:bg-zinc-950",
        )}
      >
        <div className="flex shrink-0 justify-center pt-2 sm:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-black/10 dark:bg-white/15" />
        </div>

        <header
          className={cn(
            "sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5 backdrop-blur-xl sm:gap-3 sm:px-4 sm:py-3",
            "border-black/[0.06] bg-white/90 dark:border-white/10 dark:bg-zinc-950/90",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold tracking-tight text-foreground">{target.name}</p>
            {target.size != null && (
              <p className="text-[11px] text-muted-foreground">{formatFileSize(target.size)}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  const blob = await fetchDocumentFile(target.id);
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = target.name;
                  link.click();
                  URL.revokeObjectURL(url);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not download this file.");
                } finally {
                  setDownloading(false);
                }
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground disabled:opacity-40 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3 sm:text-[12px] dark:hover:bg-white/10"
              aria-label={`Download ${target.name}`}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {loading && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-amber-800 dark:text-amber-400" />
              <p className="text-[13px]">{t("chat.previewOpening")}</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-1 items-center justify-center px-6">
              <p className="rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-center text-[13px] text-red-700 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            </div>
          )}

          {!loading && !error && hasMedia && (
            <div
              className={cn(
                "mv-doc-preview-media relative flex min-h-0 flex-1 items-center justify-center overflow-hidden",
                isImage && "bg-[#0a0a0b] sm:max-h-[min(52vh,480px)]",
                isPdf && "bg-slate-100 dark:bg-black/40",
              )}
            >
              {isImage && fileUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={fileUrl}
                  alt={target.name}
                  className="max-h-full max-w-full object-contain"
                />
              )}
              {isPdf && fileUrl && (
                <iframe
                  title={target.name}
                  src={fileUrl}
                  className="h-full min-h-[50vh] w-full bg-white sm:min-h-[60vh]"
                />
              )}
            </div>
          )}

          {!loading && !error && text && (
            <InsightPanel
              title={t("chat.previewInsightTitle")}
              text={text}
              subtitle={insightSubtitle}
              expanded={!hasMedia}
            />
          )}

          {!loading && !error && !text && !hasMedia && kind !== "pdf" && (
            <div className="flex flex-1 items-center justify-center px-6">
              <div className="hidden sm:block">
                <ChatFileCard name={target.name} size={target.size} contentType={target.contentType} />
              </div>
              <p className="text-center text-[13px] text-muted-foreground sm:mt-4">
                {t("chat.previewNoText")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
