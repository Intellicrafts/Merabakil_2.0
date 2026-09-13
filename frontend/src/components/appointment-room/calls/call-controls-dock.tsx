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
        "mx-auto flex w-full max-w-[680px] items-center gap-3 rounded-2xl border border-black/[0.06] bg-white/80 px-4 py-2.5 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-950/80",
        className,
      )}
    >
      {/* Timer */}
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {elapsedLabel}
        </span>
      </div>

      <div className="h-4 w-px shrink-0 bg-black/[0.08] dark:bg-white/[0.08]" />

      {/* Mic + Camera */}
      <div className="flex flex-1 items-center justify-center gap-2">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? "Unmute microphone" : "Mute microphone"}
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
            muted
              ? "bg-red-500/10 text-red-600 ring-1 ring-red-500/25 dark:bg-red-500/15 dark:text-red-400"
              : "bg-black/[0.04] text-slate-600 hover:bg-black/[0.07] dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/10",
          )}
        >
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        {mode === "video" && (
          <button
            type="button"
            onClick={onToggleCamera}
            aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
              cameraOff
                ? "bg-red-500/10 text-red-600 ring-1 ring-red-500/25 dark:bg-red-500/15 dark:text-red-400"
                : "bg-black/[0.04] text-slate-600 hover:bg-black/[0.07] dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/10",
            )}
          >
            {cameraOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* End call */}
      <button
        type="button"
        disabled={ending}
        onClick={onEnd}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-red-500 px-3.5 text-[12px] font-semibold text-white hover:bg-red-600 disabled:opacity-70"
      >
        <PhoneOff className="h-3.5 w-3.5" />
        End call
      </button>
    </div>
  );
}
