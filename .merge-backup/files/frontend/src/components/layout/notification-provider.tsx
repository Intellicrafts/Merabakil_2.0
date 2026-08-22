"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";

import { useInboxEvents, type InboxStreamEvent } from "@/hooks/use-inbox-events";
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

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const handleSummon = useCallback(
    (event: { appointmentId: string; fromName: string; lastSummonAt: string }) => {
      const inRoom = pathname === `/appointments/${event.appointmentId}/room`;
      notificationHub.ingestSummon(event, inRoom);
    },
    [pathname],
  );

  const handleInboxEvent = useCallback((event: InboxStreamEvent) => {
    if (event.type === "summon_cleared" && event.appointment_id) {
      notificationHub.clearSummon(event.appointment_id);
    }
  }, []);

  const { connected } = useInboxEvents(handleSummon, handleInboxEvent);

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
