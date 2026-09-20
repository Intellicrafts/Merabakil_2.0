"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useState, type ReactNode } from "react";

import { DASHBOARD_HERO_LOTTIE_SRC } from "@/lib/dashboard-lottie";
import { cn } from "@/lib/utils";

const DotLottieReact = dynamic(
  () => import("@lottiefiles/dotlottie-react").then((mod) => mod.DotLottieReact),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse rounded-lg bg-black/[0.03] dark:bg-white/[0.04]" />
    ),
  },
);

/** Fixed even pixel sizes — avoids DotLottie ImageData buffer mismatches from fluid layout. */
const LOTTIE_SIZES = {
  mobile: { width: 240, height: 136 },
  tablet: { width: 280, height: 112 },
  desktop: { width: 380, height: 220 },
} as const;

type LottieTier = keyof typeof LOTTIE_SIZES;

function readLottieTier(): LottieTier {
  if (typeof window === "undefined") return "mobile";
  if (window.matchMedia("(min-width: 1024px)").matches) return "desktop";
  if (window.matchMedia("(min-width: 640px)").matches) return "tablet";
  return "mobile";
}

function subscribeLottieTier(onChange: () => void): () => void {
  const queries = [
    window.matchMedia("(min-width: 640px)"),
    window.matchMedia("(min-width: 1024px)"),
  ];
  const handler = () => onChange();
  queries.forEach((q) => q.addEventListener("change", handler));
  return () => queries.forEach((q) => q.removeEventListener("change", handler));
}

class LottieErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function LottiePulse() {
  return (
    <div className="h-full w-full animate-pulse rounded-lg bg-black/[0.03] dark:bg-white/[0.04]" />
  );
}

export function DashboardHeroVisual({ className }: { className?: string }) {
  const [tier, setTier] = useState<LottieTier>("mobile");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    setTier(readLottieTier());
    setMounted(true);
    return subscribeLottieTier(() => setTier(readLottieTier()));
  }, []);

  const canvasSize = LOTTIE_SIZES[tier];
  const showLottie = mounted && !reduceMotion;

  return (
    <div
      className={cn(
        "dash-hero-lottie relative mx-auto flex items-center justify-center",
        "h-[136px] w-[240px] sm:h-[112px] sm:w-[280px]",
        "lg:h-[220px] lg:w-[380px]",
        className,
      )}
      aria-hidden
    >
      {showLottie ? (
        <div
          className="overflow-hidden"
          style={{ width: canvasSize.width, height: canvasSize.height }}
        >
          <LottieErrorBoundary fallback={<LottiePulse />}>
            <DotLottieReact
              key={`${canvasSize.width}x${canvasSize.height}`}
              src={DASHBOARD_HERO_LOTTIE_SRC}
              loop
              autoplay
              width={canvasSize.width}
              height={canvasSize.height}
              renderConfig={{
                autoResize: false,
                devicePixelRatio: 1,
                freezeOnOffscreen: true,
              }}
              layout={{ fit: "contain", align: [0.5, 0.5] }}
            />
          </LottieErrorBoundary>
        </div>
      ) : (
        <LottiePulse />
      )}
    </div>
  );
}
