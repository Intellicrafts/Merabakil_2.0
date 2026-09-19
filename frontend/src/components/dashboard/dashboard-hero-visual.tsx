"use client";

import type { DotLottie } from "@lottiefiles/dotlottie-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

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

const MIN_CANVAS = 32;

function hasValidSize(el: HTMLElement): boolean {
  const { width, height } = el.getBoundingClientRect();
  return Math.floor(width) >= MIN_CANVAS && Math.floor(height) >= MIN_CANVAS;
}

export function DashboardHeroVisual({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dotLottieRef = useRef<DotLottie | null>(null);
  const [canMount, setCanMount] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || reduceMotion) return undefined;

    const sync = () => {
      const valid = hasValidSize(el);
      setCanMount(valid);
      if (valid) {
        dotLottieRef.current?.resize();
      }
    };

    // Wait for layout before the first measure — avoids 0×0 canvas on mount.
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(sync);
    });

    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [reduceMotion]);

  return (
    <div
      ref={hostRef}
      className={cn(
        "dash-hero-lottie relative flex items-center justify-center",
        "h-[7rem] w-full max-w-[280px] sm:max-w-none",
        "lg:h-[220px] lg:max-w-full lg:min-h-[200px]",
        className,
      )}
      aria-hidden
    >
      {canMount && !reduceMotion ? (
        <DotLottieReact
          src={DASHBOARD_HERO_LOTTIE_SRC}
          loop
          autoplay
          className="h-full w-full"
          dotLottieRefCallback={(instance) => {
            dotLottieRef.current = instance;
            instance?.resize();
          }}
          renderConfig={{
            autoResize: true,
            devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
            freezeOnOffscreen: true,
          }}
          layout={{ fit: "contain", align: [0.5, 0.5] }}
        />
      ) : null}
    </div>
  );
}
