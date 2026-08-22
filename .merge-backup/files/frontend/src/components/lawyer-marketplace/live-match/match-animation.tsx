"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  MapPin,
  Scale,
  Sparkles,
  Star,
} from "lucide-react";

import type { MatchResult, RankedLawyer } from "@/lib/marketplace-store";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  return name
    .replace(/^Adv\.\s*/i, "")
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

type Phase = "reading" | "scanning" | "validating" | "selected";

const TRUST_CHECKS = [
  { icon: BadgeCheck, label: "Bar ID verified" },
  { icon: MapPin, label: "Jurisdiction alignment" },
  { icon: Scale, label: "Experience fit" },
  { icon: Star, label: "Client rating check" },
];

const PHASE_LABELS: Record<Phase, string> = {
  reading: "Reading your preferences…",
  scanning: "Reviewing counsel profiles…",
  validating: "Validating credentials…",
  selected: "Best match selected",
};

/** Steady timeline (ms) — no random spin */
const T_READ = 700;
const T_STEP = 420;
const SCAN_STEPS = 5;
const T_SCAN_END = T_READ + SCAN_STEPS * T_STEP;
const T_VALIDATE_END = T_SCAN_END + 1100;
const T_SCORE_END = T_VALIDATE_END + 900;
const T_BOOK_IN = T_VALIDATE_END + 500;

interface MatchAnimationProps {
  result: MatchResult;
  onComplete: () => void;
  onBook: () => void;
}

