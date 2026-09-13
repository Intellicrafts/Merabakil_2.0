"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";

import { cn } from "@/lib/utils";

interface CallModalProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  counterpartName: string;
  mode: "audio" | "video";
  muted: boolean;
  cameraOff: boolean;
  elapsedLabel: string;
  isRemoteConnected: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onEnd: () => void;
  ending?: boolean;
}

export function CallModal({
  localStream,
  remoteStream,
  counterpartName,
  mode,
  muted,
  cameraOff,
  elapsedLabel,
  isRemoteConnected,
  onToggleMute,
  onToggleCamera,
  onEnd,
  ending = false,
}: CallModalProps) {
  const remoteRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = localStream;
  }, [localStream]);

  const audioOnly = mode === "audio";
  const hasRemoteVideo = (remoteStream?.getVideoTracks().length ?? 0) > 0;

  const initials = counterpartName
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-[90] overflow-hidden bg-black">
      {/* Remote video — always mounted so srcObject is never delayed by conditionals */}
      <video
        ref={remoteRef}
        autoPlay
        playsInline
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          audioOnly && "invisible",
        )}
      />

      {/* Audio mode: gradient background */}
      {audioOnly && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-[#0a0f1e]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(99,102,241,0.20),transparent)]" />
        </>
      )}

      {/* Audio mode: avatar + name + elapsed */}
      {audioOnly && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <span className="absolute inset-[-32px] animate-ping rounded-full border border-white/[0.06] [animation-duration:3s]" />
            <span className="absolute inset-[-18px] animate-pulse rounded-full border border-white/[0.09]" />
            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-b from-slate-700 to-slate-800 text-[30px] font-bold text-white shadow-2xl ring-1 ring-white/15">
              {initials}
            </div>
            {muted && (
              <span className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 shadow-lg ring-2 ring-black">
                <MicOff className="h-4 w-4 text-white" />
              </span>
            )}
          </div>

          <div className="text-center">
            <p className="text-[20px] font-semibold tracking-tight text-white">{counterpartName}</p>
            <p className="mt-1 text-[13px] text-white/50">
              {isRemoteConnected ? "Audio consultation" : "Connecting…"}
            </p>
          </div>

          {isRemoteConnected && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1 text-[12px] tabular-nums text-white/65">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {elapsedLabel}
            </span>
          )}
        </div>
      )}

      {/* Video mode: "Joining…" overlay while remote video not yet flowing */}
      {!audioOnly && !hasRemoteVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80 backdrop-blur-md">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/[0.08] text-[26px] font-semibold text-white ring-1 ring-white/15">
            {initials}
          </div>
          <div className="text-center">
            <p className="text-[15px] font-semibold text-white">{counterpartName}</p>
            <p className="mt-0.5 text-[12px] text-white/45">
              {isRemoteConnected ? "Starting video…" : "Joining…"}
            </p>
          </div>
        </div>
      )}

      {/* Local PiP — always mounted so srcObject binds correctly on mode switch */}
      <video
        ref={localRef}
        autoPlay
        muted
        playsInline
        className={cn(
          "absolute bottom-[5.5rem] right-4 rounded-2xl border border-white/25 bg-slate-900 object-cover shadow-xl transition-all",
          !audioOnly && !cameraOff
            ? "h-28 w-20 opacity-100 md:h-36 md:w-28"
            : "h-0 w-0 opacity-0",
        )}
      />

      {/* Header bar — overlaid on video/audio */}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/75 to-transparent pb-10 pl-5 pr-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[15px] font-semibold leading-tight text-white">{counterpartName}</p>
            <p className="mt-0.5 text-[11px] text-white/55">
              {mode === "video" ? "Video consultation" : "Audio consultation"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white/75 backdrop-blur-sm",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isRemoteConnected ? "bg-emerald-400" : "animate-pulse bg-amber-400",
                )}
              />
              {isRemoteConnected ? "Live" : "Connecting"}
            </span>
            {!audioOnly && isRemoteConnected && (
              <span className="rounded-full bg-black/50 px-2.5 py-1 text-[11px] tabular-nums text-white/70 backdrop-blur-sm">
                {elapsedLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Controls bar — overlaid at bottom */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 bg-gradient-to-t from-black/90 via-black/55 to-transparent pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-6 pr-6 pt-12">
        {/* Microphone */}
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? "Unmute microphone" : "Mute microphone"}
          className={cn(
            "flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full transition-colors",
            muted
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-white/[0.15] text-white hover:bg-white/[0.22]",
          )}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* Camera */}
        <button
          type="button"
          onClick={onToggleCamera}
          aria-label={cameraOff ? "Enable camera" : "Turn camera off"}
          className={cn(
            "flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full transition-colors",
            cameraOff
              ? "bg-white/[0.08] text-white/50 hover:bg-white/[0.13]"
              : "bg-white/[0.15] text-white hover:bg-white/[0.22]",
          )}
        >
          {cameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </button>

        <div className="flex-1" />

        {/* End call */}
        <button
          type="button"
          disabled={ending}
          onClick={onEnd}
          className="flex h-14 flex-shrink-0 items-center gap-2 rounded-full bg-red-500 px-7 text-[13px] font-semibold text-white shadow-lg hover:bg-red-600 disabled:opacity-70"
        >
          <PhoneOff className="h-5 w-5" />
          End call
        </button>
      </div>
    </div>
  );
}
