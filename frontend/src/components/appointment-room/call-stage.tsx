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
    <div className="relative h-full min-h-[220px] overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-[#0a0f1e] shadow-2xl">
      {/* Radial indigo glow — creates depth without being flashy */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,rgba(99,102,241,0.12),transparent)]" />

      {/* Remote video — always mounted so srcObject is never delayed by conditionals */}
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
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3.5">
          {/* Avatar with slow concentric rings */}
          <div className="relative">
            <span className="absolute inset-[-20px] animate-ping rounded-full border border-white/[0.07] [animation-duration:2.5s]" />
            <span className="absolute inset-[-10px] animate-pulse rounded-full border border-white/[0.10]" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-b from-slate-700 to-slate-800 text-[26px] font-semibold text-white shadow-xl ring-1 ring-white/15">
              {initials}
            </div>
            {muted && (
              <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 shadow-md ring-2 ring-[#0a0f1e]">
                <MicOff className="h-3.5 w-3.5 text-white" />
              </span>
            )}
          </div>

          <div className="text-center">
            <p className="text-[17px] font-semibold tracking-tight text-white">{counterpartName}</p>
            <p className="mt-0.5 text-[12px] text-white/45">
              {isLive ? "Audio consultation" : "Connecting…"}
            </p>
          </div>

          {isLive && elapsedLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1 text-[11px] font-medium tabular-nums text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {elapsedLabel}
            </span>
          )}
        </div>
      ) : (
        /* ── Video call ── */
        <>
          {/* Waiting overlay */}
          {!isLive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70 backdrop-blur-md">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/[0.08] text-2xl font-semibold text-white ring-1 ring-white/15">
                {initials}
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold text-white">{counterpartName}</p>
                <p className="mt-0.5 text-[11px] text-white/45">Joining…</p>
              </div>
            </div>
          )}

          {/* Local PiP */}
          <video
            ref={localRef}
            autoPlay
            muted
            playsInline
            className="absolute bottom-4 right-4 h-28 w-36 rounded-2xl border border-white/20 bg-slate-900 object-cover shadow-xl md:h-32 md:w-44"
          />
        </>
      )}

      {/* Live / Connecting status badge */}
      <div className="absolute left-3 top-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white/75 backdrop-blur-sm">
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
