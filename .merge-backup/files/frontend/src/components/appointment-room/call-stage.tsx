"use client";

import { useEffect, useRef } from "react";

interface CallStageProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  visible: boolean;
  counterpartName: string;
}

export function CallStage({ localStream, remoteStream, visible, counterpartName }: CallStageProps) {
  const remoteRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = localStream;
  }, [localStream]);

  if (!visible) return null;

  return (
    <div className="relative h-full overflow-hidden rounded-2xl border border-black/[0.06] bg-slate-950/90 dark:border-white/10">
      <video
        ref={remoteRef}
        autoPlay
        playsInline
        className="h-full w-full object-cover"
      />
      {!remoteStream && (
        <div className="absolute inset-0 flex items-center justify-center text-[13px] text-slate-300">
          Waiting for {counterpartName}…
        </div>
      )}
      <video
        ref={localRef}
        autoPlay
        muted
        playsInline
        className="absolute bottom-3 right-3 h-20 w-28 rounded-xl border border-white/20 object-cover shadow-lg"
      />
    </div>
  );
}
