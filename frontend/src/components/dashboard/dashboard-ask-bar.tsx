"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";

import { setMeraVakilPrefill } from "@/lib/courtroom/session-store";
import { cn } from "@/lib/utils";

export function DashboardAskBar({ className }: { className?: string }) {
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
    <form
      onSubmit={onSubmit}
      role="search"
      className={cn("dash-ask-bar", className)}
      aria-labelledby="ask-bar-heading"
    >
      <h2 id="ask-bar-heading" className="sr-only">
        Ask Saarthi
      </h2>
      <label htmlFor="dashboard-ask" className="sr-only">
        Ask Saarthi
      </label>
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border border-black/[0.07] bg-white/80 p-1.5 pl-3 shadow-[0_8px_28px_rgba(15,23,42,0.05)]",
          "backdrop-blur-xl dark:border-white/[0.10] dark:bg-white/[0.06] sm:gap-3 sm:rounded-[1.25rem] sm:p-2 sm:pl-3.5",
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/15 sm:h-10 sm:w-10 sm:rounded-2xl">
          <Sparkles className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <input
          id="dashboard-ask"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask Saarthi…"
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 bg-transparent text-[15px] tracking-tight outline-none placeholder:text-muted-foreground/70 sm:min-h-10"
        />
        <button
          type="submit"
          className={cn(
            "inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-sm",
            "transition-transform duration-150 hover:brightness-110 active:scale-[0.97]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
            "sm:h-10 sm:px-4",
          )}
        >
          <span className="hidden sm:inline">Ask</span>
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