export function MatchAnimation({ result, onComplete, onBook }: MatchAnimationProps) {
  const [elapsed, setElapsed] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [showBook, setShowBook] = useState(false);
  const doneRef = useRef(false);
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Sequence ends with winner; scanning steps through candidates first */
  const sequence = useMemo(() => {
    const others: RankedLawyer[] = [...result.runnersUp];
    const steps = others.slice(0, SCAN_STEPS);
    return [...steps, result.lawyer];
  }, [result]);

  const winnerIndex = sequence.length - 1;

  useEffect(() => {
    doneRef.current = false;
    setShowBook(false);
    setDisplayScore(0);

    if (reducedMotion) {
      setDisplayScore(result.lawyer.match_score);
      setShowBook(true);
      return;
    }

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = now - start;
      setElapsed(t);

      if (t >= T_VALIDATE_END) {
        const p = Math.min(1, (t - T_VALIDATE_END) / (T_SCORE_END - T_VALIDATE_END));
        setDisplayScore(Math.round(result.lawyer.match_score * p));
      }
      if (t >= T_BOOK_IN) setShowBook(true);
      if (t >= T_SCORE_END) setDisplayScore(result.lawyer.match_score);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion, result.lawyer.match_score]);

  const phase: Phase =
    elapsed < T_READ
      ? "reading"
      : elapsed < T_SCAN_END
        ? "scanning"
        : elapsed < T_VALIDATE_END
          ? "validating"
          : "selected";

  const activeIndex =
    phase === "reading"
      ? 0
      : phase === "scanning"
        ? Math.min(
            winnerIndex - 1,
            Math.floor((elapsed - T_READ) / T_STEP),
          )
        : winnerIndex;

  const checksVisible = phase === "validating" || phase === "selected";
  const isSelected = phase === "selected";

  function handleBook() {
    onBook();
    if (!doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  }

  function handleContinue() {
    if (!doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 md:p-8",
        "border border-black/[0.06] bg-gradient-to-br from-slate-100 via-white to-slate-50",
        "text-foreground",
        "dark:border-white/[0.08] dark:from-zinc-950 dark:via-zinc-900 dark:to-black",
      )}
      role="status"
      aria-live="polite"
      aria-busy={!isSelected}
    >
      <div className="pointer-events-none absolute -right-16 top-0 h-48 w-48 rounded-full bg-slate-400/15 blur-3xl dark:bg-white/5" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px mp-shimmer-line" />

      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-slate-700 dark:text-slate-200" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            AI matching engine
          </span>
        </div>
        <span className="text-[12px] font-medium text-muted-foreground">
          {PHASE_LABELS[phase]}
        </span>
      </div>

      {/* Step indicators */}
      <div className="relative mb-6 flex gap-1.5">
        {(["reading", "scanning", "validating", "selected"] as Phase[]).map((p, i) => {
          const order: Phase[] = ["reading", "scanning", "validating", "selected"];
          const current = order.indexOf(phase);
          const done = i < current || (i === current && p === "selected");
          const active = i === current;
          return (
            <div
              key={p}
              className={cn(
                "h-1 flex-1 rounded-full transition-all duration-500",
                done || active
                  ? "bg-slate-800 dark:bg-slate-200"
                  : "bg-black/[0.08] dark:bg-white/10",
                active && !done && "opacity-80",
              )}
            />
          );
        })}
      </div>

      {/* Controlled 3D coverflow — one card at a time */}
      <div className="mp-coverflow relative mx-auto mb-6 h-[200px] w-full max-w-md md:h-[220px]">
        <div className="pointer-events-none absolute inset-x-10 bottom-0 h-6 rounded-[100%] bg-black/10 blur-lg dark:bg-black/50" />
        {sequence.map((lawyer, i) => {
          const offset = i - activeIndex;
          const abs = Math.abs(offset);
          if (abs > 2) return null;

          const isCenter = offset === 0;
          const isWinnerCard = isSelected && i === winnerIndex;

          return (
            <div
              key={`${lawyer.id}-${i}`}
              className={cn(
                "mp-cover-card absolute left-1/2 top-1/2 w-[150px] md:w-[168px]",
                isWinnerCard && "mp-3d-winner z-30",
              )}
              style={{
                transform: `
                  translate(-50%, -50%)
                  translateX(${offset * 72}px)
                  translateZ(${isCenter ? 40 : -abs * 60}px)
                  rotateY(${offset * -28}deg)
                  scale(${isCenter ? (isWinnerCard ? 1.08 : 1) : 0.82 - abs * 0.04})
                `,
                opacity: abs > 1 ? 0.35 : isCenter ? 1 : 0.55,
                zIndex: isWinnerCard ? 30 : 10 - abs,
                transition:
                  "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease",
              }}
            >
              <div
                className={cn(
                  "flex h-[176px] flex-col items-center justify-between rounded-2xl border p-4 backdrop-blur-xl",
                  "bg-white/95 shadow-[0_12px_36px_rgba(15,23,42,0.12)]",
                  "dark:bg-white/[0.09] dark:shadow-[0_12px_36px_rgba(0,0,0,0.45)]",
                  "border-black/[0.08] dark:border-white/15",
                  isCenter && "border-slate-300/80 dark:border-white/25",
                  isWinnerCard &&
                    "border-slate-500/40 ring-2 ring-slate-400/25 dark:border-white/35 dark:ring-white/20",
                )}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-semibold text-white shadow-md dark:from-slate-100 dark:to-slate-300 dark:text-slate-900">
                  {initials(lawyer.full_name)}
                </div>
                <div className="w-full text-center">
                  <p className="truncate text-[13px] font-semibold tracking-tight">
                    {lawyer.full_name.replace(/^Adv\.\s*/i, "")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{lawyer.city}</p>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Star className="h-3 w-3 fill-current text-amber-500" />
                  {lawyer.rating.toFixed(1)}
                  {lawyer.verified && (
                    <BadgeCheck className="ml-0.5 h-3.5 w-3.5 text-slate-700 dark:text-slate-300" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust checklist */}
      <ul className="mb-5 grid gap-2 sm:grid-cols-2">
        {TRUST_CHECKS.map(({ icon: Icon, label }, idx) => {
          const show = checksVisible && elapsed >= T_SCAN_END + idx * 220;
          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[12px] transition-all duration-300",
                "border-black/[0.06] bg-white/70 dark:border-white/10 dark:bg-white/[0.04]",
                show ? "mp-trust-check opacity-100" : "opacity-30",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full",
                  show
                    ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                    : "bg-black/[0.05] text-muted-foreground dark:bg-white/10",
                )}
              >
                {show ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </span>
              {label}
            </li>
          );
        })}
      </ul>

      {/* Selected reveal */}
      <div
        className={cn(
          "flex flex-col items-center gap-4 transition-all duration-500",
          isSelected ? "opacity-100 translate-y-0" : "opacity-40 translate-y-2",
        )}
      >
        <div className="relative flex h-20 w-20 items-center justify-center">
          <div className="mp-match-ring absolute inset-0 rounded-full opacity-90" />
          <div className="absolute inset-[3px] rounded-full bg-white dark:bg-zinc-950" />
          <div className="relative text-center">
            <p className="text-xl font-bold tabular-nums">{displayScore}</p>
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              match
            </p>
          </div>
        </div>

        {isSelected && (
          <div className="mp-select-reveal space-y-1 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
              Selected for you
            </p>
            <p className="text-sm font-semibold tracking-tight">{result.lawyer.full_name}</p>
            <p className="text-[12px] text-muted-foreground">
              AI chose this counsel as the best fit for your preferences
            </p>
          </div>
        )}

        <div
          className={cn(
            "flex w-full max-w-sm flex-col gap-2 transition-all duration-500 sm:flex-row",
            showBook
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none translate-y-3 opacity-0",
          )}
        >
          <button
            type="button"
            onClick={handleBook}
            className="mp-btn-accent min-h-11 flex-1 rounded-full text-[13px] font-semibold"
          >
            Book consultation
            <ArrowUpRight className="ml-1.5 inline h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="mp-btn-soft min-h-11 flex-1 rounded-full text-[13px] font-semibold"
          >
            View match details
          </button>
        </div>
      </div>
    </div>
  );
}
