"use client";

import Image from "next/image";
import { Scale } from "lucide-react";

import type { JudgeState } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

interface JudgePanelProps {
  isSpeaking: boolean;
  isThinking?: boolean;
  judgeState: JudgeState;
  judgeNote?: string;
  displayName?: string;
}

const STATE_LABELS: Record<JudgeState, string> = {
  listening: "Listening",
  questioning: "Questioning",
  deliberating: "Deliberating",
  ruling: "Ruling",
};

export function JudgePanel({
  isSpeaking,
  isThinking,
  judgeState,
  judgeNote,
  displayName = "Hon'ble AI Judge",
}: JudgePanelProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center rounded-2xl border border-stone-300/40 bg-gradient-to-b from-stone-100/90 to-white/70 p-4 text-center backdrop-blur-xl",
        "dark:border-white/15 dark:from-white/[0.08] dark:to-white/[0.03]",
        "cs-bench-elevated cs-stage-enter",
        isSpeaking && "cs-speaking-ring",
        isThinking && "cs-agent-think",
      )}
    >
      <div className="relative mb-3 h-14 w-14 overflow-hidden rounded-2xl border border-stone-300/50 shadow-md dark:border-white/15">
        <Image src="/courtroom/judge-avatar.svg" alt="" fill className="object-cover" sizes="56px" />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {displayName}
      </p>
      <span
        className={cn(
          "mt-2 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize",
          judgeState === "deliberating" || judgeState === "ruling"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
            : "border-stone-300/60 bg-white/70 text-stone-700 dark:border-white/15 dark:bg-white/10 dark:text-zinc-200",
        )}
      >
        {isSpeaking && <span className="cs-live-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />}
        {isThinking ? "Thinking…" : STATE_LABELS[judgeState]}
      </span>
      {judgeNote && (
        <p className="mt-3 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">{judgeNote}</p>
      )}
      {!isSpeaking && !isThinking && (
        <Scale className="absolute right-3 top-3 h-4 w-4 text-stone-400/50" strokeWidth={1.5} />
      )}
    </div>
  );
}
