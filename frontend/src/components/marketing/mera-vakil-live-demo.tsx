"use client";

import { BookOpen, Mic, Scale } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AppIcon } from "@/components/brand/brand-logo";
import { DemoCardShell } from "@/components/marketing/demo-card-shell";
import { cn } from "@/lib/utils";

type DemoPhase = "user-in" | "thinking" | "streaming" | "citations" | "hold";

interface DemoScene {
  userQuestion: string;
  holding: string;
  statute: string;
  assistantAnswer: string;
  citations: { label: string; source: string }[];
}

const DEMO_SCENES: DemoScene[] = [
  {
    userQuestion: "What is the limitation period for a property dispute?",
    holding: "12 years for recovery of immovable property",
    statute: "Limitation Act, 1963 · Art. 65",
    assistantAnswer:
      "A suit for possession of immovable property based on title is generally 12 years from when the defendant’s possession becomes adverse. Facts, acknowledgements, and special statutes can shorten or extend this.",
    citations: [
      { label: "Art. 65", source: "Limitation Act, 1963" },
      { label: "Art. 58", source: "Declaratory relief" },
    ],
  },
  {
    userQuestion: "What are my rights under Article 21?",
    holding: "Life and personal liberty — except by procedure of law",
    statute: "Constitution of India · Art. 21",
    assistantAnswer:
      "Article 21 protects life and personal liberty. Deprivation is lawful only by a procedure that is fair, just, and reasonable — as read with Maneka Gandhi (1978).",
    citations: [
      { label: "Art. 21", source: "Constitution of India" },
      { label: "Maneka Gandhi", source: "1978 SC" },
    ],
  },
  {
    userQuestion: "Can my employer terminate me without notice?",
    holding: "Retrenchment needs notice or wages in lieu",
    statute: "Industrial Disputes Act, 1947 · s. 25F",
    assistantAnswer:
      "For a workman, retrenchment typically requires one month’s notice or wages in lieu, plus compensation where the establishment crosses the statutory headcount. Contract and standing orders still matter.",
    citations: [
      { label: "s. 25F", source: "Industrial Disputes Act" },
      { label: "s. 2(s)", source: "Workman" },
    ],
  },
];

const THINKING_LABELS = [
  "Reading the Indian statute book…",
  "Checking controlling judgments…",
  "Grounding each citation…",
];

interface MeraVakilLiveDemoProps {
  className?: string;
  active?: boolean;
  onComplete?: () => void;
  startIndex?: number;
  compact?: boolean;
}

