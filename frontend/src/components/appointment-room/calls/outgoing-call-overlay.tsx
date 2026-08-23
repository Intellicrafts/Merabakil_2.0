"use client";

import { Loader2, PhoneOff } from "lucide-react";

import type { CallMode } from "@/lib/appointment-types";
import { cn } from "@/lib/utils";

interface OutgoingCallOverlayProps {
  counterpartName: string;
  mode: CallMode;
  onCancel: () => void;
  cancelling?: boolean;
}

export function OutgoingCallOverlay({
  counterpartName,
  mode,
  onCancel,
  cancelling = false,
}: OutgoingCallOverlayProps) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-950/95 p-6 text-center text-white shadow-2xl">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/10 ring-2 ring-white/15">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
        <p className="text-lg font-semibold">Calling {counterpartName}</p>
        <p className="mt-1 text-sm text-white/65">
          {mode === "video" ? "Video consultation" : "Audio consultation"}
        </p>
        <button
          type="button"
          disabled={cancelling}
          onClick={onCancel}
          className={cn(
            "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500/90 px-4 py-3 text-sm font-semibold",
            cancelling && "opacity-70",
          )}
        >
          <PhoneOff className="h-4 w-4" />
          {cancelling ? "Cancelling…" : "Cancel call"}
        </button>
      </div>
    </div>
  );
}
