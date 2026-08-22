"use client";

import { useRouter } from "next/navigation";

import { RoomAlertBanner } from "@/components/appointment-room/room-alert-banner";
import { useActiveSummonBanner } from "@/components/layout/notification-provider";
import { dismissSummonAlert } from "@/hooks/use-appointment-summon-watcher";
import { dismissAppointmentSummon } from "@/lib/api";
import { notificationHub } from "@/lib/notification-hub";

export function SummonAlertHost() {
  const router = useRouter();
  const alert = useActiveSummonBanner();

  if (!alert) return null;

  function dismiss() {
    dismissSummonAlert(alert!.id, alert!.last_summon_at);
    void dismissAppointmentSummon(alert!.id).catch(() => undefined);
    notificationHub.dismissBanner();
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-[70] flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-lg">
        <RoomAlertBanner
          kind="summon"
          title="Rejoin requested"
          body={`${alert.counterpart_name} is waiting for you in the consultation room.`}
          actionLabel="Open room"
          onAction={() => {
            dismissSummonAlert(alert.id, alert.last_summon_at);
            void dismissAppointmentSummon(alert.id).catch(() => undefined);
            notificationHub.dismissBanner();
            router.push(`/appointments/${alert.id}/room`);
          }}
          onDismiss={dismiss}
        />
      </div>
    </div>
  );
}
