"use client";

import { useEffect, useState } from "react";

function secondsUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, Math.round((ts - Date.now()) / 1000));
}

function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

/** Isolated countdown — parent page does not re-render every second. */
export function RoomCountdown({ endAt }: { endAt: string | null | undefined }) {
  const [remaining, setRemaining] = useState(() => secondsUntil(endAt));

  useEffect(() => {
    setRemaining(secondsUntil(endAt));
    const timer = window.setInterval(() => setRemaining(secondsUntil(endAt)), 1000);
    return () => window.clearInterval(timer);
  }, [endAt]);

  return <>{formatCountdown(remaining)}</>;
}
