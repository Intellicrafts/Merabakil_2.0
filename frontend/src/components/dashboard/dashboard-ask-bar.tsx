"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";

import { setMeraVakilPrefill } from "@/lib/courtroom/session-store";
import { cn } from "@/lib/utils";

export const DASHBOARD_QUICK_ACTIONS = [
  {
    id: "fir",
    label: "FIR outline",
    prompt:
      "Draft a professional FIR outline under Indian criminal procedure: essential facts to record, sections likely attracted, documents to annex, and common defects that cause delay.",
  },
  {
    id: "bail",
    label: "Bail checklist",
    prompt:
      "Give a counsel-grade bail checklist for India: bailable vs non-bailable, statutory provisions, factors courts weigh, and a structured list of documents and arguments.",
  },
  {
    id: "limitation",
    label: "Limitation",
    prompt:
      "Explain the limitation period that typically applies to this matter under the Limitation Act, 1963, including when time starts, exclusions, and practical next steps.",
  },
  {
    id: "section",
    label: "Section explainer",
    prompt:
      "Explain the relevant statutory section in plain professional English: ingredients, burden of proof, leading Supreme Court interpretation, and how it applies on these facts.",
  },
  {
    id: "precedent",
    label: "Precedent hunt",
    prompt:
      "Identify the leading Indian authorities (Supreme Court and High Court) on this issue, with citation, holding, and why each is on-point or distinguishable.",
  },
] as const;

export function DashboardAskBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function openCounsel(text: string) {
    const trimmed = text.trim();
    if (trimmed) setMeraVakilPrefill(trimmed);
    router.push("/mera-vakil");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    openCounsel(query);
  }

  return (
    <section
      className="dash-ask-bar dash-card-in"
      style={{ animationDelay: "40ms" }}
      aria-labelledby="ask-bar-heading"
    >
      <h2 id="ask-bar-heading" className="sr-only">
        Ask Mera Vakil
      </h2>
        <form
        onSubmit={onSubmit}
        role="search"
        className="relative overflow-hidden rounded-3xl border border-black/[0.07] bg-white/70 p-3 shadow-[0_8px_32px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-white/[0.10] dark:bg-white/[0.04] sm:p-3.5"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px dash-shimmer-line" />
        <label htmlFor="dashboard-ask" className="sr-only">
          Ask Mera Vakil
        </label>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-black/[0.06] bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.08]">
            <Sparkles className="h-4 w-4 text-foreground/80" strokeWidth={1.75} />
          </span>
          <input
            id="dashboard-ask"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask Mera Vakil…"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-[15px] tracking-tight outline-none placeholder:text-muted-foreground/70"
          />
          <button
            type="submit"
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 text-[13px] font-semibold text-white shadow-sm",
              "transition-transform duration-150 hover:translate-x-px active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2",
              "dark:bg-white dark:text-slate-900",
            )}
          >
            <span className="hidden sm:inline">Ask</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Quick matter prompts">
        {DASHBOARD_QUICK_ACTIONS.map((action) => (
          <li key={action.id}>
            <button
              type="button"
              onClick={() => setQuery(action.prompt)}
              className={cn(
                "rounded-full border border-black/[0.06] bg-white/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground",
                "transition-colors hover:border-black/[0.10] hover:bg-white hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/35",
                "dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:border-white/[0.14] dark:hover:bg-white/[0.08]",
              )}
            >
              {action.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
