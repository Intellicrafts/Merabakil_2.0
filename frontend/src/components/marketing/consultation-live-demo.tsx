"use client";

import {
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck,
  MapPin,
  Scale,
  Sparkles,
  Star,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DemoCardShell } from "@/components/marketing/demo-card-shell";
import { cn } from "@/lib/utils";

type ConsultPhase = "brief" | "scanning" | "matched" | "booked" | "hold";

interface Advocate {
  name: string;
  city: string;
  area: string;
  rating: number;
  years: number;
  score: number;
}

const ALL_CANDIDATES: Advocate[] = [
  { name: "Rohan Mehta", city: "Mumbai", area: "Corporate", rating: 4.8, years: 18, score: 88 },
  { name: "Ananya Iyer", city: "Bengaluru", area: "IP & Corporate", rating: 4.7, years: 11, score: 90 },
  { name: "Vikram Nair", city: "Delhi", area: "Civil", rating: 4.6, years: 9, score: 92 },
  { name: "Priya Sharma", city: "Delhi", area: "Labour & Service", rating: 4.9, years: 14, score: 97 },
];

const WINNER = ALL_CANDIDATES[ALL_CANDIDATES.length - 1];

const SCAN_LABELS = [
  "Reading your preferences…",
  "Reviewing counsel profiles…",
  "Validating bar credentials…",
];

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

interface ConsultationLiveDemoProps {
  className?: string;
  active?: boolean;
  onComplete?: () => void;
  compact?: boolean;
}

