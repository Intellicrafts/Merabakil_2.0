/** True on narrow viewports or low-end devices — skip heavy GPU/RAF work. */
export function preferReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(max-width: 768px)").matches ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Minimum ms between RAF-driven state updates (~15fps on mobile, ~60fps desktop). */
export function rafUpdateIntervalMs(): number {
  return preferReducedMotion() ? 66 : 16;
}
