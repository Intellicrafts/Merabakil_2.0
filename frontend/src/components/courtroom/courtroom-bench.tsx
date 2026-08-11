"use client";

import { JudgePanel } from "@/components/courtroom/judge-panel";
import { AdvocatePanel } from "@/components/courtroom/advocate-panel";
import { CourtroomStageBackdrop } from "@/components/courtroom/courtroom-stage-backdrop";
import { agentForSpeaker } from "@/lib/courtroom/agent-profiles";
import type { AgentPersona, JudgeState, SpeakerRole } from "@/lib/courtroom/types";

interface CourtroomBenchProps {
  petitionerName: string;
  respondentName: string;
  activeSpeaker: SpeakerRole | null;
  judgeState: JudgeState;
  judgeNote?: string;
  agents?: AgentPersona[];
  isThinking?: boolean;
}

export function CourtroomBench({
  petitionerName,
  respondentName,
  activeSpeaker,
  judgeState,
  judgeNote,
  agents,
  isThinking,
}: CourtroomBenchProps) {
  const judgeAgent = agentForSpeaker(agents, "judge");
  const petAgent = agentForSpeaker(agents, "petitioner");
  const resAgent = agentForSpeaker(agents, "respondent");

  return (
    <div className="relative overflow-hidden rounded-2xl border border-black/[0.06] p-3 dark:border-white/[0.08] sm:p-4">
      <CourtroomStageBackdrop />
      <div className="relative grid gap-3 lg:grid-cols-[1fr_1.15fr_1fr] lg:items-end">
        <AdvocatePanel
          side="petitioner"
          name={petAgent?.displayName ?? petitionerName}
          trait={petAgent?.traits[0]}
          isSpeaking={activeSpeaker === "petitioner"}
          isThinking={isThinking && activeSpeaker === "petitioner"}
        />
        <JudgePanel
          isSpeaking={activeSpeaker === "judge"}
          isThinking={isThinking && activeSpeaker === "judge"}
          judgeState={judgeState}
          judgeNote={judgeNote}
          displayName={judgeAgent?.displayName}
        />
        <AdvocatePanel
          side="respondent"
          name={resAgent?.displayName ?? respondentName}
          trait={resAgent?.traits[0]}
          isSpeaking={activeSpeaker === "respondent"}
          isThinking={isThinking && activeSpeaker === "respondent"}
        />
      </div>
    </div>
  );
}
