"use client";

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

const MIN_CANVAS = 48;

/** Snap to whole even px — avoids DotLottie ImageData buffer mismatches. */
function snapCanvasSize(el: HTMLElement): { width: number; height: number } | null {
  const rect = el.getBoundingClientRect();
  let width = Math.floor(rect.width);
  let height = Math.floor(rect.height);
  if (width < MIN_CANVAS || height < MIN_CANVAS) return null;
  if (width % 2 !== 0) width -= 1;
  if (height % 2 !== 0) height -= 1;
  return { width, height };
}

export function DashboardHeroVisual({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const resizeTimerRef = useRef<number | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || reduceMotion) return undefined;

    const sync = () => {
      const next = snapCanvasSize(el);
      setCanvasSize((prev) => {
        if (!next) return null;
        if (prev && prev.width === next.width && prev.height === next.height) return prev;
        return next;
      });
    };

    const scheduleSync = () => {
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current);
      }
      resizeTimerRef.current = window.setTimeout(sync, 100);
    };

    scheduleSync();

    const observer = new ResizeObserver(scheduleSync);
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current);
      }
    };
  }, [reduceMotion]);

  return (
    <div
      ref={hostRef}
      className={cn(
        "dash-hero-lottie relative mx-auto flex items-center justify-center",
        "h-[136px] w-[240px] sm:h-[112px] sm:w-[280px]",
        "lg:h-[220px] lg:w-full lg:max-w-[380px]",
        className,
      )}
      aria-hidden
    >
      {canvasSize && !reduceMotion ? (
        <div
          className="overflow-hidden"
          style={{ width: canvasSize.width, height: canvasSize.height }}
        >
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
        </div>
      ) : (
        <div className="h-full w-full animate-pulse rounded-lg bg-black/[0.03] dark:bg-white/[0.04]" />
      )}
    </div>
  );
}
