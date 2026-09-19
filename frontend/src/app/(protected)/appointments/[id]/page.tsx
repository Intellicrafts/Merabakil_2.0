"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Clock3, FileText, FolderOpen, Sparkles } from "lucide-react";

import {
  cancelAppointment,
  confirmAppointment,
  fetchAppointmentTranscript,
  getAppointment,
  getAppointmentJoinState,
  getCaseApi,
  listCaseDocuments,
  rejectAppointment,
} from "@/lib/api";
import type { JoinStateDto } from "@/lib/appointment-types";
import { useToast } from "@/components/ui/toast";
import { AttachmentPreview } from "@/components/appointment-room/attachment-preview";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import type { AppointmentMessage, AppointmentRecord } from "@/lib/appointment-types";
import type { AiBrief } from "@/lib/types";

// ── Case Facts panel (lawyer view) ───────────────────────────────────────────

function CaseFactsPanel({ caseId, matterSummary }: { caseId: string; matterSummary: string }) {
  const { t } = useTranslation();
  const { data: caseItem, isLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCaseApi(caseId),
    staleTime: 60_000,
    retry: 1,
  });

  const { data: docs } = useQuery({
    queryKey: ["case-docs-lawyer", caseId],
    queryFn: () => listCaseDocuments(caseId),
    staleTime: 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="h-16 w-full rounded bg-muted" />
        <div className="h-10 w-full rounded bg-muted" />
      </div>
    );
  }

  if (!caseItem) {
    return (
      <p className="text-[13px] text-muted-foreground">{t("appointments.caseFactsLoadError")}</p>
    );
  }

  const brief: AiBrief = caseItem.ai_brief ?? {};
  const caseDocuments = docs ?? [];

  return (
    <div className="space-y-5">
      {/* Case meta */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {caseItem.source === "saarthi" && (
            <Badge className="border-transparent bg-violet-500/10 text-[11px] text-violet-800 dark:text-violet-300">
              <Sparkles className="mr-1 h-3 w-3" />
              {t("appointments.aiExtracted")}
            </Badge>
          )}
          <Link
            href={`/cases/${caseId}`}
            className="text-[12px] text-primary underline-offset-2 hover:underline"
          >
            {t("appointments.openFullCase")}
          </Link>
        </div>
        <h3 className="mt-2 text-[15px] font-semibold">{caseItem.title}</h3>
      </div>

      {/* Section 1: Client Problem */}
      <div>
        <p className="mb-1 text-[11px] font-semibold text-muted-foreground">
          {t("appointments.clientProblem")}
        </p>
        <p className="text-[13px] leading-relaxed">
          {brief.problem_summary || matterSummary}
        </p>
      </div>

      {/* Section 2: Case Details — Key Facts */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
          {t("appointments.caseDetails")}
        </p>
        {(brief.key_facts?.length ?? 0) > 0 ? (
          <ul className="space-y-1">
            {brief.key_facts!.map((fact, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                {fact}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">{t("appointments.noKeyFacts")}</p>
        )}
      </div>

      {/* Documents */}
      {caseDocuments.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold text-muted-foreground">
            {t("appointments.caseFacts")} ({caseDocuments.length})
          </p>
          <ul className="space-y-1.5">
            {caseDocuments.map((doc) => (
              <li
                key={doc.document_id}
                className="flex items-center gap-2 rounded-lg border border-black/[0.06] bg-white/50 px-3 py-2 dark:border-white/[0.08] dark:bg-white/[0.04]"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                <span className="min-w-0 truncate text-[12px]">{doc.title}</span>
                <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
                  {doc.doc_type}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AppointmentDetailsPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [apt, setApt] = useState<AppointmentRecord | null>(null);
  const [join, setJoin] = useState<JoinStateDto | null>(null);
  const [messages, setMessages] = useState<AppointmentMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"confirm" | "cancel" | "reject" | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "brief">("details");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

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
          {t("appointments.backToMarketplace")}
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
  const hasCaseBrief = Boolean(apt.case_id);

  const minutesUntil = apt.scheduled_at
    ? (new Date(apt.scheduled_at).getTime() - Date.now()) / 60_000
    : Infinity;
  const refundEligible = apt.my_role === "lawyer" || minutesUntil >= 5;

  return (
    <div
      className={`mx-auto w-full max-w-[720px] space-y-5 pb-[max(2rem,env(safe-area-inset-bottom))] ${joinable ? "pb-28 sm:pb-[max(2rem,env(safe-area-inset-bottom))]" : ""}`}
    >
      {/* Tabs when case_id is set */}
      {hasCaseBrief && (
        <div className="flex gap-1 rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.06]">
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`flex-1 rounded-lg py-2.5 min-h-11 text-[13px] font-medium transition-colors ${
              activeTab === "details"
                ? "bg-white shadow-sm dark:bg-white/[0.12]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("appointments.tab")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("brief")}
            className={`flex-1 flex min-h-11 items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-medium transition-colors ${
              activeTab === "brief"
                ? "bg-white shadow-sm dark:bg-white/[0.12]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            {t("appointments.caseFacts")}
          </button>
        </div>
      )}

      {/* Case Facts tab content */}
      {hasCaseBrief && activeTab === "brief" && (
        <div className="rounded-3xl border border-black/[0.06] bg-white/55 p-5 shadow-[0_16px_48px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.035]">
          <CaseFactsPanel caseId={apt.case_id!} matterSummary={apt.matter_summary ?? ""} />
        </div>
      )}

      {/* Main appointment details */}
      {(!hasCaseBrief || activeTab === "details") && (
        <>
          <div className="rounded-3xl border border-black/[0.06] bg-white/55 p-5 shadow-[0_16px_48px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.035]">
            <p className="text-[11px] font-semibold text-muted-foreground">
              {t("appointments.detailsLabel")}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">{apt.counterpart_name || apt.lawyer_name}</h1>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              {apt.date} · {apt.time_slot}
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{apt.matter_summary}</p>
            <p className="mt-3 text-[12px] capitalize text-muted-foreground">
              {t("common.status")} · {apt.status.replace("_", " ")}
            </p>
            {joinable && opponentWaiting ? (
              <p className="mt-2 text-[12px] font-medium text-emerald-700 dark:text-emerald-300">
                {t("appointments.waitingInRoom").replace("{{name}}", apt.counterpart_name ?? "")}
              </p>
            ) : null}
            {apt.pending_summon ? (
              <p className="mt-2 text-[12px] font-medium text-sky-700 dark:text-sky-300">
                {t("appointments.pendingJoinRequest")}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {joinable && (
                <Link
                  href={`/appointments/${apt.id}/room`}
                  className="mp-btn-accent inline-flex h-11 min-h-11 items-center rounded-xl px-4 text-[13px] font-semibold sm:h-10 sm:min-h-10"
                >
                  {isRejoin ? t("appointments.rejoinRoom") : t("appointments.joinRoom")}
                </Link>
              )}
              {apt.my_role === "lawyer" && apt.status === "requested" && (
                <>
                  <button
                    type="button"
                    disabled={busy !== null}
                    className="mp-btn-accent inline-flex h-11 min-h-11 items-center rounded-xl px-4 text-[13px] font-semibold sm:h-10 sm:min-h-10"
                    onClick={async () => {
                      setBusy("confirm");
                      try {
                        setApt(await confirmAppointment(apt.id));
                        toast({ title: t("appointments.appointmentAccepted"), variant: "success" });
                      } catch (err) {
                        toast({ title: t("appointments.couldNotAccept"), description: (err as Error).message, variant: "destructive" });
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {busy === "confirm" ? t("appointments.accepting") : t("appointments.accept")}
                  </button>
                  {!showRejectInput && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => setShowRejectInput(true)}
                      className="inline-flex h-11 min-h-11 items-center rounded-xl border border-red-200 px-4 text-[13px] font-semibold text-red-700 dark:border-red-900/40 dark:text-red-300 sm:h-10 sm:min-h-10"
                    >
                      {t("appointments.rejectBtn")}
                    </button>
                  )}
                </>
              )}
              {!["completed", "expired", "no_show", "cancelled", "live"].includes(apt.status) && (
                <button
                  type="button"
                  disabled={busy !== null}
                  className="inline-flex h-11 min-h-11 items-center rounded-xl border border-red-200 px-4 text-[13px] font-semibold text-red-700 dark:border-red-900/40 dark:text-red-300 sm:h-10 sm:min-h-10"
                  onClick={() => setConfirmCancel(true)}
                >
                  {t("common.cancel")}
                </button>
              )}
            </div>
          {/* Cancel confirmation — desktop inline */}
          {confirmCancel && (
              <div className="mt-3 hidden rounded-xl border border-red-200/70 bg-red-50/60 p-4 dark:border-red-900/30 dark:bg-red-900/10 sm:block">
                <p className="text-[13px] font-semibold text-red-800 dark:text-red-200">{t("appointments.cancelThisAppointment")}</p>
                <p className="mt-1 text-[12px] text-red-700/80 dark:text-red-300/70">
                  {refundEligible
                    ? t("appointments.cancelRefundEligible")
                    : t("appointments.cancelNoRefund")}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy === "cancel"}
                    className="inline-flex min-h-11 items-center rounded-lg bg-red-600 px-4 text-[12px] font-semibold text-white disabled:opacity-50"
                    onClick={async () => {
                      setBusy("cancel");
                      try {
                        setApt(await cancelAppointment(apt.id));
                        toast({ title: t("appointments.appointmentCancelled"), description: refundEligible ? t("appointments.refundProcessed") : undefined });
                        setConfirmCancel(false);
                      } catch (err) {
                        toast({ title: t("appointments.couldNotCancel"), description: (err as Error).message, variant: "destructive" });
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {busy === "cancel" ? t("appointments.cancellingDots") : t("appointments.confirmCancellation")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    className="inline-flex min-h-11 items-center rounded-lg border border-input px-4 text-[12px] font-medium"
                  >
                    {t("appointments.goBack")}
                  </button>
                </div>
              </div>
          )}

          {/* Reject reason input — desktop inline */}
          {showRejectInput && apt.my_role === "lawyer" && apt.status === "requested" && (
            <div className="mt-4 hidden space-y-2 rounded-xl border border-red-200/60 bg-red-50/40 p-4 dark:border-red-900/30 dark:bg-red-900/10 sm:block">
              <p className="text-[13px] font-medium">{t("appointments.reasonForRejection")}</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
                placeholder={t("appointments.rejectionPlaceholder")}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!rejectReason.trim() || busy === "reject"}
                  className="inline-flex min-h-11 items-center rounded-lg bg-red-600 px-4 text-[12px] font-semibold text-white disabled:opacity-50"
                  onClick={async () => {
                    setBusy("reject");
                    try {
                      setApt(await rejectAppointment(apt.id, rejectReason.trim()));
                      toast({ title: t("appointments.appointmentRejected") });
                      setShowRejectInput(false);
                    } catch (err) {
                      toast({ title: t("appointments.couldNotReject"), description: (err as Error).message, variant: "destructive" });
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {busy === "reject" ? t("appointments.rejectingDots") : t("appointments.confirmRejection")}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
                  className="inline-flex min-h-11 items-center rounded-lg border border-input px-4 text-[12px] font-medium"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [t("appointments.messagesCount"), metrics.message_count ?? messages.length],
              [t("appointments.citizenJoins"), metrics.citizen_join_count ?? "—"],
              [t("appointments.lawyerJoins"), metrics.lawyer_join_count ?? "—"],
              [t("appointments.talkSeconds"), metrics.talk_seconds ?? "—"],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-black/[0.06] bg-white/50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]"
              >
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          <section className="px-1 py-2">
            <h2 className="text-[12px] font-semibold text-muted-foreground">
              {t("appointments.transcriptTitle")}
            </h2>
            {messages.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("appointments.noMessagesRecorded")}</p>
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
        </>
      )}

      {joinable && (!hasCaseBrief || activeTab === "details") ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.06] bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden dark:border-white/10">
          <Link
            href={`/appointments/${apt.id}/room`}
            className="mp-btn-accent flex min-h-11 w-full items-center justify-center rounded-xl text-[14px] font-semibold"
          >
            {isRejoin ? t("appointments.rejoinRoom") : t("appointments.joinRoom")}
          </Link>
        </div>
      ) : null}

      {confirmCancel ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:hidden">
          <button type="button" className="absolute inset-0" onClick={() => setConfirmCancel(false)} aria-label={t("appointments.goBack")} />
          <div className="relative w-full rounded-t-3xl bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl">
            <p className="text-[15px] font-semibold text-red-800 dark:text-red-200">{t("appointments.cancelThisAppointment")}</p>
            <p className="mt-1 text-[13px] text-red-700/80 dark:text-red-300/70">
              {refundEligible ? t("appointments.cancelRefundEligible") : t("appointments.cancelNoRefund")}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={busy === "cancel"}
                className="min-h-11 rounded-xl bg-red-600 text-[13px] font-semibold text-white disabled:opacity-50"
                onClick={async () => {
                  setBusy("cancel");
                  try {
                    setApt(await cancelAppointment(apt.id));
                    toast({ title: t("appointments.appointmentCancelled"), description: refundEligible ? t("appointments.refundProcessed") : undefined });
                    setConfirmCancel(false);
                  } catch (err) {
                    toast({ title: t("appointments.couldNotCancel"), description: (err as Error).message, variant: "destructive" });
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === "cancel" ? t("appointments.cancellingDots") : t("appointments.confirmCancellation")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                className="min-h-11 rounded-xl border border-input text-[13px] font-medium"
              >
                {t("appointments.goBack")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showRejectInput && apt.my_role === "lawyer" && apt.status === "requested" ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:hidden">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
            aria-label={t("common.cancel")}
          />
          <div className="relative w-full rounded-t-3xl bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl">
            <p className="text-[15px] font-semibold">{t("appointments.reasonForRejection")}</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder={t("appointments.rejectionPlaceholder")}
              className="mt-3 w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={!rejectReason.trim() || busy === "reject"}
                className="min-h-11 rounded-xl bg-red-600 text-[13px] font-semibold text-white disabled:opacity-50"
                onClick={async () => {
                  setBusy("reject");
                  try {
                    setApt(await rejectAppointment(apt.id, rejectReason.trim()));
                    toast({ title: t("appointments.appointmentRejected") });
                    setShowRejectInput(false);
                  } catch (err) {
                    toast({ title: t("appointments.couldNotReject"), description: (err as Error).message, variant: "destructive" });
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === "reject" ? t("appointments.rejectingDots") : t("appointments.confirmRejection")}
              </button>
              <button
                type="button"
                onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
                className="min-h-11 rounded-xl border border-input text-[13px] font-medium"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
