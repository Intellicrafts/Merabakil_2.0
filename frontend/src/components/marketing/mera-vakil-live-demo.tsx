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
  /** When false, timers pause. Defaults to true. */
  active?: boolean;
  /**
   * When provided, the demo runs a single question then calls this instead of
   * looping to the next scene (used by the home module carousel).
   */
  onComplete?: () => void;
  /** Which scene to show first (carousel rotates this each loop). */
  startIndex?: number;
}

export function MeraVakilLiveDemo({
  className,
  active = true,
  onComplete,
  startIndex = 0,
}: MeraVakilLiveDemoProps) {
  const [sceneIndex, setSceneIndex] = useState(startIndex % DEMO_SCENES.length);
  const [phase, setPhase] = useState<DemoPhase>("user-in");
  const [streamedText, setStreamedText] = useState("");
  const [thinkingLabel, setThinkingLabel] = useState(THINKING_LABELS[0]);
  const [showCitations, setShowCitations] = useState(false);

  const scene = DEMO_SCENES[sceneIndex];
  const single = typeof onComplete === "function";

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

  return (
    <DemoCardShell
      className={className}
      icon={<Sparkles className="h-4 w-4 spark-twinkle" />}
      title="Mera Vakil"
      subtitle="Your AI legal counsel"
      footer="Grounded answers · Live citations · Indian legal corpus"
    >
      <div className="space-y-4 p-5">
        <div className="h-[300px] space-y-4 overflow-hidden">
          {/* User message */}
          <div
            key={`user-${sceneIndex}`}
            className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-gradient-to-br from-slate-800 to-slate-900 px-4 py-3 text-sm text-white shadow-md demo-msg-in dark:from-slate-100 dark:to-slate-300 dark:text-slate-900"
          >
            {scene.userQuestion}
          </div>

          {/* Thinking state */}
          {isThinking && (
            <div key={`think-${sceneIndex}`} className="flex items-center gap-3 demo-msg-in">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                <div className="spinner-glow absolute inset-0 rounded-full bg-gradient-to-br from-slate-500/30 to-slate-700/30 blur-sm" />
                <div className="spinner-ring absolute inset-0" />
                <Sparkles className="relative h-3.5 w-3.5 spark-twinkle" />
              </div>
              <div className="rounded-2xl bg-white/70 px-4 py-2.5 text-xs text-muted-foreground shadow-sm dark:bg-white/[0.06]">
                <span className="demo-shimmer inline-block">{thinkingLabel}</span>
              </div>
            </div>
          )}

          {/* Assistant streaming */}
          {isStreaming && (
            <div key={`assist-${sceneIndex}`} className="space-y-3 demo-msg-in">
              <div className="flex gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200/80 dark:bg-slate-700/50">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 rounded-2xl bg-white/90 px-4 py-3 text-sm leading-relaxed shadow-sm dark:bg-white/[0.07]">
                  {streamedText}
                  {phase === "streaming" && (
                    <span className="stream-caret ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-slate-700 dark:bg-slate-300" />
                  )}
                </div>
              </div>

              {/* Citations */}
              {showCitations && (
                <div className="ml-10 flex flex-wrap gap-2 demo-cite-in">
                  {scene.citations.map((cite) => (
                    <div
                      key={cite.label}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.06] bg-white/80 px-2.5 py-1.5 text-[11px] shadow-sm dark:border-white/10 dark:bg-white/[0.06]"
                    >
                      <BookOpen className="h-3 w-3 text-slate-500" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {cite.label}
                      </span>
                      <span className="text-muted-foreground">· {cite.source}</span>
                    </div>
                  ))}
                  <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    94% confidence
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input dock mock */}
        <div className="flex items-center gap-2 rounded-2xl border border-black/[0.06] bg-white/50 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.04]">
          <div className={cn("flex-1 text-xs text-muted-foreground", phase === "user-in" && "demo-input-pulse")}>
            Ask anything about Indian law…
          </div>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/10"
          >
            <Mic className="h-3.5 w-3.5" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white dark:from-slate-200 dark:to-slate-400 dark:text-slate-900">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </DemoCardShell>
  );
}
