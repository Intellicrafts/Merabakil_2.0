"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Gavel, MessageSquareText, Scale, User, Volume2 } from "lucide-react";

import { formatTranscriptLine } from "@/lib/courtroom/bilingual";
import type { SpeakerRole, TranscriptEntry, TranscriptLanguage } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

interface HearingChatProps {
  entries: TranscriptEntry[];
  language?: TranscriptLanguage;
  isPaused?: boolean;
  listeningMode?: boolean;
  speakingEntryId?: string | null;
  typingEntryId?: string | null;
  typingCharCount?: number;
  isThinking?: boolean;
  className?: string;
  viewMode?: "chat" | "order_sheet";
  onViewModeChange?: (mode: "chat" | "order_sheet") => void;
}

const BUBBLE: Record<SpeakerRole, string> = {
  judge:
    "border-stone-400/35 bg-gradient-to-br from-stone-100/95 to-white/80 dark:from-white/[0.1] dark:to-white/[0.04]",
  petitioner:
    "border-sky-500/25 bg-gradient-to-br from-sky-50/90 to-white/80 dark:from-sky-500/10 dark:to-white/[0.03]",
  respondent:
    "border-violet-500/25 bg-gradient-to-br from-violet-50/90 to-white/80 dark:from-violet-500/10 dark:to-white/[0.03]",
  clerk: "border-black/[0.06] bg-white/70 dark:border-white/10 dark:bg-white/[0.03]",
};

