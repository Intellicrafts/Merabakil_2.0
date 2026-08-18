"use client";

import type { ObjectionEvent, ObjectionType } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

const OBJECTION_TYPES: { id: ObjectionType; label: string }[] = [
  { id: "relevance", label: "Relevance" },
  { id: "leading", label: "Leading" },
  { id: "no_foundation", label: "No foundation" },
  { id: "beyond_pleadings", label: "Beyond pleadings" },
  { id: "hearsay", label: "Hearsay" },
  { id: "procedure", label: "Procedure" },
];

interface ObjectionBarProps {
  objections: ObjectionEvent[];
  disabled?: boolean;
  onRaise: (type: ObjectionType) => void;
}

export function ObjectionBar({ objections, disabled, onRaise }: ObjectionBarProps) {
  const latest = objections[objections.length - 1];

  return (
    <div
      className={cn(
        "sticky bottom-2 z-10 rounded-2xl border border-black/[0.06] bg-white/80 p-3 shadow-lg backdrop-blur-xl",
        "dark:border-white/[0.08] dark:bg-white/[0.06]",
        "cs-card-in",
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Objections · Evidence Act / pleadings
          </p>
          {latest && (
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Latest: <span className="font-semibold capitalize text-foreground">{latest.ruling}</span>
              {" · "}
              {latest.type.replace(/_/g, " ")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {OBJECTION_TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              onClick={() => onRaise(t.id)}
              className="cs-btn-soft h-8 rounded-lg px-2.5 text-[11px] font-semibold disabled:opacity-50"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
