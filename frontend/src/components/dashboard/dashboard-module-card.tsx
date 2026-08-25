"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { DashboardModule } from "@/lib/dashboard-config";
import { getModuleMeta } from "@/lib/dashboard-meta";
import { cn } from "@/lib/utils";

const MODULE_CTA: Record<string, string> = {
  "/mera-vakil": "Ask a question",
  "/research": "Start research",
  "/lawyer-marketplace": "Find a lawyer",
  "/cases": "View matters",
  "/courtroom": "Enter courtroom",
  "/documents": "Open documents",
  "/admin/knowledge": "Manage corpus",
  "/admin/users": "Manage users",
  "/admin/appointments": "View bookings",
};

export function DashboardModuleCard({ mod }: { mod: DashboardModule }) {
  const Icon = mod.icon;
  const meta = getModuleMeta(mod.href);
  const cta = MODULE_CTA[mod.href] ?? "Open";

  return (
    <Link
      href={mod.href}
      className={cn(
        "group relative flex flex-col gap-3.5 overflow-hidden rounded-2xl px-4 py-4 sm:px-5 sm:py-5",
        "border border-black/[0.06] bg-white",
        "shadow-[0_1px_3px_rgba(15,23,42,0.05)]",
        "transition-all duration-200 hover:-translate-y-px hover:border-primary/20 hover:shadow-[0_10px_28px_rgba(15,23,42,0.07)]",
        "active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2",
        "dark:border-white/[0.08] dark:bg-zinc-900 dark:hover:border-primary/30",
        `dash-module-tint-${meta.tint}`,
      )}
    >
      {/* Tag + CTA */}
      <div className="relative flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground dark:bg-white/[0.08]">
          {meta.tag}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            "border-black/[0.06] bg-white/80 text-foreground/60",
            "transition-all duration-150 group-hover:border-primary/25 group-hover:bg-primary/[0.06] group-hover:text-primary",
            "dark:border-white/[0.08] dark:bg-white/[0.05]",
          )}
        >
          {cta}
          <ArrowUpRight className="h-3 w-3 transition-transform duration-150 group-hover:-translate-y-px group-hover:translate-x-px" />
        </span>
      </div>

      {/* Icon + Title */}
      <div className="relative flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/[0.06] bg-white/90 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.08]">
          <Icon className="h-[18px] w-[18px] text-foreground/80" strokeWidth={1.75} />
        </span>
        <span className="text-[15px] font-semibold leading-tight tracking-tight">{mod.title}</span>
      </div>

      {/* Description */}
      <p className="relative line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
        {mod.description}
      </p>

      {/* Feature chips */}
      {meta.features.length > 0 && (
        <div className="relative flex flex-wrap gap-1.5">
          {meta.features.map((f) => (
            <span
              key={f}
              className="rounded-full border border-black/[0.06] bg-black/[0.02] px-2 py-0.5 text-[11px] text-muted-foreground/80 dark:border-white/[0.08] dark:bg-white/[0.04]"
            >
              {f}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
