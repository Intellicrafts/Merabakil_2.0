"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { DashboardModule } from "@/lib/dashboard-config";
import { getModuleMeta } from "@/lib/dashboard-meta";
import { cn } from "@/lib/utils";

export function DashboardModuleCard({ mod }: { mod: DashboardModule }) {
  const Icon = mod.icon;
  const meta = getModuleMeta(mod.href);

  return (
    <Link
      href={mod.href}
      className={cn(
        "group relative flex min-h-[88px] items-center gap-4 overflow-hidden rounded-2xl px-4 py-4 sm:min-h-[96px] sm:px-5",
        "border border-black/[0.06] bg-white",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        "transition-all duration-200 hover:-translate-y-px hover:border-primary/25 hover:shadow-[0_10px_28px_rgba(15,23,42,0.07)]",
        "active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2",
        "dark:border-white/[0.08] dark:bg-zinc-900 dark:hover:border-primary/35",
        `dash-module-tint-${meta.tint}`,
      )}
    >
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-black/[0.06] bg-white/90 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.08]">
        <Icon className="h-[18px] w-[18px] text-foreground/80" strokeWidth={1.75} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold tracking-tight">{mod.title}</span>
        <span className="mt-0.5 block truncate text-[13px] leading-snug text-muted-foreground">
          {mod.description}
        </span>
      </span>
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-all duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
      </span>
    </Link>
  );
}
