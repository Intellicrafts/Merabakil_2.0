"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";

import { useInboxEvents, type InboxStreamEvent } from "@/hooks/use-inbox-events";
import type { IncomingCallPayload } from "@/lib/appointment-types";
import { listNotifications } from "@/lib/api";
import { callHub } from "@/lib/call-hub";
import type { AppNotification, NotificationKind } from "@/lib/notification-hub";
import { notificationHub } from "@/lib/notification-hub";
import { requestNotificationPermission } from "@/lib/room-alerts";

function useHubStore<T>(selector: () => T): T {
  return useSyncExternalStore(
    (onStoreChange) => notificationHub.subscribe(onStoreChange),
    selector,
    selector,
  );
}

const NotificationContext = createContext({ inboxConnected: false });

export function useNotifications() {
  return useContext(NotificationContext);
}

export function useNotificationList() {
  return useHubStore(() => notificationHub.getNotifications());
}

export function useNotificationUnread() {
  return useHubStore(() => notificationHub.getUnreadCount());
}

export function useActiveSummonBanner() {
  return useHubStore(() => notificationHub.getActiveBanner());
}

function appointmentIdFromUrl(url: string | null): string {
  if (!url) return "";
  const m = url.match(/\/appointments\/([^/]+)/);
  return m?.[1] ?? "";
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    listNotifications()
      .then((items) => {
        const mapped: AppNotification[] = items.map((n) => ({
          id: n.id,
          kind: n.kind as NotificationKind,
          appointmentId: appointmentIdFromUrl(n.action_url),
          title: n.title,
          body: n.body ?? "",
          fromName: "",
          lastSummonAt: "",
          createdAt: new Date(n.created_at).getTime(),
          read: n.is_read,
          actionUrl: n.action_url ?? undefined,
        }));
        notificationHub.loadFromHistory(mapped);
      })
      .catch(() => undefined);
  }, []);

  const handleSummon = useCallback(
    (event: { appointmentId: string; fromName: string; lastSummonAt: string }) => {
      const inRoom = pathname === `/appointments/${event.appointmentId}/room`;
      notificationHub.ingestSummon(event, inRoom);
    },
    [pathname],
  );

  const handleInboxEvent = useCallback((event: InboxStreamEvent) => {
    if (event.type === "counsel_reassigned") {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("legalos:appointments-changed"));
      }
    }
    if (event.type === "summon_cleared" && event.appointment_id) {
      notificationHub.clearSummon(event.appointment_id);
    }
    if (
      (event.type === "call_cancelled" ||
        event.type === "call_declined" ||
        event.type === "call_ended" ||
        event.type === "call_missed") &&
      event.appointment_id
    ) {
      callHub.onDeclinedOrCancelled();
    }
  }, []);

  const handleIncomingCall = useCallback(
    (payload: IncomingCallPayload) => {
      const inRoom = pathname === `/appointments/${payload.appointment_id}/room`;
      callHub.ingestIncoming(payload, { inRoom });
    },
    [pathname],
  );

  const { connected } = useInboxEvents(handleSummon, handleInboxEvent, handleIncomingCall);

  useEffect(() => {
    notificationHub.setInboxConnected(connected);
  }, [connected]);

  useEffect(() => {
    function onPollSummon(e: Event) {
      const detail = (e as CustomEvent<{ id: string; counterpart_name: string; last_summon_at: string }>).detail;
      if (!detail?.id || !detail.last_summon_at) return;
      const inRoom = pathname === `/appointments/${detail.id}/room`;
      notificationHub.ingestPollSummon(detail, inRoom);
    }
    window.addEventListener("legalos:summon-alert", onPollSummon);
    return () => window.removeEventListener("legalos:summon-alert", onPollSummon);
  }, [pathname]);

  return (
    <NotificationContext.Provider value={{ inboxConnected: connected }}>
      {children}
    </NotificationContext.Provider>
  );
}
