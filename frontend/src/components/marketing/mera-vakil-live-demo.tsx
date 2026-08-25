"use client";

import { BookOpen, Mic, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { DemoCardShell } from "@/components/marketing/demo-card-shell";
import { cn } from "@/lib/utils";

type DemoPhase = "user-in" | "thinking" | "streaming" | "citations" | "hold";

interface DemoScene {
  userQuestion: string;
  assistantAnswer: string;
  citations: { label: string; source: string }[];
}

const DEMO_SCENES: DemoScene[] = [
  {
    userQuestion: "What are my rights under Article 21?",
    assistantAnswer:
      "Article 21 guarantees the right to life and personal liberty. No person shall be deprived of life or liberty except according to procedure established by law.",
    citations: [
      { label: "Art. 21", source: "Constitution of India" },
      { label: "Maneka Gandhi v. UOI", source: "1978 SC" },
    ],
  },
  {
    userQuestion: "Can my employer terminate me without notice?",
    assistantAnswer:
      "Under the Industrial Disputes Act, retrenchment requires one month's notice or wages in lieu, plus compensation for eligible workmen in establishments with 100+ employees.",
    citations: [
      { label: "Sec. 25F", source: "Industrial Disputes Act" },
      { label: "Sec. 2(s)", source: "Workman definition" },
    ],
  },
  {
    userQuestion: "What is the limitation period for a property dispute?",
    assistantAnswer:
      "For immovable property, the Limitation Act prescribes 12 years from when possession becomes adverse. Suit for possession is generally 12 years from the cause of action.",
    citations: [
      { label: "Art. 65", source: "Limitation Act, 1963" },
      { label: "Art. 58", source: "Recovery of possession" },
    ],
  },
];

const THINKING_LABELS = [
  "Searching the legal corpus…",
  "Analyzing statutes…",
  "Grounding citations…",
];

interface MeraVakilLiveDemoProps {
  className?: string;
  active?: boolean;
  onComplete?: () => void;
  startIndex?: number;
  /** Hero showcase: minimal chrome, reduced density */
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
  const contentHeight = compact
    ? "h-full"
    : "h-[250px] sm:h-[280px] md:h-[300px]";

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
      const t = setTimeout(advanceScene, single ? 2600 : 3200);
      return () => clearTimeout(t);
    }
  }, [phase, scene.assistantAnswer, advanceScene, active, single]);

  const isThinking = phase === "thinking";
  const isStreaming = phase === "streaming" || phase === "citations" || phase === "hold";

  const shellProps = compact
    ? { variant: "minimal" as const }
    : {
        variant: "full" as const,
        icon: <Sparkles className="h-4 w-4 spark-twinkle" />,
        title: "Saarthi",
        subtitle: "Your AI legal counsel",
        footer: "Grounded answers · Live citations · Indian legal corpus",
      };

  return (
    <DemoCardShell className={className} {...shellProps}>
      <div className={cn(compact ? "demo-compact-stage" : "space-y-3 sm:space-y-4")}>
        <div className={cn(contentHeight, "space-y-3 overflow-hidden sm:space-y-4")}>
          <div
            key={`user-${sceneIndex}`}
            className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-gradient-to-br from-slate-800 to-slate-900 px-4 py-3 text-sm text-white demo-msg-in dark:from-slate-100 dark:to-slate-300 dark:text-slate-900"
          >
            {scene.userQuestion}
          </div>

          {isThinking && (
            <div key={`think-${sceneIndex}`} className="flex items-center gap-3 demo-msg-in">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                <div className="spinner-glow absolute inset-0 rounded-full bg-gradient-to-br from-slate-500/30 to-slate-700/30 blur-sm" />
                <div className="spinner-ring absolute inset-0" />
                <Sparkles className="relative h-3.5 w-3.5 spark-twinkle" />
              </div>
              <div className="demo-soft-bubble rounded-2xl px-4 py-2.5 text-xs text-muted-foreground">
                <span className="demo-shimmer inline-block">{thinkingLabel}</span>
              </div>
            </div>
          )}

          {isStreaming && (
            <div key={`assist-${sceneIndex}`} className="space-y-3 demo-msg-in">
              <div className="flex gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="demo-soft-bubble flex-1 rounded-2xl px-4 py-3 text-sm leading-relaxed">
                  {streamedText}
                  {phase === "streaming" && (
                    <span className="stream-caret ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-slate-700 dark:bg-slate-300" />
                  )}
                </div>
              </div>

              {showCitations && (
                <div className="ml-10 flex flex-wrap gap-2 demo-cite-in">
                  {citations.map((cite) => (
                    <div
                      key={cite.label}
                      className="demo-soft-chip inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px]"
                    >
                      <BookOpen className="h-3 w-3 text-slate-500" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {cite.label}
                      </span>
                      <span className="text-muted-foreground">· {cite.source}</span>
                    </div>
                  ))}
                  {!compact && (
                    <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      94% confidence
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {!compact && (
          <div className="demo-dock-mock flex items-center gap-2 px-1 py-2 sm:py-2.5">
            <div className={cn("flex-1 text-xs text-muted-foreground", phase === "user-in" && "demo-input-pulse")}>
              Ask anything about Indian law…
            </div>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/70"
            >
              <Mic className="h-3.5 w-3.5" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white dark:from-slate-200 dark:to-slate-400 dark:text-slate-900">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
          </div>
        )}
      </div>
    </DemoCardShell>
  );
}
