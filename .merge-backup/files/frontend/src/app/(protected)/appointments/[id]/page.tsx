"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Clock3 } from "lucide-react";

import {
  cancelAppointment,
  confirmAppointment,
  fetchAppointmentTranscript,
  getAppointment,
  getAppointmentJoinState,
} from "@/lib/api";
import type { JoinStateDto } from "@/lib/appointment-types";
import { useToast } from "@/components/ui/toast";
import { AttachmentPreview } from "@/components/appointment-room/attachment-preview";
import type { AppointmentMessage, AppointmentRecord } from "@/lib/appointment-types";

export default function AppointmentDetailsPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [apt, setApt] = useState<AppointmentRecord | null>(null);
  const [join, setJoin] = useState<JoinStateDto | null>(null);
  const [messages, setMessages] = useState<AppointmentMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await getAppointment(params.id);
        if (cancelled) return;
        setApt(row);
        if (row.join_state === "expired" || ["completed", "expired", "no_show", "cancelled"].includes(row.status)) {
          const transcript = await fetchAppointmentTranscript(params.id);
          if (!cancelled) {
            setApt(transcript.appointment);
            setMessages(transcript.messages);
          }
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  useEffect(() => {
    if (!apt || apt.join_state !== "joinable") return undefined;
    const poll = async () => {
      try {
        const js = await getAppointmentJoinState(params.id);
        setJoin(js);
      } catch {
        /* keep last */
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => window.clearInterval(timer);
  }, [apt?.join_state, params.id]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-sm font-semibold">{error}</p>
        <Link href="/lawyer-marketplace" className="mp-btn-primary mt-4 inline-flex h-9 rounded-xl px-4 text-[13px]">
          Back to marketplace
        </Link>
      </div>
    );
  }

  if (!apt) {
    return <div className="h-64 animate-pulse rounded-3xl border border-black/[0.06] bg-white/40 dark:border-white/10" />;
  }

  const metrics = apt.metrics ?? {};
  const joinable = apt.join_state === "joinable";
  const isRejoin =
    apt.prior_join ||
    join?.prior_join ||
    (metrics.citizen_join_count ?? 0) > 0 ||
    (metrics.lawyer_join_count ?? 0) > 0 ||
    apt.status === "live";
  const opponentWaiting = join?.opponent_present ?? apt.opponent_present;

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-5 pb-8">
      <div className="rounded-3xl border border-black/[0.06] bg-white/55 p-5 shadow-[0_16px_48px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.035]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Appointment details
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{apt.counterpart_name || apt.lawyer_name}</h1>
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          {apt.date} · {apt.time_slot}
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{apt.matter_summary}</p>
        <p className="mt-3 text-[12px] capitalize text-muted-foreground">Status · {apt.status.replace("_", " ")}</p>
        {joinable && opponentWaiting ? (
          <p className="mt-2 text-[12px] font-medium text-emerald-700 dark:text-emerald-300">
            {apt.counterpart_name} is waiting in the room
          </p>
        ) : null}
        {apt.pending_summon ? (
          <p className="mt-2 text-[12px] font-medium text-sky-700 dark:text-sky-300">
            You have a pending join request for this appointment
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {joinable && (
            <Link
              href={`/appointments/${apt.id}/room`}
              className="mp-btn-accent inline-flex h-9 rounded-xl px-4 text-[13px] font-semibold"
            >
              {isRejoin ? "Rejoin room" : "Join room"}
            </Link>
          )}
          {apt.my_role === "lawyer" && apt.status === "requested" && (
            <button
              type="button"
              disabled={busy !== null}
              className="mp-btn-soft inline-flex h-9 rounded-xl px-4 text-[13px] font-semibold"
              onClick={async () => {
                setBusy("confirm");
                try {
                  setApt(await confirmAppointment(apt.id));
                  toast({ title: "Appointment confirmed", variant: "success" });
                } catch (err) {
                  toast({ title: "Could not confirm", description: (err as Error).message, variant: "destructive" });
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === "confirm" ? "Confirming…" : "Confirm"}
            </button>
          )}
          {!["completed", "expired", "no_show", "cancelled"].includes(apt.status) && (
            <button
              type="button"
              disabled={busy !== null}
              className="inline-flex h-9 rounded-xl border border-red-200 px-4 text-[13px] font-semibold text-red-700 dark:border-red-900/40 dark:text-red-300"
              onClick={async () => {
                setBusy("cancel");
                try {
                  setApt(await cancelAppointment(apt.id));
                  toast({ title: "Appointment cancelled" });
                } catch (err) {
                  toast({ title: "Could not cancel", description: (err as Error).message, variant: "destructive" });
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === "cancel" ? "Cancelling…" : "Cancel"}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Messages", metrics.message_count ?? messages.length],
          ["Citizen joins", metrics.citizen_join_count ?? "—"],
          ["Lawyer joins", metrics.lawyer_join_count ?? "—"],
          ["Talk seconds", metrics.talk_seconds ?? "—"],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-black/[0.06] bg-white/50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]"
          >
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <section className="px-1 py-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Transcript</h2>
        {messages.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No messages were recorded.</p>
        ) : (
          <ol className="mt-4 flex flex-col gap-2">
            {messages.map((msg) => {
              const mine = msg.sender_role === apt.my_role;
              return (
                <li key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] px-3.5 py-2 text-[13px] leading-relaxed ${
                      mine
                        ? "rounded-2xl rounded-br-md bg-gradient-to-br from-slate-800 to-slate-900 text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900"
                        : "rounded-2xl rounded-bl-md bg-stone-100/90 text-stone-800 dark:bg-white/[0.08] dark:text-zinc-100"
                    }`}
                  >
                    <p className={`text-[10px] capitalize ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                      {msg.sender_role}
                      {msg.created_at
                        ? ` · ${new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(msg.created_at))}`
                        : ""}
                    </p>
                    {msg.attachment ? (
                      <AttachmentPreview
                        appointmentId={apt.id}
                        attachment={msg.attachment}
                        mine={mine}
                      />
                    ) : null}
                    {msg.body &&
                    (!msg.attachment ||
                      (msg.body !== msg.attachment.filename &&
                        msg.attachment.kind !== "voice" &&
                        msg.body !== "Voice note")) ? (
                      <p className="mt-1 whitespace-pre-wrap">{msg.body}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
