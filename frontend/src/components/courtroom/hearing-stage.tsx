"use client";

import { CourtroomBench } from "@/components/courtroom/courtroom-bench";
import type { AgentPersona, JudgeState, SpeakerRole } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

interface HearingStageProps {
  petitionerName: string;
  respondentName: string;
  activeSpeaker: SpeakerRole | null;
  judgeState: JudgeState;
  judgeNote?: string;
  agents?: AgentPersona[];
  isThinking?: boolean;
  /** Show appearance / cause-list strip before or during hearing. */
  showAppearance?: boolean;
  matterTitle?: string;
  matterType?: string;
}

export function HearingStage({
  petitionerName,
  respondentName,
  activeSpeaker,
  judgeState,
  judgeNote,
  agents,
  isThinking,
  showAppearance = true,
  matterTitle,
  matterType,
}: HearingStageProps) {
  const judgeAgent = agents?.find((a) => a.role === "judge");
  const pAgent = agents?.find((a) => a.role === "petitioner_advocate");
  const rAgent = agents?.find((a) => a.role === "respondent_advocate");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-stone-300/35 bg-gradient-to-b from-stone-100/80 via-white/50 to-stone-50/70 p-3 sm:p-4",
        "dark:border-white/12 dark:from-white/[0.07] dark:via-white/[0.03] dark:to-transparent",
        "cs-bench-elevated cs-card-in",
      )}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px cs-shimmer-line" />
      <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Live hearing stage
      </p>

      {showAppearance && (
        <div className="mb-3 rounded-xl border border-stone-300/35 bg-white/70 px-3 py-2 text-[11px] dark:border-white/10 dark:bg-white/[0.04]">
          <p className="font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Appearance
          </p>
          <div className="mt-1.5 grid gap-1 sm:grid-cols-3">
            <p>
              <span className="text-muted-foreground">Bench — </span>
              {judgeAgent?.displayName || "Hon'ble AI Judge"}
            </p>
            <p>
              <span className="text-muted-foreground">For petitioner — </span>
              {pAgent?.displayName || petitionerName}
            </p>
            <p>
              <span className="text-muted-foreground">For respondent — </span>
              {rAgent?.displayName || respondentName}
            </p>
          </div>
          {(matterTitle || matterType) && (
            <p className="mt-1 text-muted-foreground">
              {matterType ? `${matterType} · ` : ""}
              {matterTitle}
            </p>
          )}
        </div>
      )}

      <CourtroomBench
        petitionerName={petitionerName}
        respondentName={respondentName}
        activeSpeaker={activeSpeaker}
        judgeState={judgeState}
        judgeNote={judgeNote}
        agents={agents}
        isThinking={isThinking}
      />
      <div className="mt-3 flex justify-center gap-3 text-[10px] text-muted-foreground">
        <span className={cn(activeSpeaker === "petitioner" ? "font-semibold text-sky-800 dark:text-sky-200" : "opacity-50")}>
          Petitioner {activeSpeaker === "petitioner" ? "speaking" : "listening"}
        </span>
        <span aria-hidden>·</span>
        <span className={cn(activeSpeaker === "judge" ? "font-semibold text-stone-800 dark:text-stone-200" : "opacity-50")}>
          Bench {activeSpeaker === "judge" ? "intervening" : "presiding"}
        </span>
        <span aria-hidden>·</span>
        <span className={cn(activeSpeaker === "respondent" ? "font-semibold text-violet-800 dark:text-violet-200" : "opacity-50")}>
          Respondent {activeSpeaker === "respondent" ? "speaking" : "listening"}
        </span>
      </div>
    </div>
  );
}
