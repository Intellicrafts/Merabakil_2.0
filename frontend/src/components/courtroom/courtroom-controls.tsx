"use client";

import { Gavel, Hammer, Pause, Play, Scale, Square } from "lucide-react";

import type { CourtroomPhase } from "@/lib/courtroom/types";

interface CourtroomControlsProps {
  phase: CourtroomPhase;
  isPaused: boolean;
  canStart: boolean;
  canBuildAgents?: boolean;
  judgmentReady?: boolean;
  judgmentRevealed?: boolean;
  onBuildAgents?: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEndArguments: () => void;
  onViewJudgment?: () => void;
  onNewSession: () => void;
}

export function CourtroomControls({
  phase,
  isPaused,
  canStart,
  canBuildAgents,
  judgmentReady,
  judgmentRevealed,
  onBuildAgents,
  onStart,
  onPause,
  onResume,
  onEndArguments,
  onViewJudgment,
  onNewSession,
}: CourtroomControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(phase === "setup" || phase === "agentsReady") && onBuildAgents && phase === "setup" && (
        <button
          type="button"
          disabled={!canBuildAgents}
          onClick={onBuildAgents}
          className="cs-btn-soft h-10 rounded-xl px-4 text-[13px] font-semibold"
        >
          <Hammer className="h-4 w-4" />
          Build simulation agents
        </button>
      )}

      {(phase === "setup" || phase === "agentsReady") && (
        <button
          type="button"
          disabled={!canStart}
          onClick={onStart}
          className="cs-btn-accent h-10 rounded-xl px-4 text-[13px] font-semibold"
        >
          <Gavel className="h-4 w-4" />
          Start hearing
        </button>
      )}

      {phase === "hearing" && (
        <>
          {isPaused ? (
            <button
              type="button"
              onClick={onResume}
              className="cs-btn-accent h-10 rounded-xl px-4 text-[13px] font-semibold"
            >
              <Play className="h-4 w-4" />
              Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={onPause}
              className="cs-btn-soft h-10 rounded-xl px-4 text-[13px] font-semibold"
            >
              <Pause className="h-4 w-4" />
              Pause
            </button>
          )}
          <button
            type="button"
            onClick={onEndArguments}
            className="cs-btn-soft h-10 rounded-xl px-4 text-[13px] font-semibold"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            End arguments
          </button>
        </>
      )}

      {phase === "deliberation" && !judgmentRevealed && onViewJudgment && (
        <button
          type="button"
          disabled={!judgmentReady}
          onClick={onViewJudgment}
          className="cs-btn-accent h-10 rounded-xl px-4 text-[13px] font-semibold"
        >
          <Scale className="h-4 w-4" />
          View final judgment
        </button>
      )}

      {(phase === "judgment" || (phase === "deliberation" && judgmentRevealed)) && (
        <button
          type="button"
          onClick={onNewSession}
          className="cs-btn-soft h-10 rounded-xl px-4 text-[13px] font-semibold"
        >
          New session
        </button>
      )}
    </div>
  );
}
