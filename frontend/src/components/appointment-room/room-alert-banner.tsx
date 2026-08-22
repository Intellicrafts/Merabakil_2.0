"use client";

import { Bell, Siren, Volume2, VolumeX, X } from "lucide-react";

import { setAlertsMuted, isAlertsMuted } from "@/lib/room-alerts";
import { cn } from "@/lib/utils";

export type RoomAlertKind = "summon" | "emergency" | "ops_ack" | "ops_message";

interface RoomAlertBannerProps {
  kind: RoomAlertKind;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

const STYLES: Record<RoomAlertKind, string> = {
  summon: "border-sky-500/35 bg-gradient-to-r from-sky-50 to-slate-50 text-sky-950 dark:from-sky-950/40 dark:to-slate-900/40 dark:text-sky-100",
  emergency: "border-amber-500/40 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-950 dark:from-amber-950/40 dark:to-orange-950/30 dark:text-amber-100",
  ops_ack: "border-emerald-500/35 bg-gradient-to-r from-emerald-50 to-slate-50 text-emerald-950 dark:from-emerald-950/30 dark:to-slate-900/40 dark:text-emerald-100",
  ops_message: "border-slate-400/35 bg-gradient-to-r from-slate-100 to-stone-50 text-slate-900 dark:from-white/10 dark:to-white/5 dark:text-zinc-100",
};

export function RoomAlertBanner({ kind, title, body, actionLabel, onAction, onDismiss }: RoomAlertBannerProps) {
  const Icon = kind === "summon" ? Bell : kind === "emergency" ? Siren : Bell;
  const muted = isAlertsMuted();

  return (
    <div
      className={cn(
        "apt-room-alert flex items-start gap-3 rounded-xl border px-3.5 py-3 shadow-sm backdrop-blur-sm",
        STYLES[kind],
      )}
      role="status"
    >
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.06] dark:bg-white/10">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold tracking-tight">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed opacity-90">{body}</p>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-2 inline-flex h-8 items-center rounded-lg bg-slate-900 px-3 text-[11px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <button
          type="button"
          aria-label={muted ? "Unmute alerts" : "Mute alerts"}
          onClick={() => setAlertsMuted(!muted)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg opacity-70 hover:bg-black/[0.05] hover:opacity-100 dark:hover:bg-white/10"
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
        {onDismiss ? (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg opacity-70 hover:bg-black/[0.05] hover:opacity-100 dark:hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
