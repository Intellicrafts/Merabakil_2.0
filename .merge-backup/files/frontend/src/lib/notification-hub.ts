"use client";

import type { SummonAlertHit } from "@/hooks/use-appointment-summon-watcher";
import { playAlertChime, showBrowserNotification } from "@/lib/room-alerts";
import {
  dismissSummonSignal,
  isSummonDismissed,
  markSummonHandled,
  shouldShowSummonAlert,
  summonSignalKey,
} from "@/lib/summon-alerts";

export type NotificationKind = "summon";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  appointmentId: string;
  title: string;
  body: string;
  fromName: string;
  lastSummonAt: string;
  createdAt: number;
  read: boolean;
}

type Listener = () => void;

let notifications: AppNotification[] = [];
let activeBanner: SummonAlertHit | null = null;
let inboxConnected = false;
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn();
}

function notifySurfaces(item: AppNotification, inRoomPath: boolean) {
  if (
    !shouldShowSummonAlert(item.appointmentId, item.lastSummonAt, { inRoomPath })
  ) {
    return;
  }
  const key = summonSignalKey(item.appointmentId, item.lastSummonAt);
  if (isSummonDismissed(key)) return;
  markSummonHandled(key);

  void playAlertChime("summon");
  const hidden = typeof document !== "undefined" && document.hidden;
  if (hidden) {
    showBrowserNotification(
      item.title,
      item.body,
      item.appointmentId,
    );
  }

  activeBanner = {
    id: item.appointmentId,
    counterpart_name: item.fromName,
    last_summon_at: item.lastSummonAt,
  };
  emit();
}

export const notificationHub = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getNotifications() {
    return notifications;
  },

  getUnreadCount() {
    return notifications.filter((n) => !n.read).length;
  },

  getActiveBanner() {
    return activeBanner;
  },

  getInboxConnected() {
    return inboxConnected;
  },

  setInboxConnected(connected: boolean) {
    inboxConnected = connected;
    emit();
  },

  ingestSummon(
    event: { appointmentId: string; fromName: string; lastSummonAt: string },
    inRoomPath: boolean,
  ) {
    const key = summonSignalKey(event.appointmentId, event.lastSummonAt);
    if (isSummonDismissed(key)) return;
    const existing = notifications.find(
      (n) => n.appointmentId === event.appointmentId && n.lastSummonAt === event.lastSummonAt,
    );
    if (existing) return;

    const item: AppNotification = {
      id: key,
      kind: "summon",
      appointmentId: event.appointmentId,
      title: "Rejoin requested",
      body: `${event.fromName} is waiting for you in the consultation room.`,
      fromName: event.fromName,
      lastSummonAt: event.lastSummonAt,
      createdAt: Date.now(),
      read: false,
    };
    notifications = [item, ...notifications].slice(0, 20);
    notifySurfaces(item, inRoomPath);
  },

  ingestPollSummon(hit: SummonAlertHit, inRoomPath: boolean) {
    this.ingestSummon(
      {
        appointmentId: hit.id,
        fromName: hit.counterpart_name,
        lastSummonAt: hit.last_summon_at,
      },
      inRoomPath,
    );
  },

  clearSummon(appointmentId: string) {
    notifications = notifications.filter((n) => n.appointmentId !== appointmentId);
    if (activeBanner?.id === appointmentId) activeBanner = null;
    emit();
  },

  dismissBanner() {
    activeBanner = null;
    emit();
  },

  dismissNotification(id: string) {
    const item = notifications.find((n) => n.id === id);
    if (item) dismissSummonSignal(summonSignalKey(item.appointmentId, item.lastSummonAt));
    notifications = notifications.filter((n) => n.id !== id);
    if (activeBanner && item && activeBanner.id === item.appointmentId) activeBanner = null;
    emit();
  },

  markRead(id: string) {
    notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    emit();
  },

  markAllRead() {
    notifications = notifications.map((n) => ({ ...n, read: true }));
    emit();
  },
};
