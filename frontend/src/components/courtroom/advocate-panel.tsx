"use client";

import Image from "next/image";

import type { SpeakerRole } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

interface AdvocatePanelProps {
  side: "petitioner" | "respondent";
  name: string;
  trait?: string;
  isSpeaking: boolean;
  isThinking?: boolean;
}

export function AdvocatePanel({
  side,
  name,
  trait,
  isSpeaking,
  isThinking,
}: AdvocatePanelProps) {
  const label = side === "petitioner" ? "Petitioner" : "Respondent";
  const align = side === "petitioner" ? "items-start text-left" : "items-end text-right";
  const listening = !isSpeaking && !isThinking;

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-xl transition-opacity duration-300",
        "dark:border-white/[0.08] dark:bg-white/[0.04]",
        "cs-stage-enter",
        align,
        isSpeaking && "cs-speaking-ring border-stone-400/40 z-[1]",
        isThinking && "cs-agent-think",
        listening && "opacity-55 cs-listen-glow",
      )}
    >
      <div
        className={cn(
          "relative mb-3 h-11 w-11 overflow-hidden rounded-xl border border-black/[0.06]",
          "dark:border-white/10",
          side === "respondent" && "self-end",
        )}
      >
        <Image src="/courtroom/advocate-avatar.svg" alt="" fill className="object-cover" sizes="44px" />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label} Advocate AI
      </p>
      <p className="mt-1 text-[13px] font-semibold tracking-tight">{name}</p>
      {trait && <p className="mt-0.5 text-[10px] text-muted-foreground">{trait}</p>}
      {listening && (
        <p className="mt-2 text-[11px] text-muted-foreground">Listening</p>
      )}
      {isThinking && (
        <p className="mt-2 text-[11px] font-medium text-amber-800 dark:text-amber-200">Preparing argument…</p>
      )}
      {isSpeaking && !isThinking && (
        <p className="mt-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
          <span className="cs-live-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Addressing the bench
        </p>
      )}
    </div>
  );
}

export function isAdvocateSpeaking(
  role: SpeakerRole | null,
  side: "petitioner" | "respondent",
): boolean {
  return role === side;
}
