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
  { id: "chatbot", label: "Chat", icon: MessagesSquare },
  { id: "consultation", label: "Consult", icon: Scale },
  { id: "documents", label: "Documents", icon: FileText },
] as const;

const CYCLE_MS = 12_000;
const MANUAL_PAUSE_MS = 10_000;

/** Fixed stage height — prevents layout shift between module transitions */
const DEMO_STAGE_H = "h-[248px] sm:h-[272px] lg:h-[288px]";

interface Layer {
  module: number;
  token: number;
  leaving: boolean;
}

interface ModuleFeatureShowcaseProps {
  className?: string;
}

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

  function renderModule(index: number, active: boolean, token: number): ReactNode {
    if (!active || !inView) return null;
    const shared = { active, onComplete: advance, className: "w-full h-full", compact: true };
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
      <div className="showcase-shell">
        {/* Minimal module switcher */}
        <div className="mb-3">
          <div
            className="showcase-tabs flex rounded-xl p-0.5"
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
                    isActive ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground",
                  )}
                >
                  {isActive && (
                    <span className="showcase-tab-active absolute inset-0 rounded-lg" />
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
          <div className="showcase-progress-track mt-2 h-px overflow-hidden rounded-full">
            <div
              key={`${activeModule}-${progressKey}`}
              className="hero-module-progress h-full rounded-full bg-gradient-to-r from-slate-600/80 to-slate-800/80 dark:from-slate-400/80 dark:to-slate-200/80"
              style={{ animationDuration: `${CYCLE_MS}ms` }}
            />
          </div>
        </div>

        {/* Fixed-height demo stage — no shift on module change */}
        <div className={cn("relative overflow-hidden", DEMO_STAGE_H)}>
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
                  "absolute inset-0",
                  layer.leaving
                    ? "demo-module-exit z-20"
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
