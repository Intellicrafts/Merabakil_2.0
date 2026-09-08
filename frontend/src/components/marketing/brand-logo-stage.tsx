"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export function BrandLogoStage({ className }: { className?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const tick = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      stage.style.setProperty("--tilt-x", `${currentX.toFixed(2)}deg`);
      stage.style.setProperty("--tilt-y", `${currentY.toFixed(2)}deg`);
      frame = window.requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      const box = stage.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      targetY = x * 10;
      targetX = -y * 8;
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={stageRef}
      className={cn("brand-logo-stage relative mx-auto w-full max-w-[420px] lg:max-w-none", className)}
      aria-label="Mera Bakil brand mark"
    >
      <div className="brand-logo-stage-glow" aria-hidden />
      <div className="brand-logo-stage-orb brand-logo-stage-orb-a" aria-hidden />
      <div className="brand-logo-stage-orb brand-logo-stage-orb-b" aria-hidden />

      <div className="brand-logo-stage-core">
        <div className="brand-logo-stage-ring" aria-hidden />
        <div className="brand-logo-stage-ring brand-logo-stage-ring-slow" aria-hidden />
        <div className="brand-logo-stage-mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/app-icon-512.png"
            alt="Mera Bakil"
            width={512}
            height={512}
            draggable={false}
            className="brand-logo-stage-icon"
          />
          <span className="brand-logo-stage-sheen" aria-hidden />
        </div>
      </div>

      <div className="brand-logo-stage-copy">
        <p className="brand-logo-stage-title">Mera Bakil</p>
        <p className="brand-logo-stage-tag">Legal Help. Made Simple.</p>
      </div>
    </div>
  );
}
