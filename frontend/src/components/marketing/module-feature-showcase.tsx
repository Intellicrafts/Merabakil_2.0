"use client";

import { FileText, MessagesSquare, Scale } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MeraVakilLiveDemo = dynamic(
  () =>
    import("@/components/marketing/mera-vakil-live-demo").then((m) => ({
      default: m.MeraVakilLiveDemo,
    })),
  { ssr: false },
);
const ConsultationLiveDemo = dynamic(
  () =>
    import("@/components/marketing/consultation-live-demo").then((m) => ({
      default: m.ConsultationLiveDemo,
    })),
  { ssr: false },
);
const DocumentGenerationLiveDemo = dynamic(
  () =>
    import("@/components/marketing/document-generation-live-demo").then((m) => ({
      default: m.DocumentGenerationLiveDemo,
    })),
  { ssr: false },
);

const MODULES = [
  {
    id: "chatbot",
    label: "Chat",
    title: "Mera Vakil",
    tagline: "Ask anything · get cited answers",
    icon: MessagesSquare,
  },
  {
    id: "consultation",
    label: "Consult",
    title: "Legal Consultation",
    tagline: "AI-matched verified advocates",
    icon: Scale,
  },
  {
    id: "documents",
    label: "Documents",
    title: "Document Studio",
    tagline: "Prompt to professional draft",
    icon: FileText,
  },
] as const;

const CYCLE_MS = 12_000;
const MANUAL_PAUSE_MS = 10_000;

interface Layer {
  module: number;
  token: number;
  leaving: boolean;
}

interface ModuleFeatureShowcaseProps {
  className?: string;
}

/**
 * Cycles three product demos one-by-one with unified premium chrome.
 */
export function ModuleFeatureShowcase({ className }: ModuleFeatureShowcaseProps) {
  const [layers, setLayers] = useState<Layer[]>([{ module: 0, token: 0, leaving: false }]);
  const [inView, setInView] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef(0);
  const pauseUntilRef = useRef(0);

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
      },
      { rootMargin: "80px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const switchToModule = useCallback(
    (index: number) => {
      setLayers((prev) => {
        const active = prev.find((l) => !l.leaving)?.module ?? 0;
        if (index === active) return prev;
        pauseUntilRef.current = Date.now() + MANUAL_PAUSE_MS;
        const token = (tokenRef.current += 1);
        setProgressKey((k) => k + 1);
        const nextLayer: Layer = { module: index, token, leaving: false };
        if (reducedMotion) return [nextLayer];
        return [...prev.map((l) => ({ ...l, leaving: true })), nextLayer];
      });
    },
    [reducedMotion],
  );

  const advance = useCallback(() => {
    if (Date.now() < pauseUntilRef.current) return;
    setLayers((prev) => {
      const token = (tokenRef.current += 1);
      const activeLayer = prev.find((l) => !l.leaving) ?? prev[prev.length - 1];
      const nextModule = (activeLayer.module + 1) % MODULES.length;
      setProgressKey((k) => k + 1);
      const nextLayer: Layer = { module: nextModule, token, leaving: false };
      if (reducedMotion) return [nextLayer];
      return [...prev.map((l) => ({ ...l, leaving: true })), nextLayer];
    });
  }, [reducedMotion]);

  useEffect(() => {
    if (!layers.some((l) => l.leaving)) return;
    const t = setTimeout(() => {
      setLayers((prev) => prev.filter((l) => !l.leaving));
    }, 560);
    return () => clearTimeout(t);
  }, [layers]);

  const activeModule = layers.find((l) => !l.leaving)?.module ?? 0;
  const activeMeta = MODULES[activeModule];

  function renderModule(index: number, active: boolean, token: number): ReactNode {
    if (!active || !inView) return null;
    const shared = { active, onComplete: advance, className: "w-full", compact: true };
    switch (MODULES[index].id) {
      case "chatbot":
        return <MeraVakilLiveDemo {...shared} startIndex={token} />;
      case "consultation":
        return <ConsultationLiveDemo {...shared} />;
      case "documents":
        return <DocumentGenerationLiveDemo {...shared} />;
      default:
        return null;
    }
  }

  return (
    <div ref={containerRef} className={cn("w-full", className)}>
      <div className="showcase-premium-frame overflow-hidden rounded-2xl border border-black/[0.06] bg-gradient-to-b from-black/[0.02] to-transparent p-4 sm:p-5 dark:border-white/[0.08] dark:from-white/[0.03]">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Platform preview
            </p>
            <p className="mt-1 text-sm font-semibold tracking-tight transition-opacity duration-300">
              {activeMeta.title}
            </p>
            <p className="text-[11px] text-muted-foreground">{activeMeta.tagline}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.06] px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-emerald-500 demo-live-pulse" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        </div>

        {/* Step dots — 1 of 3 */}
        <div className="mb-3 flex items-center gap-1.5" aria-hidden>
          {MODULES.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 rounded-full transition-all duration-500",
                i === activeModule ? "w-6 bg-slate-700 dark:bg-slate-300" : "w-1.5 bg-black/10 dark:bg-white/15",
              )}
            />
          ))}
          <span className="ml-1 text-[10px] tabular-nums text-muted-foreground">
            {activeModule + 1}/{MODULES.length}
          </span>
        </div>

        {/* Segmented switcher */}
        <div className="relative mb-4">
          <div
            className="flex rounded-xl border border-black/[0.05] bg-black/[0.02] p-0.5 dark:border-white/[0.08] dark:bg-white/[0.02]"
            role="tablist"
            aria-label="Platform modules"
          >
            {MODULES.map((m, i) => {
              const Icon = m.icon;
              const isActive = i === activeModule;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => switchToModule(i)}
                  className={cn(
                    "relative flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold transition-colors duration-300 sm:gap-1.5 sm:px-3 sm:text-xs",
                    isActive ? "text-foreground" : "text-muted-foreground/55 hover:text-muted-foreground",
                  )}
                >
                  {isActive && (
                    <span className="absolute inset-0 rounded-lg bg-background shadow-sm dark:bg-white/[0.07]" />
                  )}
                  <Icon
                    className={cn(
                      "relative h-3.5 w-3.5 shrink-0",
                      isActive && "text-slate-700 dark:text-slate-200",
                    )}
                  />
                  <span className="relative truncate">{m.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 h-px overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.06]">
            <div
              key={`${activeModule}-${progressKey}`}
              className="hero-module-progress h-full rounded-full bg-gradient-to-r from-slate-600 to-slate-800 dark:from-slate-300 dark:to-slate-100"
              style={{ animationDuration: `${CYCLE_MS}ms` }}
            />
          </div>
        </div>

        {/* Demo — one module at a time */}
        <div className="relative min-h-[240px] sm:min-h-[300px] lg:min-h-[320px]">
          {!inView ? (
            <div className="space-y-3">
              <Skeleton className="ml-auto h-11 w-[72%] rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-7 w-1/2 rounded-lg" />
            </div>
          ) : (
            layers.map((layer) => (
              <div
                key={`${layer.module}-${layer.token}`}
                className={cn(
                  "w-full",
                  layer.leaving
                    ? "demo-module-exit absolute inset-0 z-20"
                    : layers.length > 1
                      ? "demo-module-enter"
                      : "",
                )}
              >
                {renderModule(layer.module, !layer.leaving, layer.token)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
