"use client";

import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";

import type { CallMode } from "@/lib/appointment-types";
import { cn } from "@/lib/utils";

interface CallControlsDockProps {
  mode: CallMode;
  muted: boolean;
  cameraOff: boolean;
  elapsedLabel: string;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEnd: () => void;
  ending?: boolean;
  className?: string;
}

export function CallControlsDock({
  mode,
  muted,
  cameraOff,
  elapsedLabel,
  onToggleMute,
  onToggleCamera,
  onEnd,
  ending = false,
  className,
}: CallControlsDockProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[680px] items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-white/75 px-3 py-2 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-950/70",
        className,
      )}
    >
      <span className="pl-1 text-[11px] font-medium tabular-nums text-muted-foreground">{elapsedLabel}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleMute}
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.06] bg-white dark:border-white/10 dark:bg-white/[0.06]",
            muted && "text-red-500",
          )}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        {mode === "video" ? (
          <button
            type="button"
            onClick={onToggleCamera}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.06] bg-white dark:border-white/10 dark:bg-white/[0.06]",
              cameraOff && "text-red-500",
            )}
            aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
          >
            {cameraOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          </button>
        ) : null}
        <button
          type="button"
          disabled={ending}
          onClick={onEnd}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-500 px-4 text-[12px] font-semibold text-white hover:bg-red-600 disabled:opacity-70"
        >
          <PhoneOff className="h-4 w-4" />
          End
        </button>
      </div>
    </div>
  );
}