function Avatar({ role }: { role: SpeakerRole }) {
  if (role === "judge") {
    return (
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-stone-300/40">
        <Image src="/courtroom/judge-avatar.svg" alt="" fill sizes="36px" className="object-cover" />
      </div>
    );
  }
  if (role === "petitioner" || role === "respondent") {
    return (
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-black/[0.06] dark:border-white/10">
        <Image src="/courtroom/advocate-avatar.svg" alt="" fill sizes="36px" className="object-cover" />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/[0.06] bg-slate-100 dark:border-white/10 dark:bg-white/[0.06]">
      <Gavel className="h-4 w-4 text-slate-500" strokeWidth={1.5} />
    </div>
  );
}

export function HearingChat({
  entries,
  language = "en",
  isPaused = false,
  listeningMode = false,
  speakingEntryId = null,
  typingEntryId = null,
  typingCharCount = 0,
  isThinking = false,
  className,
  viewMode = "chat",
  onViewModeChange,
}: HearingChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLen = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isPaused) return;
    if (entries.length >= prevLen.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
    prevLen.current = entries.length;
  }, [entries.length, typingCharCount, isPaused]);

  return (
    <section
      className={cn(
        "flex h-full min-h-[300px] max-h-[min(56vh,560px)] flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white/65 backdrop-blur-xl",
        "dark:border-white/[0.08] dark:bg-white/[0.035]",
        "cs-bench-elevated",
        isPaused && "border-amber-500/25",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-black/[0.05] px-4 py-3 dark:border-white/[0.06]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-800 text-stone-50 dark:bg-stone-200 dark:text-stone-900">
          <MessageSquareText className="h-4 w-4" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {viewMode === "order_sheet" ? "Order sheet" : "Argument chamber"}
          </h2>
          <p className="text-[10px] text-muted-foreground">{entries.length} entries</p>
        </div>
        {onViewModeChange && (
          <div className="flex rounded-lg border border-black/[0.06] p-0.5 text-[10px] dark:border-white/10">
            <button
              type="button"
              onClick={() => onViewModeChange("chat")}
              className={cn(
                "rounded-md px-2 py-1 font-semibold",
                viewMode === "chat" && "bg-stone-800 text-stone-50 dark:bg-stone-200 dark:text-stone-900",
              )}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("order_sheet")}
              className={cn(
                "rounded-md px-2 py-1 font-semibold",
                viewMode === "order_sheet" &&
                  "bg-stone-800 text-stone-50 dark:bg-stone-200 dark:text-stone-900",
              )}
            >
              Order sheet
            </button>
          </div>
        )}
        {listeningMode && speakingEntryId && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-200">
            <Volume2 className="h-3 w-3 cs-live-dot" />
            Speaking
          </span>
        )}
        {isThinking && (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-200">
            Counsel preparing…
          </span>
        )}
        {isPaused && (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-200">
            Paused
          </span>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {entries.length === 0 && !isThinking && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-14 text-center">
            <Scale className="h-8 w-8 text-muted-foreground/35" strokeWidth={1.25} />
            <p className="text-[12px] text-muted-foreground">
              Arguments will stream here once the hearing opens.
            </p>
          </div>
        )}

        {viewMode === "order_sheet" ? (
          <ol className="space-y-0 border-l border-stone-300/50 pl-3 dark:border-white/15">
            {entries.map((entry, index) => {
              const { primary } = formatTranscriptLine(entry, language);
              return (
                <li key={entry.id} className="relative pb-3">
                  <span className="absolute -left-[19px] top-0 flex h-5 w-5 items-center justify-center rounded-full border border-stone-300/60 bg-white text-[9px] font-bold tabular-nums dark:border-white/20 dark:bg-stone-900">
                    {index + 1}
                  </span>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {entry.speaker} · {entry.role}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-foreground/90">{primary}</p>
                </li>
              );
            })}
          </ol>
        ) : (
        <ul className="space-y-3">
          {entries.map((entry, index) => {
            const { primary, secondary } = formatTranscriptLine(entry, language);
            const isSpeaking = speakingEntryId === entry.id;
            const isTyping = typingEntryId === entry.id;
            const displayPrimary =
              isTyping && typingCharCount < primary.length
                ? primary.slice(0, typingCharCount)
                : primary;
            const align =
              entry.role === "respondent"
                ? "flex-row-reverse text-right"
                : entry.role === "judge" || entry.role === "clerk"
                  ? "justify-center text-center"
                  : "flex-row text-left";

            return (
              <li
                key={entry.id}
                className={cn(
                  "flex gap-2.5",
                  align,
                  isSpeaking && "cs-speaking-ring rounded-2xl",
                )}
              >
                {entry.role !== "clerk" && <Avatar role={entry.role} />}
                <div
                  className={cn(
                    "max-w-[min(100%,520px)] rounded-2xl border px-3.5 py-2.5",
                    BUBBLE[entry.role],
                    isTyping && index === entries.length - 1 && "ring-1 ring-stone-400/20",
                  )}
                >
                  <div
                    className={cn(
                      "mb-1 flex flex-wrap items-center gap-1.5",
                      entry.role === "respondent" && "justify-end",
                      (entry.role === "judge" || entry.role === "clerk") && "justify-center",
                    )}
                  >
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold capitalize text-muted-foreground">
                      {entry.role === "judge" ? (
                        <Scale className="h-3 w-3" />
                      ) : entry.role === "clerk" ? (
                        <Gavel className="h-3 w-3" />
                      ) : (
                        <User className="h-3 w-3" />
                      )}
                      {entry.role}
                    </span>
                    <span className="text-[11px] font-semibold">{entry.speaker}</span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-foreground/90">
                    {displayPrimary}
                    {isTyping && typingCharCount < primary.length && (
                      <span className="ml-0.5 inline-block h-[14px] w-[2px] animate-pulse bg-stone-700 align-middle dark:bg-stone-200" />
                    )}
                  </p>
                  {secondary && !isTyping && (
                    <p className="mt-1.5 border-t border-black/[0.05] pt-1.5 text-[12px] text-muted-foreground dark:border-white/[0.06]">
                      {secondary}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        )}

        {isThinking && (
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300/50 px-3 py-3 text-[11px] text-muted-foreground dark:border-white/12">
            <span className="cs-live-dot inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            Next speaker is preparing a submission…
          </div>
        )}
      </div>
    </section>
  );
}
