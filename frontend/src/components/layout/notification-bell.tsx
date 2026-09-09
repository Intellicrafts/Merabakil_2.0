"use client";

import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  useNotificationList,
  useNotificationUnread,
} from "@/components/layout/notification-provider";
import { useAnchoredOverlay } from "@/components/ui/use-anchored-overlay";
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { layout, mounted } = useAnchoredOverlay(open, triggerRef, {
    minWidth: 320,
    maxMenuHeight: 420,
    align: "end",
  });
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

  function toggle() {
    setOpen((v) => !v);
    if (!open) notificationHub.markAllRead();
  }

  const panel =
    open && mounted && layout
      ? createPortal(
          <div className="ui-select-layer" data-mode={layout.mode}>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Close notifications"
              className="ui-select-veil"
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-label="Notifications"
              style={
                layout.mode === "popover"
                  ? {
                      top: layout.top,
                      bottom: layout.bottom,
                      left: layout.left,
                      width: layout.width,
                      maxHeight: layout.maxHeight,
                    }
                  : undefined
              }
              className={cn(
                "ui-select-menu",
                layout.mode === "sheet" ? "ui-select-sheet" : "ui-select-popover",
                "p-0",
              )}
            >
              {layout.mode === "sheet" && (
                <div className="flex flex-col items-center pt-2">
                  <span className="ui-select-handle" />
                </div>
              )}
              <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3 dark:border-white/10">
                <p className="text-[13px] font-semibold">Notifications</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1 opacity-70 hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ul className="ui-select-list max-h-[min(24rem,55vh)] p-2">
                {items.length === 0 ? (
                  <li className="px-3 py-8 text-center text-[12px] text-muted-foreground">
                    No notifications yet
                  </li>
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
                          <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                            {formatRelative(item.createdAt)}
                          </p>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => openRoom(item.appointmentId, item.id)}
                              className="inline-flex h-8 items-center rounded-lg bg-slate-900 px-2.5 text-[11px] font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
                            >
                              Open room
                            </button>
                            <button
                              type="button"
                              onClick={() => dismissItem(item.id, item.appointmentId, item.lastSummonAt)}
                              className="inline-flex h-8 items-center rounded-lg border border-black/[0.08] px-2.5 text-[11px] font-medium dark:border-white/10"
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
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={toggle}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/[0.08] bg-white/60 text-foreground backdrop-blur-sm transition hover:bg-white dark:border-white/10 dark:bg-white/[0.06]"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {panel}
    </div>
  );
}