export function MeraVakilLiveDemo({
  className,
  active = true,
  onComplete,
  startIndex = 0,
  compact = false,
}: MeraVakilLiveDemoProps) {
  const [sceneIndex, setSceneIndex] = useState(startIndex % DEMO_SCENES.length);
  const [phase, setPhase] = useState<DemoPhase>("user-in");
  const [streamedText, setStreamedText] = useState("");
  const [thinkingLabel, setThinkingLabel] = useState(THINKING_LABELS[0]);
  const [showCitations, setShowCitations] = useState(false);

  const scene = DEMO_SCENES[sceneIndex];
  const single = typeof onComplete === "function";
  const citations = compact ? scene.citations.slice(0, 2) : scene.citations;
  const contentHeight = compact ? "h-full" : "min-h-[280px] sm:min-h-[320px]";

  const advanceScene = useCallback(() => {
    if (single) {
      onComplete?.();
      return;
    }
    setSceneIndex((i) => (i + 1) % DEMO_SCENES.length);
    setPhase("user-in");
    setStreamedText("");
    setShowCitations(false);
  }, [single, onComplete]);

  useEffect(() => {
    if (!active) return;
    if (phase === "user-in") {
      const t = setTimeout(() => setPhase("thinking"), 900);
      return () => clearTimeout(t);
    }
    if (phase === "thinking") {
      let labelIdx = 0;
      const labelInterval = setInterval(() => {
        labelIdx = (labelIdx + 1) % THINKING_LABELS.length;
        setThinkingLabel(THINKING_LABELS[labelIdx]);
      }, 700);
      const t = setTimeout(() => {
        clearInterval(labelInterval);
        setPhase("streaming");
      }, 2200);
      return () => {
        clearTimeout(t);
        clearInterval(labelInterval);
      };
    }
    if (phase === "streaming") {
      const full = scene.assistantAnswer;
      let charIdx = 0;
      const interval = setInterval(() => {
        charIdx += 2;
        if (charIdx >= full.length) {
          setStreamedText(full);
          clearInterval(interval);
          setPhase("citations");
        } else {
          setStreamedText(full.slice(0, charIdx));
        }
      }, 28);
      return () => clearInterval(interval);
    }
    if (phase === "citations") {
      const t = setTimeout(() => {
        setShowCitations(true);
        setPhase("hold");
      }, 400);
      return () => clearTimeout(t);
    }
    if (phase === "hold") {
      const t = setTimeout(advanceScene, single ? 2600 : 3800);
      return () => clearTimeout(t);
    }
  }, [phase, scene.assistantAnswer, advanceScene, active, single]);

  const isThinking = phase === "thinking";
  const isStreaming = phase === "streaming" || phase === "citations" || phase === "hold";

  const shellProps = compact
    ? { variant: "minimal" as const }
    : {
        variant: "premium" as const,
        title: "Saarthi",
        subtitle: "Mera Bakil · cited legal counsel",
        badge: "Live preview",
        footer:
          "Informational only — not a substitute for advice from a licensed advocate. Always verify the latest text of the Act.",
      };

  return (
    <DemoCardShell className={className} {...shellProps}>
      <div className={cn(compact ? "demo-compact-stage" : "space-y-3 sm:space-y-4")}>
        <div className={cn(contentHeight, "space-y-3 overflow-hidden sm:space-y-4")}>
          <div
            key={`user-${sceneIndex}`}
            className="ml-auto max-w-[90%] rounded-2xl rounded-br-md bg-gradient-to-br from-slate-800 to-slate-900 px-4 py-3 text-[13px] leading-relaxed text-white demo-msg-in dark:from-slate-100 dark:to-slate-300 dark:text-slate-900 sm:text-sm"
          >
            {scene.userQuestion}
          </div>

          {isThinking && (
            <div key={`think-${sceneIndex}`} className="flex items-center gap-3 demo-msg-in">
              <div className="relative h-8 w-8 shrink-0">
                <div className="spinner-glow absolute inset-0 rounded-[22%] bg-emerald-400/25 blur-md" />
                <AppIcon className="relative h-8 w-8" alt="" />
              </div>
              <div className="rounded-2xl border border-black/[0.05] bg-black/[0.03] px-4 py-2.5 text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
                <span className="demo-shimmer inline-block">{thinkingLabel}</span>
              </div>
            </div>
          )}

          {isStreaming && (
            <div key={`assist-${sceneIndex}`} className="space-y-3 demo-msg-in">
              <div className="flex gap-2.5">
                <AppIcon className="mt-0.5 h-8 w-8 shrink-0" alt="" />
                <div className="min-w-0 flex-1 space-y-2.5">
                  {!compact && showCitations && (
                    <div className="rounded-xl border border-black/[0.06] bg-gradient-to-br from-white to-slate-50/80 px-3.5 py-2.5 dark:border-white/10 dark:from-white/[0.06] dark:to-transparent">
                      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
                        <Scale className="h-3 w-3" strokeWidth={2} />
                        Holding
                      </p>
                      <p className="mt-1 text-[13px] font-semibold leading-snug tracking-tight text-foreground">
                        {scene.holding}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{scene.statute}</p>
                    </div>
                  )}
                  <div className="rounded-2xl border border-black/[0.05] bg-black/[0.025] px-4 py-3 text-[13px] leading-relaxed dark:border-white/10 dark:bg-white/[0.04] sm:text-sm">
                    {streamedText}
                    {phase === "streaming" && (
                      <span className="stream-caret ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-slate-700 dark:bg-slate-300" />
                    )}
                  </div>
                </div>
              </div>

              {showCitations && (
                <div className="ml-10 flex flex-wrap gap-2 demo-cite-in">
                  {citations.map((cite) => (
                    <div
                      key={cite.label}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.06] bg-white/80 px-2.5 py-1.5 text-[11px] dark:border-white/10 dark:bg-white/[0.04]"
                    >
                      <BookOpen className="h-3 w-3 text-slate-500" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{cite.label}</span>
                      <span className="text-muted-foreground">· {cite.source}</span>
                    </div>
                  ))}
                  {!compact && (
                    <div className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.08] px-2.5 py-1.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                      Cited · primary sources
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {!compact && (
          <div className="flex items-center gap-2 rounded-2xl border border-black/[0.06] bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04] sm:py-2.5">
            <div className={cn("flex-1 text-xs text-muted-foreground", phase === "user-in" && "demo-input-pulse")}>
              Ask a legal question in plain language…
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/70" aria-hidden>
              <Mic className="h-3.5 w-3.5" />
            </span>
            <AppIcon className="h-8 w-8" alt="" />
          </div>
        )}
      </div>
    </DemoCardShell>
  );
}
