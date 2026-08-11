"use client";

import { FileText, MessagesSquare, Scale } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { ConsultationLiveDemo } from "@/components/marketing/consultation-live-demo";
import { DocumentGenerationLiveDemo } from "@/components/marketing/document-generation-live-demo";
import { MeraVakilLiveDemo } from "@/components/marketing/mera-vakil-live-demo";
import { cn } from "@/lib/utils";

const MODULES = [
  { id: "chatbot", label: "Chat", icon: MessagesSquare },
  { id: "consultation", label: "Consult", icon: Scale },
  { id: "documents", label: "Documents", icon: FileText },
] as const;

interface Layer {
  module: number;
  token: number;
  leaving: boolean;
}

interface ModuleFeatureShowcaseProps {
  className?: string;
}

/**
 * Home-hero orchestrator that cycles three product demos —
 * Mera Vakil chat, Legal Consultation, Document Studio — as one
 * cohesive live surface with professional crossfades between modules.
 */
export function ModuleFeatureShowcase({ className }: ModuleFeatureShowcaseProps) {
  const [layers, setLayers] = useState<Layer[]>([{ module: 0, token: 0, leaving: false }]);
  const tokenRef = useRef(0);
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const advance = useCallback(() => {
    setLayers((prev) => {
      const token = (tokenRef.current += 1);
      const activeLayer = prev.find((l) => !l.leaving) ?? prev[prev.length - 1];
      const nextModule = (activeLayer.module + 1) % MODULES.length;
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
    const shared = { active, onComplete: advance, className: "w-full" };
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
    <div className={cn("w-full", className)}>
      <div className="relative">
        {layers.map((layer) => (
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
        ))}
      </div>

      {/* Module indicator */}
      <div className="mt-6 flex items-center justify-center gap-2">
        {MODULES.map((m, i) => {
          const Icon = m.icon;
          const isActive = i === activeModule;
          return (
            <div
              key={m.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all duration-500",
                isActive
                  ? "border-black/[0.08] bg-white/80 text-foreground shadow-sm dark:border-white/15 dark:bg-white/[0.08]"
                  : "border-transparent bg-transparent text-muted-foreground/60",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", isActive && "text-slate-700 dark:text-slate-200")} />
              <span>{m.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
