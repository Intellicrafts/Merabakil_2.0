"use client";

import { Radio } from "lucide-react";

interface RejoinPromptModalProps {
  counterpartName: string;
  waiting: boolean;
  sent: boolean;
  onWait: () => void;
  onSendRequest: () => void;
}

export function RejoinPromptModal({
  counterpartName,
  waiting,
  sent,
  onWait,
  onSendRequest,
}: RejoinPromptModalProps) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-5">
      <div className="mp-modal-veil absolute inset-0" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rejoin-prompt-title"
        className="relative z-[81] w-full max-w-md overflow-hidden rounded-t-3xl border border-black/[0.08] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-[hsl(220_14%_9%)] sm:rounded-3xl"
      >
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-slate-100 dark:from-sky-950/50 dark:to-white/10">
          <Radio className="h-5 w-5 text-sky-700 dark:text-sky-300" />
        </div>
        <h2 id="rejoin-prompt-title" className="text-[16px] font-semibold tracking-tight">
          {counterpartName} is not in the room
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Send a join request and they&apos;ll get an instant notification on any page — even on mobile.
        </p>
        {sent ? (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            Join request sent. We&apos;ll notify you when {counterpartName.split(" ")[0]} returns.
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="mp-btn-accent h-11 flex-1 rounded-xl text-[13px] font-semibold disabled:opacity-50"
            onClick={onSendRequest}
            disabled={waiting || sent}
          >
            {waiting ? "Sending…" : sent ? "Request sent" : "Send join request"}
          </button>
          <button
            type="button"
            className="mp-btn-primary h-11 flex-1 rounded-xl text-[13px] font-semibold"
            onClick={onWait}
          >
            Wait in room
          </button>
        </div>
      </div>
    </div>
  );
}
