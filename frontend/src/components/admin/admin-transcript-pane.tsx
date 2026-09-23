"use client";

import { useEffect, useRef } from "react";
import { Shield } from "lucide-react";

import { AttachmentPreview } from "@/components/appointment-room/attachment-preview";
import type { AppointmentMessage, AppointmentRecord } from "@/lib/appointment-types";
import { cn } from "@/lib/utils";
import { CLARITY_MASK } from "@/lib/analytics/clarity-mask";

interface AdminTranscriptPaneProps {
  appointment: AppointmentRecord;
  messages: AppointmentMessage[];
  className?: string;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function AdminTranscriptPane({ appointment, messages, className }: AdminTranscriptPaneProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-background dark:border-white/10",
        className,
      )}
    >
      <div className="shrink-0 border-b border-black/[0.06] px-4 py-2.5 dark:border-white/10">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Live transcript</p>
      </div>
      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
        {messages.length === 0 ? (
          <li className="py-8 text-center text-sm text-muted-foreground">No messages yet.</li>
        ) : (
          messages.map((msg) => {
            const isAdmin = msg.sender_role === "admin";
            const isCitizen = msg.sender_role === "citizen";
            const label = isAdmin
              ? "Platform Ops"
              : isCitizen
                ? appointment.citizen_name
                : appointment.lawyer_name;
            return (
              <li
                key={msg.id}
                className={cn(
                  "max-w-[92%] rounded-2xl px-3 py-2 text-[13px]",
                  isAdmin
                    ? "ml-auto bg-slate-800 text-white dark:bg-slate-700"
                    : isCitizen
                      ? "bg-emerald-50/80 dark:bg-emerald-950/30"
                      : "bg-muted/50",
                )}
              >
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                  {isAdmin ? <Shield className="h-3 w-3" /> : null}
                  <span>{label}</span>
                  <span className="ml-auto font-normal normal-case">{formatTime(msg.created_at)}</span>
                </div>
                {msg.attachment ? (
                  <AttachmentPreview appointmentId={appointment.id} attachment={msg.attachment} mine={false} />
                ) : null}
                {msg.body ? <p {...CLARITY_MASK} className="leading-relaxed">{msg.body}</p> : null}
              </li>
            );
          })
        )}
        <div ref={bottomRef} />
      </ol>
    </div>
  );
}
