"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DemoCardShellProps {
  variant?: "full" | "minimal";
  icon?: ReactNode;
  title?: string;
  subtitle?: string;
  badge?: string;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Demo surface wrapper. `full` includes module header + footer (spotlight section).
 * `minimal` is content-only for the home hero showcase.
 */
export function DemoCardShell({
  variant = "full",
  icon,
  title,
  subtitle,
  badge = "Live demo",
  footer,
  children,
  className,
}: DemoCardShellProps) {
  if (variant === "minimal") {
    return (
      <div className={cn("demo-surface relative w-full select-none", className)}>
        <div className="relative">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn("demo-surface relative w-full select-none", className)}>
      <div className="demo-surface-float relative">
        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900 sm:h-10 sm:w-10 sm:rounded-2xl">
              {icon}
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background">
                <span className="demo-live-pulse absolute inset-0 rounded-full bg-emerald-400" />
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight sm:text-[15px]">{title}</p>
              <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{subtitle}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-emerald-500/15 bg-emerald-500/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            {badge}
          </span>
        </div>

        <div className="relative">{children}</div>

        {footer && (
          <p className="mt-3 text-center text-[10px] text-muted-foreground/70 sm:mt-4 sm:text-[11px]">
            {footer}
          </p>
        )}
      </div>
    </div>
  );
}