export function ConsultationLiveDemo({
  className,
  active = true,
  onComplete,
  compact = false,
}: ConsultationLiveDemoProps) {
  const candidates = compact ? ALL_CANDIDATES.slice(-3) : ALL_CANDIDATES;
  const [phase, setPhase] = useState<ConsultPhase>("brief");
  const [scanIndex, setScanIndex] = useState(0);
  const [scanLabel, setScanLabel] = useState(SCAN_LABELS[0]);
  const [score, setScore] = useState(0);
  const doneRef = useRef(false);

  const contentHeight = compact
    ? "h-full"
    : "h-[250px] sm:h-[280px] md:h-[300px]";

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!active) return;

    if (reducedMotion) {
      setPhase("booked");
      setScore(WINNER.score);
      const t = setTimeout(() => onComplete?.(), 3200);
      return () => clearTimeout(t);
    }

    if (phase === "brief") {
      const t = setTimeout(() => setPhase("scanning"), 1100);
      return () => clearTimeout(t);
    }

    if (phase === "scanning") {
      let i = 0;
      let labelIdx = 0;
      const step = setInterval(() => {
        i = Math.min(candidates.length - 1, i + 1);
        setScanIndex(i);
      }, 560);
      const labels = setInterval(() => {
        labelIdx = (labelIdx + 1) % SCAN_LABELS.length;
        setScanLabel(SCAN_LABELS[labelIdx]);
      }, 780);
      const t = setTimeout(() => {
        clearInterval(step);
        clearInterval(labels);
        setScanIndex(candidates.length - 1);
        setPhase("matched");
      }, 2500);
      return () => {
        clearInterval(step);
        clearInterval(labels);
        clearTimeout(t);
      };
    }

    if (phase === "matched") {
      const start = performance.now();
      let raf = 0;
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / 900);
        setScore(Math.round(WINNER.score * p));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      const t = setTimeout(() => setPhase("booked"), 1200);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(t);
      };
    }

    if (phase === "booked") {
      const t = setTimeout(() => setPhase("hold"), 700);
      return () => clearTimeout(t);
    }

    if (phase === "hold") {
      const t = setTimeout(() => {
        if (!doneRef.current) {
          doneRef.current = true;
          onComplete?.();
        }
      }, 2600);
      return () => clearTimeout(t);
    }
  }, [phase, active, reducedMotion, onComplete, candidates.length]);

  const showMatch = phase === "matched" || phase === "booked" || phase === "hold";
  const showBooked = phase === "booked" || phase === "hold";

  const shellProps = compact
    ? { variant: "minimal" as const }
    : {
        variant: "full" as const,
        icon: <Scale className="h-4 w-4" />,
        title: "Legal Consultation",
        subtitle: "Verified advocates, matched by AI",
        footer: "Verified advocates · Transparent pricing · Book in minutes",
      };

  return (
    <DemoCardShell className={className} {...shellProps}>
      <div className={cn(compact ? "demo-compact-stage" : "space-y-3 sm:space-y-4")}>
        <div className={cn(contentHeight, "space-y-3 overflow-hidden")}>
          <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-md bg-gradient-to-br from-slate-800 to-slate-900 px-4 py-2.5 text-sm text-white demo-msg-in dark:from-slate-100 dark:to-slate-300 dark:text-slate-900">
            I need a labour-law advocate in Delhi.
          </div>

          {!showMatch ? (
            <div className="space-y-2.5 demo-msg-in">
              <div className="flex items-center gap-3">
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                  <div className="spinner-glow absolute inset-0 rounded-full bg-gradient-to-br from-slate-500/30 to-slate-700/30 blur-sm" />
                  <div className="spinner-ring absolute inset-0" />
                  <Sparkles className="relative h-3.5 w-3.5 spark-twinkle" />
                </div>
                <div className="demo-soft-bubble rounded-2xl px-4 py-2.5 text-xs text-muted-foreground">
                  <span className="demo-shimmer inline-block">{scanLabel}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                {candidates.map((adv, i) => {
                  const isActive = i === scanIndex;
                  return (
                    <div
                      key={adv.name}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-1.5 transition-all duration-300",
                        isActive ? "demo-soft-bubble opacity-100" : "opacity-40",
                      )}
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-[10px] font-semibold text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900">
                        {initials(adv.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold leading-tight">{adv.name}</p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {adv.city} · {adv.area}
                        </p>
                      </div>
                      {isActive && (
                        <span className="demo-scan-badge inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                          <BadgeCheck className="h-3 w-3" />
                          Verified
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 demo-msg-in">
              {!compact && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
                  Best match selected
                </p>
              )}
              <div className="demo-soft-bubble flex items-center gap-3 rounded-2xl p-3 sm:p-4">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-semibold text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900 sm:h-14 sm:w-14">
                  {initials(WINNER.name)}
                  <span className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-background text-emerald-600 ring-1 ring-black/[0.06] dark:text-emerald-400 dark:ring-white/10 sm:h-6 sm:w-6">
                    <BadgeCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold tracking-tight sm:text-[15px]">
                    Adv. {WINNER.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground sm:text-[12px]">
                    <MapPin className="h-3 w-3" /> {WINNER.city} · {WINNER.area}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground sm:text-[11px]">
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current text-amber-500" />
                      {WINNER.rating.toFixed(1)}
                    </span>
                    <span>{WINNER.years} yrs exp</span>
                  </div>
                </div>
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center sm:h-16 sm:w-16">
                  <div className="demo-match-ring absolute inset-0 rounded-full" />
                  <div className="absolute inset-[3px] rounded-full bg-background" />
                  <div className="relative text-center">
                    <p className="text-sm font-bold tabular-nums leading-none sm:text-base">{score}</p>
                    <p className="text-[7px] font-medium uppercase tracking-wider text-muted-foreground sm:text-[8px]">
                      match
                    </p>
                  </div>
                </div>
              </div>

              {showBooked && !compact && (
                <div className="demo-msg-in">
                  <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-2 text-[12px] font-semibold text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900 sm:text-[13px]">
                    Book consultation
                    <ArrowUpRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                  {!compact && (
                    <span className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
                      <CalendarCheck className="h-3.5 w-3.5" />
                      Available today
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {!compact && (
          <div className="demo-dock-mock flex items-center gap-2 px-1 py-2 sm:py-2.5">
            <div className="flex flex-1 flex-nowrap gap-1.5 overflow-hidden">
              {["Labour law", "Delhi", "Available today"].map((chip) => (
                <span
                  key={chip}
                  className="demo-soft-chip rounded-full px-2.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  {chip}
                </span>
              ))}
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white dark:from-slate-200 dark:to-slate-400 dark:text-slate-900">
              <Scale className="h-3.5 w-3.5" />
            </div>
          </div>
        )}
      </div>
    </DemoCardShell>
  );
}
