"use client";

import Image from "next/image";

import type { AgentPersona } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

interface AgentPersonaCardProps {
  persona: AgentPersona;
  compact?: boolean;
  isThinking?: boolean;
}

export function AgentPersonaCard({ persona, compact, isThinking }: AgentPersonaCardProps) {
  const avatarSrc =
    persona.avatar === "judge" ? "/courtroom/judge-avatar.svg" : "/courtroom/advocate-avatar.svg";

  return (
    <article
      className={cn(
        "rounded-xl border border-black/[0.06] bg-white/55 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]",
        "cs-stage-enter",
        isThinking && "cs-agent-think",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl">
          <Image src={avatarSrc} alt="" fill className="object-cover" sizes="44px" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold leading-tight">{persona.displayName}</p>
          <p className="text-[10px] text-muted-foreground">{persona.title}</p>
          <p className="mt-1 text-[10px] italic text-muted-foreground">{persona.tone}</p>
        </div>
      </div>
      {!compact && (
        <>
          <div className="mt-2.5 flex flex-wrap gap-1">
            {persona.traits.map((t) => (
              <span
                key={t}
                className="rounded-full border border-black/[0.05] bg-white/60 px-2 py-0.5 text-[9px] font-medium dark:border-white/[0.08] dark:bg-white/[0.04]"
              >
                {t}
              </span>
            ))}
          </div>
          <ul className="mt-2 space-y-0.5">
            {persona.strategy.slice(0, 3).map((s) => (
              <li key={s} className="text-[10px] leading-snug text-foreground/80">
                · {s}
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
