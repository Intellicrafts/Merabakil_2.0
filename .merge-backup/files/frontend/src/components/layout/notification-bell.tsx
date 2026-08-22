"use client";

import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { useState } from "react";

import {
  useNotificationList,
  useNotificationUnread,
} from "@/components/layout/notification-provider";
import { dismissSummonAlert } from "@/hooks/use-appointment-summon-watcher";
import { dismissAppointmentSummon } from "@/lib/api";
import { notificationHub } from "@/lib/notification-hub";
import { cn } from "@/lib/utils";

function formatRelative(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return "Just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = useNotificationList();
  const unread = useNotificationUnread();

  function openRoom(appointmentId: string, itemId: string) {
    notificationHub.markRead(itemId);
    notificationHub.dismissBanner();
    setOpen(false);
    router.push(`/appointments/${appointmentId}/room`);
  }

  function dismissItem(id: string, appointmentId: string, lastSummonAt: string) {
    dismissSummonAlert(appointmentId, lastSummonAt);
    void dismissAppointmentSummon(appointmentId).catch(() => undefined);
    notificationHub.dismissNotification(id);
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) notificationHub.markAllRead();
        }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/[0.08] bg-white/60 text-foreground backdrop-blur-sm transition hover:bg-white dark:border-white/10 dark:bg-white/[0.06]"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-[60]"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-[calc(100%+0.5rem)] z-[61] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/[0.08] bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[hsl(220_14%_9%)]/95">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3 dark:border-white/10">
              <p className="text-[13px] font-semibold">Notifications</p>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 opacity-70 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
              {items.length === 0 ? (
                <li className="px-3 py-8 text-center text-[12px] text-muted-foreground">No notifications yet</li>
              ) : (
                items.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      "mb-2 rounded-xl border border-black/[0.06] p-3 dark:border-white/10",
                      !item.read && "bg-sky-50/80 dark:bg-sky-950/20",
                    )}
                  >
                    <div className="flex gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
                        {initials(item.fromName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold">{item.fromName}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                          Waiting for you in the consultation room
                        </p>
                        <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">{formatRelative(item.createdAt)}</p>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => openRoom(item.appointmentId, item.id)}
                            className="inline-flex h-7 items-center rounded-lg bg-slate-900 px-2.5 text-[11px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
                          >
                            Open room
                          </button>
                          <button
                            type="button"
                            onClick={() => dismissItem(item.id, item.appointmentId, item.lastSummonAt)}
                            className="inline-flex h-7 items-center rounded-lg border border-black/[0.08] px-2.5 text-[11px] font-medium dark:border-white/10"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
