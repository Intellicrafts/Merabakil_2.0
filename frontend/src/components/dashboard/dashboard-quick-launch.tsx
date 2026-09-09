"use client";

import Link from "next/link";

import type { DashboardModule } from "@/lib/dashboard-config";
import { getModuleMeta } from "@/lib/dashboard-meta";
import { markNavigationStart } from "@/lib/navigation-feedback";
import { cn } from "@/lib/utils";

export function DashboardQuickLaunch({
  modules,
}: {
  modules: DashboardModule[];
}) {
  if (modules.length === 0) return null;

  return (
    <section className="dash-card-in sm:hidden" aria-label="Services">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Services
      </p>
      <div className="grid grid-cols-4 gap-x-2 gap-y-4">
        {modules.map((mod) => {
          const Icon = mod.icon;
          const meta = getModuleMeta(mod.href);
          return (
            <Link
              key={mod.href}
              href={mod.href}
              onClick={() => markNavigationStart()}
              className="group flex flex-col items-center gap-2 text-center active:scale-[0.96]"
            >
              <span
                className={cn(
                  "relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.2rem]",
                  "border border-[hsl(28_14%_76%)] bg-white",
                  "shadow-[0_6px_16px_rgba(42,28,12,0.06)]",
                  "transition-transform duration-150 group-active:scale-95",
                  "dark:border-white/[0.10] dark:bg-white/[0.06] dark:shadow-[0_8px_18px_rgba(0,0,0,0.28)]",
                )}
              >
                <Icon className="relative z-[1] h-[22px] w-[22px] text-foreground/85" strokeWidth={1.7} />
              </span>
              <span className="max-w-[4.6rem] truncate text-[11px] font-medium leading-tight tracking-tight text-foreground/80">
                {meta.shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
