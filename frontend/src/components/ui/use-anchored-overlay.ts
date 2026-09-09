"use client";

import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from "react";

const SHEET_MQ = "(max-width: 639px)";

export type OverlayLayout =
  | { mode: "sheet" }
  | {
      mode: "popover";
      top?: number;
      bottom?: number;
      left: number;
      width: number;
      maxHeight: number;
      placement: "top" | "bottom";
    };

export function computeOverlayLayout(
  trigger: DOMRect,
  opts?: { minWidth?: number; maxMenuHeight?: number; align?: "start" | "end" },
): OverlayLayout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw < 640) return { mode: "sheet" };

  const pad = 12;
  const gap = 8;
  const minWidth = opts?.minWidth ?? trigger.width;
  const width = Math.min(Math.max(minWidth, trigger.width), vw - pad * 2);
  let left = opts?.align === "end" ? trigger.right - width : trigger.left;
  left = Math.min(Math.max(left, pad), vw - pad - width);

  const maxCap = opts?.maxMenuHeight ?? 320;
  const spaceBelow = vh - trigger.bottom - gap - pad;
  const spaceAbove = trigger.top - gap - pad;
  const placement: "top" | "bottom" = spaceBelow >= 180 || spaceBelow >= spaceAbove ? "bottom" : "top";
  const maxHeight = Math.max(148, Math.min(maxCap, placement === "bottom" ? spaceBelow : spaceAbove));

  if (placement === "bottom") {
    return { mode: "popover", top: trigger.bottom + gap, left, width, maxHeight, placement };
  }
  return { mode: "popover", bottom: vh - trigger.top + gap, left, width, maxHeight, placement };
}

export function useAnchoredOverlay(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  opts?: { minWidth?: number; maxMenuHeight?: number; align?: "start" | "end" },
) {
  const [layout, setLayout] = useState<OverlayLayout | null>(null);
  const [mounted, setMounted] = useState(false);

  const minWidth = opts?.minWidth;
  const maxMenuHeight = opts?.maxMenuHeight;
  const align = opts?.align;

  useEffect(() => setMounted(true), []);

  const update = useCallback(() => {
    const el = anchorRef.current;
    if (!open || !el) return;
    setLayout(computeOverlayLayout(el.getBoundingClientRect(), { minWidth, maxMenuHeight, align }));
  }, [open, anchorRef, minWidth, maxMenuHeight, align]);

  useLayoutEffect(() => {
    if (!open) {
      setLayout(null);
      return;
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia(SHEET_MQ);
    const onChange = () => update();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [open, update]);

  return { layout, mounted };
}
