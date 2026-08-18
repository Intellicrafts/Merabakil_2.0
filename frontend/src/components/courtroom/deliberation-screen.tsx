"use client";

import { useState } from "react";
import { Scale, ScrollText } from "lucide-react";

import { CourtroomBench } from "@/components/courtroom/courtroom-bench";
import { TranscriptPanel } from "@/components/courtroom/transcript-panel";
import type { AgentPersona, CourtroomState, TranscriptLanguage } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

interface DeliberationScreenProps {
  petitionerName: string;
  respondentName: string;
  agents?: AgentPersona[];
  state: CourtroomState;
  displayLanguage: TranscriptLanguage;
  judgmentReady: boolean;
  onViewJudgment: () => void;
  onReviewTranscript?: () => void;
}

export function DeliberationScreen({
  petitionerName,
  respondentName,
  agents,
  state,
  displayLanguage,
  judgmentReady,
  onViewJudgment,
  onReviewTranscript,
}: DeliberationScreenProps) {
  const [viewMode, setViewMode] = useState<"chat" | "order_sheet">("order_sheet");

  return (
    <div className="space-y-4">
      <CourtroomBench
        petitionerName={petitionerName}
        respondentName={respondentName}
        activeSpeaker={null}
        judgeState="deliberating"
        judgeNote={state.judgeNote ?? "Reviewing exhibits and authorities"}
        agents={agents}
      />

      <div
        className={cn(
          "rounded-2xl border border-dashed border-stone-300/50 bg-stone-50/50 px-4 py-8 text-center",
          "dark:border-white/12 dark:bg-white/[0.02] cs-card-in",
        )}
      >
        <p className="text-[14px] font-semibold">Court in deliberation</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {judgmentReady
            ? "The Hon'ble AI Judge has prepared the simulated judgment."
            : "The Hon'ble AI Judge is preparing the simulated judgment…"}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {onReviewTranscript && (
            <button
              type="button"
              onClick={onReviewTranscript}
              className="cs-btn-soft h-10 rounded-xl px-4 text-[13px] font-semibold"
            >
              <ScrollText className="h-4 w-4" />
              Review transcript
            </button>
          )}
          <button
            type="button"
            disabled={!judgmentReady}
            onClick={onViewJudgment}
            className="cs-btn-accent h-10 rounded-xl px-4 text-[13px] font-semibold"
          >
            <Scale className="h-4 w-4" />
            View final judgment
          </button>
        </div>
      </div>

      <div id="deliberation-transcript">
        <TranscriptPanel
          entries={state.transcript}
          language={displayLanguage}
          readOnly
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>
    </div>
  );
}
