"use client";

import Link from "next/link";

import type { DashboardModule } from "@/lib/dashboard-config";
import { getModuleMeta } from "@/lib/dashboard-meta";
import { cn } from "@/lib/utils";

export function DashboardQuickLaunch({
  modules,
  variant = "mobile",
}: {
  modules: DashboardModule[];
  variant?: "mobile" | "desktop";
}) {
  const items = modules.slice(0, variant === "desktop" ? 8 : 4);
  if (items.length === 0) return null;

  if (variant === "desktop") {
    return (
      <div className="mb-4 hidden gap-2 sm:flex" aria-label="Quick launch">
        {items.map((mod) => {
          const Icon = mod.icon;
          const meta = getModuleMeta(mod.href);
          return (
            <Link
              key={mod.href}
              href={mod.href}
              title={mod.title}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full border border-black/[0.06] bg-white/70 px-3",
                "text-[12px] font-medium tracking-tight text-foreground/80",
                "shadow-[0_2px_10px_rgba(15,23,42,0.03)] backdrop-blur-md",
                "transition-colors hover:border-black/[0.10] hover:bg-white hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/35 focus-visible:ring-offset-2",
                "dark:border-white/[0.08] dark:bg-white/[0.05] dark:hover:border-white/[0.14]",
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              {meta.shortLabel}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <section
      className="dash-card-in sm:hidden"
      style={{ animationDelay: "60ms" }}
      aria-label="Quick launch"
    >
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Quick launch
        </h2>
      </div>
      <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 no-scrollbar snap-x snap-mandatory">
        {items.map((mod) => {
          const Icon = mod.icon;
          const meta = getModuleMeta(mod.href);
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className={cn(
                "snap-start flex min-h-[88px] min-w-[76px] flex-col items-center justify-center gap-2 rounded-2xl px-3 py-3",
                "border border-black/[0.06] bg-white/70 shadow-[0_4px_16px_rgba(15,23,42,0.04)] backdrop-blur-md",
                "active:scale-[0.97] transition-transform duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/35",
                "dark:border-white/[0.08] dark:bg-white/[0.05]",
                `dash-module-tint-${meta.tint}`,
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.06] bg-white/80 dark:border-white/10 dark:bg-white/[0.08]">
                <Icon className="h-[18px] w-[18px] text-foreground/80" strokeWidth={1.75} />
              </span>
              <span className="max-w-[4.5rem] truncate text-center text-[11px] font-semibold tracking-tight">
                {meta.shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
