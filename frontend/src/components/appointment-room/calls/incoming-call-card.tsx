"use client";

import { Mic, Phone, PhoneOff, Video } from "lucide-react";

import type { CallMode } from "@/lib/appointment-types";
import { cn } from "@/lib/utils";

interface IncomingCallCardProps {
  counterpartName: string;
  mode: CallMode;
  onAccept: () => void;
  onDecline: () => void;
  busy?: boolean;
  className?: string;
}

export function IncomingCallCard({
  counterpartName,
  mode,
  onAccept,
  onDecline,
  busy = false,
  className,
}: IncomingCallCardProps) {
  const isVideo = mode === "video";
  const initials = counterpartName
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 via-slate-950 to-black p-6 text-white shadow-2xl",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_55%)]" />
      <div className="relative flex flex-col items-center text-center">
        <div className="relative mb-5">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/20" />
          <span className="absolute -inset-2 animate-pulse rounded-full border border-white/10" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-2xl font-semibold ring-2 ring-white/20">
            {initials}
          </div>
        </div>
        <p className="text-lg font-semibold tracking-tight">{counterpartName}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-white/70">
          {isVideo ? <Video className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {isVideo ? "Incoming video call" : "Incoming audio call"}
        </p>
        <div className="mt-6 flex w-full gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onDecline}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-500/90 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
          >
            <PhoneOff className="h-4 w-4" />
            Decline
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60"
          >
            <Phone className="h-4 w-4" />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
