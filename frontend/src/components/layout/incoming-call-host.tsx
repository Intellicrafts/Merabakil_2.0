"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { IncomingCallCard } from "@/components/appointment-room/calls/incoming-call-card";
import { useCallHubState } from "@/hooks/use-call-hub";
import { respondAppointmentCall } from "@/lib/api";
import { callHub } from "@/lib/call-hub";
import { stopCallRingtone } from "@/lib/room-alerts";

export function IncomingCallHost() {
  const router = useRouter();
  const pathname = usePathname();
  const callState = useCallHubState();
  const [busy, setBusy] = useState(false);

  if (callState.phase !== "incoming_ring") return null;
  if (pathname === `/appointments/${callState.appointmentId}/room`) return null;

  const { appointmentId, callId, mode, counterpartName } = callState;

  async function accept() {
    setBusy(true);
    try {
      stopCallRingtone();
      await respondAppointmentCall(appointmentId, callId, "accept");
      router.push(`/appointments/${appointmentId}/room?acceptCall=${callId}`);
    } catch {
      callHub.onDeclinedOrCancelled();
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    try {
      await respondAppointmentCall(appointmentId, callId, "decline");
      callHub.onDeclinedOrCancelled();
    } catch {
      callHub.onDeclinedOrCancelled();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-[75] flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-sm">
        <IncomingCallCard
          counterpartName={counterpartName}
          mode={mode}
          onAccept={() => void accept()}
          onDecline={() => void decline()}
          busy={busy}
        />
      </div>
    </div>
  );
}
