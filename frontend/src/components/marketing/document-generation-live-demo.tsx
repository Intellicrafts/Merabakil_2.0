"use client";

import {
  Check,
  Download,
  FileText,
  PenLine,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DemoCardShell } from "@/components/marketing/demo-card-shell";
import { cn } from "@/lib/utils";

type DocPhase = "prompt" | "generating" | "reveal" | "ready" | "hold";

const PROMPT_TEXT =
  "Draft a legal notice for recovery of unpaid dues under the Indian Contract Act.";

const GEN_LABELS = [
  "Structuring the notice…",
  "Drafting clauses…",
  "Applying Indian legal format…",
  "Finalising citations…",
];

const CLAUSES = [
  "That my client supplied goods/services to you vide invoice dated 12.03.2026, for a sum of Rs. 4,50,000/-.",
  "That despite repeated reminders, you have failed and neglected to clear the outstanding dues.",
  "You are hereby called upon to pay the said amount within 15 days of receipt of this notice.",
  "Failing compliance, my client shall be constrained to initiate appropriate legal proceedings at your risk and cost.",
];

interface DocumentGenerationLiveDemoProps {
  className?: string;
  active?: boolean;
  onComplete?: () => void;
}

export function DocumentGenerationLiveDemo({
  className,
  active = true,
  onComplete,
}: DocumentGenerationLiveDemoProps) {
  const [phase, setPhase] = useState<DocPhase>("prompt");
  const [typed, setTyped] = useState("");
  const [genLabel, setGenLabel] = useState(GEN_LABELS[0]);
  const [progress, setProgress] = useState(0);
  const [clauseCount, setClauseCount] = useState(0);
  const doneRef = useRef(false);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!active) return;

    if (reducedMotion) {
      setTyped(PROMPT_TEXT);
      setProgress(100);
      setClauseCount(CLAUSES.length);
      setPhase("ready");
      const t = setTimeout(() => onComplete?.(), 3400);
      return () => clearTimeout(t);
    }

    if (phase === "prompt") {
      let i = 0;
      const interval = setInterval(() => {
        i += 2;
        if (i >= PROMPT_TEXT.length) {
          setTyped(PROMPT_TEXT);
          clearInterval(interval);
          setTimeout(() => setPhase("generating"), 500);
        } else {
          setTyped(PROMPT_TEXT.slice(0, i));
        }
      }, 32);
      return () => clearInterval(interval);
    }

    if (phase === "generating") {
      let labelIdx = 0;
      const labels = setInterval(() => {
        labelIdx = (labelIdx + 1) % GEN_LABELS.length;
        setGenLabel(GEN_LABELS[labelIdx]);
      }, 560);
      const start = performance.now();
      let raf = 0;
      const tick = (now: number) => {
        const p = Math.min(100, Math.round(((now - start) / 2000) * 100));
        setProgress(p);
        if (p < 100) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      const t = setTimeout(() => {
        clearInterval(labels);
        cancelAnimationFrame(raf);
        setProgress(100);
        setPhase("reveal");
      }, 2000);
      return () => {
        clearInterval(labels);
        cancelAnimationFrame(raf);
        clearTimeout(t);
      };
    }

    if (phase === "reveal") {
      let c = 0;
      const step = setInterval(() => {
        c += 1;
        setClauseCount(c);
        if (c >= CLAUSES.length) clearInterval(step);
      }, 460);
      const t = setTimeout(() => {
        clearInterval(step);
        setClauseCount(CLAUSES.length);
        setPhase("ready");
      }, CLAUSES.length * 460 + 400);
      return () => {
        clearInterval(step);
        clearTimeout(t);
      };
    }

    if (phase === "ready") {
      const t = setTimeout(() => setPhase("hold"), 700);
      return () => clearTimeout(t);
    }

    if (phase === "hold") {
      const t = setTimeout(() => {
        if (!doneRef.current) {
          doneRef.current = true;
          onComplete?.();
        }
      }, 2800);
      return () => clearTimeout(t);
    }
  }, [phase, active, reducedMotion, onComplete]);

  const showDoc = phase === "reveal" || phase === "ready" || phase === "hold";
  const isGenerating = phase === "generating";
  const isReady = phase === "ready" || phase === "hold";

  return (
    <DemoCardShell
      className={className}
      icon={<FileText className="h-4 w-4" />}
      title="Document Studio"
      subtitle="Prompt to professional draft"
      footer="AI-drafted · Indian legal format · Editable & ready"
    >
      <div className="space-y-4 p-5">
        <div className="h-[300px] space-y-4 overflow-hidden">
          {/* Prompt bubble */}
          <div className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-gradient-to-br from-slate-800 to-slate-900 px-4 py-3 text-sm text-white shadow-md demo-msg-in dark:from-slate-100 dark:to-slate-300 dark:text-slate-900">
            {typed || "\u00a0"}
            {phase === "prompt" && (
              <span className="stream-caret ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-white/80 dark:bg-slate-700" />
            )}
          </div>

          {isGenerating && (
            <div className="space-y-2.5 demo-msg-in">
              <div className="flex items-center gap-3">
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                  <div className="spinner-glow absolute inset-0 rounded-full bg-gradient-to-br from-slate-500/30 to-slate-700/30 blur-sm" />
                  <div className="spinner-ring absolute inset-0" />
                  <Sparkles className="relative h-3.5 w-3.5 spark-twinkle" />
                </div>
                <div className="rounded-2xl bg-white/70 px-4 py-2.5 text-xs text-muted-foreground shadow-sm dark:bg-white/[0.06]">
                  <span className="demo-shimmer inline-block">{genLabel}</span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-slate-600 to-slate-900 transition-all duration-200 dark:from-slate-300 dark:to-white"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {showDoc && (
            /* A4-style generated document preview */
            <div className="demo-doc-page relative mx-auto max-w-[300px] rounded-xl border border-black/[0.08] bg-white px-5 py-4 text-slate-800 shadow-[0_16px_40px_rgba(15,23,42,0.14)] dark:border-white/15 dark:bg-slate-100">
              <div className="text-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em]">Legal Notice</p>
                <p className="mt-0.5 text-[8px] uppercase tracking-wider text-slate-500">
                  Under Section 73, Indian Contract Act, 1872
                </p>
              </div>
              <div className="my-2.5 h-px bg-slate-200" />
              <div className="space-y-1 text-[8px] leading-relaxed text-slate-600">
                <p>
                  <span className="font-semibold text-slate-800">To:</span> M/s Reliant Traders,
                  New Delhi
                </p>
                <p>
                  <span className="font-semibold text-slate-800">From:</span> Adv. Priya Sharma,
                  for the complainant
                </p>
              </div>
              <ol className="mt-2 space-y-1.5">
                {CLAUSES.map((clause, i) => (
                  <li
                    key={i}
                    className={cn(
                      "flex gap-1.5 text-[8px] leading-snug text-slate-700 transition-all duration-300",
                      i < clauseCount
                        ? "demo-clause-in opacity-100"
                        : "translate-y-1 opacity-0",
                    )}
                  >
                    <span className="font-semibold text-slate-900">{i + 1}.</span>
                    <span>{clause}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-2.5 flex items-center justify-between border-t border-slate-200 pt-2 text-[8px] text-slate-500">
                <span>Yours faithfully,</span>
                <span className="font-[cursive] text-[11px] text-slate-700">P. Sharma</span>
              </div>
            </div>
          )}
        </div>

        {/* Action dock mock */}
        <div className="flex items-center gap-2 rounded-2xl border border-black/[0.06] bg-white/50 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
          <div
            className={cn(
              "flex flex-1 items-center gap-1.5 text-xs font-medium transition-colors",
              isReady ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
            )}
          >
            {isReady ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Ready to download · Editable draft
              </>
            ) : (
              <span className="demo-input-pulse">Describe the document you need…</span>
            )}
          </div>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/10"
          >
            <PenLine className="h-3.5 w-3.5" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white dark:from-slate-200 dark:to-slate-400 dark:text-slate-900">
            {isReady ? <Download className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
          </div>
        </div>
      </div>
    </DemoCardShell>
  );
}
