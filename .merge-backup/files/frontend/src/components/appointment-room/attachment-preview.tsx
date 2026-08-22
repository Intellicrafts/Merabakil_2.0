"use client";

import { useEffect, useState } from "react";
import { FileText, ImageIcon } from "lucide-react";

import { VoiceNotePlayer } from "@/components/appointment-room/voice-note-player";
import { fetchAppointmentAttachmentBlob } from "@/lib/api";
import type { AppointmentAttachment } from "@/lib/appointment-types";
import { cn } from "@/lib/utils";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface AttachmentPreviewProps {
  appointmentId: string;
  attachment: AppointmentAttachment;
  mine: boolean;
  onOpenImage?: (url: string, name: string) => void;
}

export function AttachmentPreview({
  appointmentId,
  attachment,
  mine,
  onOpenImage,
}: AttachmentPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = attachment.kind === "image" || attachment.kind === "screenshot" || attachment.content_type.startsWith("image/");
  const isVoice = attachment.kind === "voice" || attachment.content_type.startsWith("audio/");

  useEffect(() => {
    if (isVoice) return;
    let revoke: string | null = null;
    let cancelled = false;
    void fetchAppointmentAttachmentBlob(appointmentId, attachment.id)
      .then((blob) => {
        if (cancelled) return;
        const next = URL.createObjectURL(blob);
        revoke = next;
        setUrl(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [appointmentId, attachment.id, isVoice]);

  if (isVoice) {
    return <VoiceNotePlayer appointmentId={appointmentId} attachment={attachment} mine={mine} />;
  }

  if (isImage) {
    return (
      <button
        type="button"
        onClick={() => url && onOpenImage?.(url, attachment.filename)}
        className="mt-1 block overflow-hidden rounded-xl"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={attachment.filename} className="max-h-52 max-w-full object-cover" />
        ) : (
          <span className="flex h-28 w-40 items-center justify-center bg-black/10 text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </span>
        )}
      </button>
    );
  }

  return (
    <a
      href={url ?? "#"}
      download={attachment.filename}
      onClick={(e) => {
        if (!url) e.preventDefault();
      }}
      className={cn(
        "mt-1 inline-flex max-w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left",
        mine ? "bg-white/10" : "bg-black/[0.04] dark:bg-white/[0.06]",
      )}
    >
      <FileText className="h-4 w-4 shrink-0 opacity-80" />
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-medium">{attachment.filename}</span>
        <span className={cn("block text-[10px]", mine ? "opacity-70" : "text-muted-foreground")}>
          {formatSize(attachment.size_bytes)}
        </span>
      </span>
    </a>
  );
}
