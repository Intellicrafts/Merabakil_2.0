"use client";

import { AlertCircle, Check, Loader2, RotateCcw, X } from "lucide-react";

import { ChatFileCard } from "@/components/mera-vakil/chat-file-card";
import type { ComposerAttachment } from "@/lib/composer-attachments";
import { isImageFile } from "@/lib/composer-attachments";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ComposerAttachmentListProps {
  attachments: ComposerAttachment[];
  disabled?: boolean;
  onRemove: (localId: string) => void;
  onRetry: (localId: string) => void;
}

function stageLabel(status: ComposerAttachment["status"], t: (key: string) => string): string {
  if (status === "uploading") return t("chat.uploading");
  if (status === "reading") return t("chat.readingDocument");
  if (status === "ready") return t("chat.fileReady");
  return t("chat.couldNotProcess");
}

function StatusBadge({
  status,
  busy,
}: {
  status: ComposerAttachment["status"];
  busy: boolean;
}) {
  if (status === "ready") {
    return (
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm ring-2 ring-white dark:ring-zinc-900"
        aria-hidden
      >
        <Check className="h-3 w-3" strokeWidth={2.5} />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow-sm ring-2 ring-white dark:ring-zinc-900"
        aria-hidden
      >
        <AlertCircle className="h-3 w-3" strokeWidth={2.25} />
      </span>
    );
  }
  if (busy) {
    return (
      <span
        className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-800/90 text-white shadow-sm ring-2 ring-white dark:bg-amber-600 dark:ring-zinc-900"
        aria-hidden
      >
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    );
  }
  return null;
}

export function ComposerAttachmentList({
  attachments,
  disabled,
  onRemove,
  onRetry,
}: ComposerAttachmentListProps) {
  const { t } = useTranslation();

  if (attachments.length === 0) return null;

  return (
    <ul className="mv-attach-list flex gap-2 overflow-x-auto px-1 pb-0.5 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {attachments.map((item) => {
        const busy = item.status === "uploading" || item.status === "reading";
        const failed = item.status === "failed";
        const ready = item.status === "ready";
        const image = isImageFile(item.fileName, item.contentType);

        return (
          <li
            key={item.localId}
            data-attachment-status={item.status}
            className="mv-attach-chip relative shrink-0"
            aria-label={`${item.fileName} ${stageLabel(item.status, t)}`}
          >
            <div
              className={cn(
                "relative overflow-hidden rounded-xl border shadow-sm transition-colors",
                ready &&
                  "border-emerald-500/35 bg-emerald-50/40 ring-1 ring-emerald-500/20 dark:border-emerald-500/30 dark:bg-emerald-950/20 dark:ring-emerald-500/15",
                failed &&
                  "border-red-400/50 bg-red-50/80 ring-1 ring-red-400/20 dark:border-red-500/35 dark:bg-red-950/25 dark:ring-red-500/15",
                busy &&
                  "border-amber-800/20 bg-white dark:border-amber-500/20 dark:bg-zinc-900",
                !ready && !failed && !busy && "border-black/[0.07] bg-white dark:border-white/10 dark:bg-zinc-900",
              )}
            >
              {image && item.previewUrl ? (
                <div className="relative h-[64px] w-[76px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.previewUrl}
                    alt={item.fileName}
                    className={cn("h-full w-full object-cover", failed && "opacity-80")}
                  />
                  {busy && (
                    <div className="absolute inset-0 bg-black/25" aria-hidden />
                  )}
                </div>
              ) : (
                <div className="w-[min(168px,58vw)] p-1">
                  <ChatFileCard
                    name={item.fileName}
                    size={item.size}
                    contentType={item.contentType}
                  />
                </div>
              )}

              {busy && (
                <div
                  className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-black/5 dark:bg-white/10"
                  aria-hidden
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-800 to-amber-600 transition-[width] duration-200 ease-out dark:from-amber-500 dark:to-amber-400"
                    style={{ width: `${Math.max(4, item.percent)}%` }}
                  />
                </div>
              )}

              {failed && item.error && (
                <p
                  className="max-w-[168px] truncate border-t border-red-200/60 px-2 py-1 text-[10px] leading-tight text-red-700 dark:border-red-500/20 dark:text-red-300"
                  title={item.error}
                >
                  {item.error}
                </p>
              )}
            </div>

            <span className="pointer-events-none absolute -bottom-0.5 -left-0.5">
              <StatusBadge status={item.status} busy={busy} />
            </span>

            {failed && (
              <button
                type="button"
                onClick={() => onRetry(item.localId)}
                disabled={disabled}
                className="absolute -bottom-1 right-7 flex h-6 w-6 items-center justify-center rounded-full border border-red-200/80 bg-white text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-40 dark:border-red-500/30 dark:bg-zinc-800 dark:text-red-300 dark:hover:bg-red-950/40"
                aria-label={`${t("chat.retryUpload")} ${item.fileName}`}
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}

            <button
              type="button"
              onClick={() => onRemove(item.localId)}
              disabled={disabled && busy}
              className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-white text-muted-foreground shadow-md hover:text-foreground disabled:opacity-40 dark:border-white/15 dark:bg-zinc-800"
              aria-label={`${t("chat.removeAttachment")} ${item.fileName}`}
            >
              <X className="h-3 w-3" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
