"use client";

import { IncomingCallCard } from "@/components/appointment-room/calls/incoming-call-card";
import type { CallMode } from "@/lib/appointment-types";

interface IncomingCallOverlayProps {
  counterpartName: string;
  mode: CallMode;
  onAccept: () => void;
  onDecline: () => void;
  busy?: boolean;
}

export function IncomingCallOverlay(props: IncomingCallOverlayProps) {
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <IncomingCallCard {...props} className="w-full max-w-sm" />
    </div>
  );
}
