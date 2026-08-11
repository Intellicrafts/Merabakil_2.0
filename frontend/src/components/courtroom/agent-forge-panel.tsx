"use client";

import { Sparkles } from "lucide-react";

import { AgentPersonaCard } from "@/components/courtroom/agent-persona-card";
import type { AgentPersona } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

interface AgentForgePanelProps {
  agents: AgentPersona[];
  intakeSummary?: string;
}

export function AgentForgePanel({ agents, intakeSummary }: AgentForgePanelProps) {
  return (
    <section
      className={cn(
        "space-y-4 rounded-2xl border border-stone-300/40 bg-gradient-to-b from-stone-50/80 to-white/60 p-4 backdrop-blur-xl sm:p-5",
        "dark:border-white/12 dark:from-white/[0.06] dark:to-white/[0.02]",
        "cs-bench-elevated cs-card-in",
      )}
    >
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 text-amber-700 dark:text-amber-300" />
        <div>
          <h2 className="text-[14px] font-semibold">Simulation agents ready</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {intakeSummary || "Personas forged from your case intake. Start the hearing when ready."}
          </p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {agents.map((agent) => (
          <AgentPersonaCard key={agent.id} persona={agent} />
        ))}
      </div>
    </section>
  );
}
