"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, AudioLines, Sparkles } from "lucide-react";

import { isVoiceBotSupported } from "@/hooks/use-voice-bot";
import { FEATURES } from "@/lib/features";
import { markNavigationStart } from "@/lib/navigation-feedback";
import { setMeraVakilPrefill, setMeraVakilVoiceOpen } from "@/lib/prefill-store";
import { cn } from "@/lib/utils";

export function DashboardAskBar({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [voiceReady, setVoiceReady] = useState(false);

  useEffect(() => {
    setVoiceReady(FEATURES.VOICE && isVoiceBotSupported());
  }, []);

  function goToSaarthi(opts?: { voice?: boolean }) {
    const trimmed = query.trim();
    if (trimmed) setMeraVakilPrefill(trimmed);
    if (opts?.voice) setMeraVakilVoiceOpen();
    markNavigationStart();
    router.push("/mera-vakil");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    goToSaarthi();
  }

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className={cn("dash-ask-bar w-full min-w-0", className)}
      aria-labelledby="ask-bar-heading"
    >
      <h2 id="ask-bar-heading" className="sr-only">
        Ask Saarthi
      </h2>
      <label htmlFor="dashboard-ask" className="sr-only">
        Ask Saarthi
      </label>

      <div className="dash-ask-shell">
        <div className="dash-ask-input-row">
          <span className="dash-ask-icon" aria-hidden>
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <input
            id="dashboard-ask"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask Saarthi…"
            autoComplete="off"
            enterKeyHint="search"
            className="dash-ask-input"
          />
        </div>

        <div className="dash-ask-actions">
          {voiceReady ? (
            <button
              type="button"
              onClick={() => goToSaarthi({ voice: true })}
              aria-label="Start voice mode"
              title="Voice mode"
              className="dash-ask-btn dash-ask-btn-secondary"
            >
              <AudioLines className="h-4 w-4 shrink-0" strokeWidth={1.85} />
              <span>Voice</span>
            </button>
          ) : null}
          <button type="submit" className="dash-ask-btn dash-ask-btn-primary">
            <span>Ask</span>
            <ArrowUpRight className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </form>
  );
}
