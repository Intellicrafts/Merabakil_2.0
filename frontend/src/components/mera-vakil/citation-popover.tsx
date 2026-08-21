"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { Citation, RetrievedSource, WebSearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CitationPopoverProps {
  marker: string;
  children: ReactNode;
  onClick?: () => void;
  citations?: Citation[];
  sources?: RetrievedSource[];
  webSources?: WebSearchResult[];
}

function excerptForMarker(
  marker: string,
  citations: Citation[],
  sources: RetrievedSource[],
  webSources: WebSearchResult[],
): { title: string; body: string; kind: string } | null {
  const kb = marker.match(/^\[KB-(\d+)\]$/);
  if (kb) {
    const idx = parseInt(kb[1], 10) - 1;
    const cite = citations.find((c) => c.marker === marker);
    const source = sources[idx];
    const title = cite?.title || source?.title || source?.document_id || marker;
    const body = source?.content?.slice(0, 180) || cite?.citation || "";
    const kind = source?.section ? `§ ${source.section}` : cite?.citation || "Authority";
    return { title, body, kind };
  }
  const web = marker.match(/^\[WEB-(\d+)\]$/);
  if (web) {
    const idx = parseInt(web[1], 10) - 1;
    const src = webSources[idx];
    if (!src) return { title: marker, body: "Web source", kind: "Web" };
    return { title: src.title, body: src.snippet.slice(0, 180), kind: "Web" };
  }
  return null;
}

export function CitationPopover({
  marker,
  children,
  onClick,
  citations = [],
  sources = [],
  webSources = [],
}: CitationPopoverProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const meta = excerptForMarker(marker, citations, sources, webSources);
  const timer = useRef<number | null>(null);

  function show() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - 280),
    });
    setOpen(true);
  }

  function hide() {
    setOpen(false);
  }

  function scheduleShow() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(show, 120);
  }

  function scheduleHide() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(hide, 80);
  }

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-describedby={open ? id : undefined}
        onClick={onClick}
        onMouseEnter={scheduleShow}
        onMouseLeave={scheduleHide}
        onFocus={scheduleShow}
        onBlur={scheduleHide}
        className="citation-pill inline-flex cursor-pointer items-center rounded-sm bg-slate-100 px-1.5 py-0.5 align-baseline text-[11px] font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        {children}
      </button>
      {open &&
        meta &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className={cn(
              "pointer-events-none fixed z-[80] w-[260px] rounded-lg border border-black/[0.08] bg-white/95 p-2.5 shadow-[0_12px_32px_rgba(15,23,42,0.14)] backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/95",
            )}
            style={{ top: coords.top, left: coords.left }}
            onMouseEnter={scheduleShow}
            onMouseLeave={scheduleHide}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {meta.kind}
            </p>
            <p className="mt-1 text-[12px] font-medium leading-snug text-foreground">{meta.title}</p>
            {meta.body && (
              <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                {meta.body}
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
