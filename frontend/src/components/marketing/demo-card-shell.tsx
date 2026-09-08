"use client";

import type { ReactNode } from "react";

import { AppIcon } from "@/components/brand/brand-logo";
import { cn } from "@/lib/utils";

interface DemoCardShellProps {
  variant?: "full" | "minimal" | "premium";
  icon?: ReactNode;
  title?: string;
  subtitle?: string;
  badge?: string;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Demo surface wrapper.
 * `premium` is the Saarthi counsel preview (branded icon + glass card).
 * `full` is the older header + footer chrome.
 * `minimal` is content-only for the home hero showcase.
 */
export function DemoCardShell({
  variant = "full",
  icon,
  title,
  subtitle,
  badge = "Live preview",
  footer,
  children,
  className,
}: DemoCardShellProps) {
  if (variant === "minimal") {
    return (
      <div className={cn("demo-surface relative h-full w-full select-none", className)}>
        <div className="relative h-full">{children}</div>
      </div>
    );
  }

  const branded = variant === "premium";

  return (
    <div className={cn("demo-surface relative w-full select-none", className)}>
      <div
        className={cn(
          "demo-surface-float relative",
          branded &&
            "rounded-[28px] border border-black/[0.06] bg-white/80 p-4 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/75 sm:p-5",
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            {branded ? (
              <div className="relative shrink-0">
                <AppIcon className="h-11 w-11 sm:h-12 sm:w-12" alt="" />
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950">
                  <span className="demo-live-pulse absolute inset-0 rounded-full bg-emerald-400" />
                </span>
              </div>
            ) : (
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900 sm:h-10 sm:w-10 sm:rounded-2xl">
                {icon}
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background">
                  <span className="demo-live-pulse absolute inset-0 rounded-full bg-emerald-400" />
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight sm:text-[15px]">{title}</p>
              <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{subtitle}</p>
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
              branded
                ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                : "border border-emerald-500/15 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300",
            )}
          >
            {badge}
          </span>
        </div>

        <div className="relative">{children}</div>

        {footer && (
          <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground/80 sm:mt-4 sm:text-[11px]">
            {footer}
          </p>
        )}
      </div>
    </div>
  );
}
