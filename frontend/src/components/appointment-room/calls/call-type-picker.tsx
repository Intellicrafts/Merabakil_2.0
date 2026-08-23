"use client";

import { Mic, Video } from "lucide-react";

import { cn } from "@/lib/utils";

interface CallTypePickerProps {
  disabled?: boolean;
  onAudio: () => void;
  onVideo: () => void;
  className?: string;
}

export function CallTypePicker({ disabled, onAudio, onVideo, className }: CallTypePickerProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={onAudio}
        className="inline-flex h-10 items-center gap-2 rounded-2xl border border-black/[0.08] bg-white/80 px-4 text-[12px] font-semibold shadow-sm backdrop-blur-sm hover:bg-white disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.06]"
      >
        <Mic className="h-4 w-4 text-primary" />
        Audio call
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onVideo}
        className="inline-flex h-10 items-center gap-2 rounded-2xl bg-primary px-4 text-[12px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
      >
        <Video className="h-4 w-4" />
        Video call
      </button>
    </div>
  );
}
