"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";

import { MatchAnimation } from "@/components/lawyer-marketplace/live-match/match-animation";
import { MatchPreferencesForm } from "@/components/lawyer-marketplace/live-match/match-preferences-form";
import { MatchResultCard } from "@/components/lawyer-marketplace/live-match/match-result-card";
import { getStoredUser } from "@/lib/api";
import {
  DEFAULT_MATCH_PREFERENCES,
  findBestMatch,
  loadMatchHistory,
  loadMatchPreferences,
  saveMatchPreferences,
  saveMatchToHistory,
  type MatchPreferences,
  type MatchResult,
  type RankedLawyer,
} from "@/lib/marketplace-store";
import type { AuthUser } from "@/lib/types";
import { cn } from "@/lib/utils";

type PanelPhase = "idle" | "matching" | "result";

interface LiveMatchPanelProps {
  catalog: RankedLawyer[];
  onView: (lawyer: RankedLawyer) => void;
  onBook: (lawyer: RankedLawyer) => void;
}

export function LiveMatchPanel({ catalog, onView, onBook }: LiveMatchPanelProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [prefs, setPrefs] = useState<MatchPreferences>(DEFAULT_MATCH_PREFERENCES);
  const [phase, setPhase] = useState<PanelPhase>("idle");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [pendingResult, setPendingResult] = useState<MatchResult | null>(null);
  const [history, setHistory] = useState<MatchResult[]>([]);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  /** Collapsed by default — expands for matching/result or when user opens it. */
  const [expanded, setExpanded] = useState(false);
  const pendingRef = useRef<MatchResult | null>(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  useEffect(() => {
    setUser(getStoredUser());
    setPrefs(loadMatchPreferences());
    const hist = loadMatchHistory();
    setHistory(hist);
    if (hist[0]) setResult(hist[0]);
    setHydrated(true);
  }, []);

  function handlePrefsChange(next: MatchPreferences) {
    setPrefs(next);
    saveMatchPreferences(next);
  }

  const startMatch = useCallback(() => {
    setLocationError(null);
    const currentPrefs = prefsRef.current;
    const match = findBestMatch(currentPrefs, catalog);
    if (!match) {
      setLocationError("No counsel matched. Try adjusting preferences.");
      setExpanded(true);
      return;
    }
    saveMatchPreferences(currentPrefs);
    pendingRef.current = match;
    setPendingResult(match);
    setPhase("matching");
    setExpanded(true);
  }, [catalog]);

  const commitResult = useCallback((match: MatchResult) => {
    const hist = saveMatchToHistory(match);
    setHistory(hist);
    setResult(match);
    setPendingResult(null);
    pendingRef.current = null;
    setPhase("result");
    setExpanded(true);
  }, []);

  const handleAnimationComplete = useCallback(() => {
    if (pendingRef.current) {
      commitResult(pendingRef.current);
      return;
    }
    setPendingResult(null);
    setPhase("result");
    setExpanded(true);
  }, [commitResult]);

  const handleAnimationBook = useCallback(() => {
    const match = pendingRef.current;
    if (match) {
      onBook(match.lawyer);
    }
  }, [onBook]);

  function viewLastMatch() {
    const last = history[0] ?? result;
    if (!last) return;
    setResult(last);
    setPhase("result");
    setExpanded(true);
  }

  function selectHistory(match: MatchResult) {
    setResult(match);
    setPhase("result");
    setExpanded(true);
  }

  const forceOpen = phase === "matching" || phase === "result";
  const isOpen = expanded || forceOpen;

  if (!hydrated) {
    return (
      <div className="h-14 animate-pulse rounded-2xl border border-black/[0.06] bg-white/40 dark:border-white/[0.08] dark:bg-white/[0.03]" />
    );
  }

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/55 shadow-[0_10px_32px_rgba(15,23,42,0.05)] backdrop-blur-xl",
        "dark:border-white/[0.08] dark:bg-white/[0.035] md:rounded-3xl",
      )}
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-slate-400/10 blur-3xl mp-hero-glow" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px mp-shimmer-line" />

      <button
        type="button"
        onClick={() => {
          if (forceOpen && phase !== "idle") return;
          setExpanded((v) => !v);
        }}
        className="relative flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left md:px-5"
        aria-expanded={isOpen}
      >
        <div className="min-w-0 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/[0.06] bg-white/80 dark:border-white/10 dark:bg-white/[0.06]">
            <Sparkles className="h-4 w-4 text-slate-600 dark:text-slate-300" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold tracking-tight">Live AI Match</p>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                <span className="mp-pulse-dot h-1 w-1 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {phase === "matching"
                ? "Finding your best counsel…"
                : phase === "result" && result
                  ? `Matched · ${result.lawyer.full_name}`
                  : "Tell us what you need — collapsed until you open"}
            </p>
          </div>
        </div>
        {!forceOpen && (
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        )}
      </button>

      {isOpen && (
        <div className="relative border-t border-black/[0.05] px-4 pb-4 pt-3 dark:border-white/[0.06] md:px-5 md:pb-5">
          {phase === "idle" && (
            <MatchPreferencesForm
              value={prefs}
              onChange={handlePrefsChange}
              hasPriorMatch={Boolean(result || history[0])}
              history={history}
              onFindMatch={startMatch}
              onViewLastMatch={viewLastMatch}
              onSelectHistory={selectHistory}
              onBookHistory={(m) => onBook(m.lawyer)}
              locationError={locationError}
              onLocationError={setLocationError}
            />
          )}

          {phase === "matching" && pendingResult && (
            <MatchAnimation
              result={pendingResult}
              onComplete={handleAnimationComplete}
              onBook={handleAnimationBook}
            />
          )}

          {phase === "result" && result && (
            <MatchResultCard
              user={user}
              result={result}
              onBook={() => onBook(result.lawyer)}
              onView={() => onView(result.lawyer)}
              onRematch={startMatch}
              onEditPreferences={() => {
                setPhase("idle");
                setExpanded(true);
              }}
            />
          )}
        </div>
      )}
    </section>
  );
}
