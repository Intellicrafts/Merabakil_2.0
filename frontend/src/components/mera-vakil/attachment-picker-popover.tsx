"use client";

import { Camera, FileUp } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface AttachmentPickerPopoverProps {
  open: boolean;
  onClose: () => void;
  onUploadDocument: () => void;
  onTakePhoto: () => void;
  cameraAvailable?: boolean;
  /** Horizontal center of the attach button, relative to the popover container. */
  caretOffset?: number;
}

function OptionTile({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "mv-attach-option group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-2xl border px-3 py-3 text-center transition-all",
        "border-amber-800/12 bg-gradient-to-b from-amber-50/90 to-white/95",
        "hover:border-amber-800/28 hover:shadow-[0_10px_28px_rgba(120,53,15,0.12)] active:scale-[0.97]",
        "dark:border-amber-500/18 dark:from-amber-950/40 dark:to-zinc-900/90 dark:hover:border-amber-500/32",
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          "bg-gradient-to-b from-amber-800 to-amber-900 text-white",
          "shadow-[0_4px_16px_rgba(120,53,15,0.32)]",
          "transition-transform group-hover:scale-105",
          "dark:from-amber-600 dark:to-amber-700",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold leading-tight tracking-tight text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block text-[10.5px] leading-snug text-muted-foreground line-clamp-2">
          {subtitle}
        </span>
      </span>
    </button>
  );
}

export function AttachmentPickerPopover({
  open,
  onClose,
  onUploadDocument,
  onTakePhoto,
  cameraAvailable = true,
  caretOffset = 22,
}: AttachmentPickerPopoverProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      role="menu"
      aria-label={t("chat.addAttachment")}
      className="mv-attach-popover absolute bottom-[calc(100%+10px)] left-0 z-50 w-full min-w-[280px] max-w-[340px]"
      style={{ "--mv-attach-caret-x": `${caretOffset}px` } as React.CSSProperties}
    >
      <div
        className={cn(
          "overflow-hidden rounded-2xl border p-2",
          "border-black/[0.07] bg-white/95 backdrop-blur-xl",
          "shadow-[0_12px_40px_rgba(15,23,42,0.14),0_0_0_1px_rgba(255,255,255,0.6)_inset,0_0_24px_rgba(120,53,15,0.06)]",
          "dark:border-white/10 dark:bg-zinc-900/95 dark:shadow-[0_16px_48px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.05)_inset]",
        )}
      >
        <div className="flex gap-2 max-[359px]:flex-col">
          <OptionTile
            icon={<FileUp className="h-5 w-5" strokeWidth={1.75} />}
            title={t("chat.uploadDocument")}
            subtitle={t("chat.uploadDocumentHint")}
            onClick={() => {
              onClose();
              onUploadDocument();
            }}
          />
          {cameraAvailable ? (
            <OptionTile
              icon={<Camera className="h-5 w-5" strokeWidth={1.75} />}
              title={t("chat.takePhoto")}
              subtitle={t("chat.takePhotoHint")}
              onClick={() => {
                onClose();
                onTakePhoto();
              }}
            />
          ) : (
            <p className="flex flex-1 items-center rounded-2xl border border-black/[0.06] bg-black/[0.02] px-3 py-2.5 text-center text-[11px] leading-snug text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]">
              {t("chat.cameraUnavailable")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
