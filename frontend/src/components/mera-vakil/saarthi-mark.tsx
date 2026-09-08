"use client";

import { cn } from "@/lib/utils";

export type SaarthiMarkState = "idle" | "thinking" | "streaming";

export function SaarthiMark({
  state = "idle",
  className,
}: {
  state?: SaarthiMarkState;
  className?: string;
}) {
  return (
    <span
      className={cn("saarthi-mark", `saarthi-mark-${state}`, className)}
      role="img"
      aria-label={state === "idle" ? "Saarthi" : "Saarthi is preparing an answer"}
    >
      <span className="saarthi-mark-glow" aria-hidden />
      <span className="saarthi-mark-orbit" aria-hidden />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/app-icon-192.png" alt="" draggable={false} className="saarthi-mark-icon" />
    </span>
  );
}
