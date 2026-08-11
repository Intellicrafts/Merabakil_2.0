"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Gavel, MessageSquare, Scale, User, Volume2 } from "lucide-react";

import { formatTranscriptLine } from "@/lib/courtroom/bilingual";
import type { TranscriptEntry, TranscriptLanguage, SpeakerRole } from "@/lib/courtroom/types";
import { useReadAloud } from "@/hooks/use-read-aloud";
import { cn } from "@/lib/utils";

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
  language?: TranscriptLanguage;
  isPaused?: boolean;
  listeningMode?: boolean;
  speakingEntryId?: string | null;
  typingEntryId?: string | null;
  typingCharCount?: number;
  readOnly?: boolean;
  className?: string;
}

const ROLE_BADGE: Record<string, string> = {
  judge: "border-stone-500/30 bg-stone-700 text-stone-50 dark:bg-stone-200 dark:text-stone-900",
  petitioner: "border-sky-500/25 bg-sky-500/10 text-sky-900 dark:text-sky-200",
  respondent: "border-violet-500/25 bg-violet-500/10 text-violet-900 dark:text-violet-200",
  clerk: "border-black/[0.06] bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-zinc-200",
};

function RoleAvatar({ role }: { role: SpeakerRole }) {
  if (role === "judge") {
    return (
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-stone-300/40 dark:border-white/15">
        <Image src="/courtroom/judge-avatar.svg" alt="" fill className="object-cover" sizes="32px" />
      </div>
    );
  }
  if (role === "petitioner" || role === "respondent") {
    return (
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-black/[0.06] dark:border-white/10">
        <Image src="/courtroom/advocate-avatar.svg" alt="" fill className="object-cover" sizes="32px" />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-slate-100 dark:border-white/10 dark:bg-white/[0.06]">
      <Gavel className="h-4 w-4 text-slate-500" strokeWidth={1.5} />
    </div>
  );
}

function RoleIcon({ role }: { role: SpeakerRole }) {
  if (role === "judge") return <Scale className="h-3 w-3" strokeWidth={1.75} />;
  if (role === "clerk") return <Gavel className="h-3 w-3" strokeWidth={1.75} />;
  return <User className="h-3 w-3" strokeWidth={1.75} />;
}

export function TranscriptPanel({
  entries,
  language = "en",
  isPaused = false,
  listeningMode = false,
  speakingEntryId = null,
  typingEntryId = null,
  typingCharCount = 0,
  readOnly = false,
  className,
}: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const readAloudEn = useReadAloud("en-IN");
  const readAloudHi = useReadAloud("hi-IN");
  const prevLengthRef = useRef(entries.length);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isPaused || readOnly) return;
    if (entries.length > prevLengthRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
    prevLengthRef.current = entries.length;
  }, [entries.length, isPaused, readOnly]);

  const speakLine = (entry: TranscriptEntry, lang: "en" | "hi") => {
    const { primary } = formatTranscriptLine(entry, lang === "hi" ? "hi" : "en");
    const controls = lang === "hi" ? readAloudHi : readAloudEn;
    void controls.toggle(`${entry.id}-${lang}`, primary);
  };

  const speakLang: "en" | "hi" = language === "hi" ? "hi" : "en";

  return (
    <section
      className={cn(
        "flex h-full min-h-[280px] max-h-[min(52vh,520px)] flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white/60 backdrop-blur-xl",
        "dark:border-white/[0.08] dark:bg-white/[0.035]",
        "cs-bench-elevated",
        isPaused && "border-amber-500/25",
        className,
      )}
    >
      <div className="shrink-0 border-b border-black/[0.05] px-4 py-3 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-300/30 bg-stone-800/90 text-stone-50 dark:bg-stone-200 dark:text-stone-900">
            <MessageSquare className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {readOnly ? "Hearing transcript" : "Live arguments"}
            </h2>
            <p className="text-[10px] text-muted-foreground">{entries.length} lines on record</p>
          </div>
          {isPaused && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-200">
              Paused — review conversation
            </span>
          )}
          {listeningMode && !readOnly && speakingEntryId && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-200">
              <Volume2 className="h-3 w-3 cs-live-dot" />
              Speaking
            </span>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {entries.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.25} />
            <p className="text-[12px] text-muted-foreground">
              Arguments will appear here when the hearing begins.
            </p>
          </div>
        )}
        <ul className="space-y-2.5">
          {entries.map((entry, index) => {
            const { primary, secondary } = formatTranscriptLine(entry, language);
            const isSpeaking = speakingEntryId === entry.id;
            const isTyping = typingEntryId === entry.id;
            const isLatest = index === entries.length - 1;
            const displayPrimary =
              isTyping && typingCharCount < primary.length
                ? primary.slice(0, typingCharCount)
                : primary;
            const displaySecondary =
              isTyping && secondary && typingCharCount >= primary.length
                ? secondary.slice(0, Math.max(0, typingCharCount - primary.length))
                : isTyping
                  ? ""
                  : secondary;
            return (
              <li
                key={entry.id}
                className={cn(
                  "rounded-xl border border-black/[0.05] bg-white/55 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]",
                  isSpeaking && "cs-speaking-ring border-stone-400/40 bg-stone-50/80 dark:bg-white/[0.06]",
                  isTyping && isLatest && "border-stone-400/30",
                )}
              >
                <div className="flex gap-2.5">
                  <RoleAvatar role={entry.role} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                          ROLE_BADGE[entry.role] ?? ROLE_BADGE.clerk,
                        )}
                      >
                        <RoleIcon role={entry.role} />
                        {entry.role}
                      </span>
                      <span className="text-[11px] font-medium">{entry.speaker}</span>
                      <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                        {String(Math.floor(entry.timestamp / 60)).padStart(2, "0")}:
                        {String(entry.timestamp % 60).padStart(2, "0")}
                      </span>
                      {!listeningMode && !readOnly && (
                        <button
                          type="button"
                          onClick={() => speakLine(entry, speakLang)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
                          title="Read aloud"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[12px] leading-relaxed text-foreground/90">
                      {displayPrimary}
                      {isTyping && typingCharCount < primary.length + (secondary?.length ?? 0) && (
                        <span className="ml-0.5 inline-block h-[14px] w-[2px] animate-pulse bg-stone-600 align-middle dark:bg-stone-300" />
                      )}
                    </p>
                    {displaySecondary && (
                      <p className="mt-1.5 border-t border-black/[0.04] pt-1.5 text-[12px] leading-relaxed text-muted-foreground dark:border-white/[0.06]">
                        {displaySecondary}
                        {isTyping &&
                          secondary &&
                          typingCharCount >= primary.length &&
                          typingCharCount < primary.length + secondary.length && (
                            <span className="ml-0.5 inline-block h-[14px] w-[2px] animate-pulse bg-stone-500 align-middle" />
                          )}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
