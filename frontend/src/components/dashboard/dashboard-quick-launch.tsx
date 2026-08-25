"use client";

import Link from "next/link";

import type { DashboardModule } from "@/lib/dashboard-config";
import { getModuleMeta } from "@/lib/dashboard-meta";
import { cn } from "@/lib/utils";

export function DashboardQuickLaunch({
  modules,
}: {
  modules: DashboardModule[];
}) {
  const items = modules.slice(0, 6);
  if (items.length === 0) return null;

  return (
    <section
      className="dash-card-in md:hidden"
      style={{ animationDelay: "60ms" }}
      aria-label="Apps"
    >
      <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 no-scrollbar snap-x snap-mandatory">
        {items.map((mod) => {
          const Icon = mod.icon;
          const meta = getModuleMeta(mod.href);
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className={cn(
                "snap-start flex min-h-[96px] min-w-[80px] flex-col items-center justify-center gap-2 rounded-2xl px-3 py-3",
                "border border-black/[0.06] bg-white/80 shadow-[0_4px_16px_rgba(15,23,42,0.04)] backdrop-blur-md",
                "active:scale-[0.97] transition-transform duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                "dark:border-white/[0.08] dark:bg-white/[0.05]",
                `dash-module-tint-${meta.tint}`,
              )}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/[0.06] bg-white/90 dark:border-white/10 dark:bg-white/[0.08]">
                <Icon className="h-5 w-5 text-foreground/80" strokeWidth={1.75} />
              </span>
              <span className="max-w-[4.75rem] truncate text-center text-[12px] font-semibold tracking-tight">
                {meta.shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
