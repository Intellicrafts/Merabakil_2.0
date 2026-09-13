"use client";

import { useEffect, useRef } from "react";
import { MicOff } from "lucide-react";

import { cn } from "@/lib/utils";

interface CallStageProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  visible: boolean;
  counterpartName: string;
  mode?: "audio" | "video";
  elapsedLabel?: string;
  muted?: boolean;
}

export function CallStage({
  localStream,
  remoteStream,
  visible,
  counterpartName,
  mode = "video",
  elapsedLabel,
  muted = false,
}: CallStageProps) {
  const remoteRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = localStream;
  }, [localStream]);

  if (!visible) return null;

  const audioOnly = mode === "audio";
  const initials = counterpartName
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  const isLive = !!remoteStream;

  return (
    <div className="relative h-full min-h-[220px] overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 shadow-xl">
      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.09),transparent_65%)]" />

      {/* Remote video — always mounted so srcObject assignment is never delayed by conditionals */}
      <video
        ref={remoteRef}
        autoPlay
        playsInline
        className={cn(
          "h-full w-full object-cover",
          audioOnly && "invisible absolute inset-0",
        )}
      />

      {audioOnly ? (
        /* ── Audio call ── */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          {/* Avatar with concentric animated rings */}
          <div className="relative">
            <span className="absolute inset-[-14px] animate-ping rounded-full border border-slate-600/30" />
            <span className="absolute inset-[-7px] animate-pulse rounded-full border border-slate-600/50" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-slate-700/80 text-2xl font-semibold text-white ring-2 ring-white/10">
              {initials}
            </div>
            {muted && (
              <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 shadow-md">
                <MicOff className="h-3 w-3 text-white" />
              </span>
            )}
          </div>

          <div className="text-center">
            <p className="text-[15px] font-semibold text-white">{counterpartName}</p>
            <p className="mt-0.5 text-[12px] text-white/50">
              {isLive ? "Audio consultation" : "Connecting…"}
            </p>
          </div>

          {isLive && elapsedLabel && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium tabular-nums text-white/70">
              {elapsedLabel}
            </span>
          )}
        </div>
      ) : (
        /* ── Video call ── */
        <>
          {/* Waiting overlay — shown until remote stream arrives */}
          {!isLive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/60 backdrop-blur-sm">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-2xl font-semibold text-white ring-1 ring-white/15">
                {initials}
              </div>
              <div className="text-center">
                <p className="text-[13px] font-medium text-white">{counterpartName}</p>
                <p className="mt-0.5 text-[11px] text-white/50">Connecting…</p>
              </div>
            </div>
          )}

          {/* Local PiP */}
          <video
            ref={localRef}
            autoPlay
            muted
            playsInline
            className="absolute bottom-3 right-3 h-24 w-32 rounded-2xl border border-white/15 bg-slate-800 object-cover shadow-lg md:h-28 md:w-36"
          />
        </>
      )}

      {/* Live / Connecting badge */}
      <div className="absolute left-3 top-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white/80 backdrop-blur-sm">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              isLive ? "bg-emerald-400" : "animate-pulse bg-amber-400",
            )}
          />
          {isLive ? "Live" : "Connecting"}
        </span>
      </div>
    </div>
  );
}
