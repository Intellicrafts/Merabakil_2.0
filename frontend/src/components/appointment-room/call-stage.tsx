"use client";

import { useEffect, useRef } from "react";

interface CallStageProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  visible: boolean;
  counterpartName: string;
  mode?: "audio" | "video";
}

export function CallStage({ localStream, remoteStream, visible, counterpartName, mode = "video" }: CallStageProps) {
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

  return (
    <div className="relative h-full min-h-[220px] overflow-hidden rounded-3xl border border-black/[0.08] bg-gradient-to-b from-slate-900 to-black shadow-xl dark:border-white/10">
      {audioOnly && !remoteStream ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-200">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-2xl font-semibold ring-2 ring-white/15">
            {counterpartName.slice(0, 1).toUpperCase()}
          </div>
          <p className="text-sm text-slate-300">Audio call with {counterpartName}</p>
        </div>
      ) : (
        <>
          <video ref={remoteRef} autoPlay playsInline className="h-full w-full object-cover" />
          {!remoteStream && (
            <div className="absolute inset-0 flex items-center justify-center text-[13px] text-slate-300">
              Waiting for {counterpartName}…
            </div>
          )}
        </>
      )}
      {!audioOnly ? (
        <video
          ref={localRef}
          autoPlay
          muted
          playsInline
          className="absolute bottom-3 right-3 h-24 w-32 rounded-2xl border border-white/20 object-cover shadow-lg"
        />
      ) : null}
      <div className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white/90 backdrop-blur-sm">
        {audioOnly ? "Audio" : "Video"} · Live
      </div>
    </div>
  );
}
