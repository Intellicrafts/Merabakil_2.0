"use client";

import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

export function VerifiedBadge({
  size = "sm",
  showLabel = false,
  className,
}: VerifiedBadgeProps) {
  return (
    <span
      className={cn(
        "mp-trust-check inline-flex items-center gap-1 rounded-full font-semibold",
        "border border-emerald-500/25 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800",
        "shadow-[0_1px_4px_rgba(16,185,129,0.15)]",
        "dark:border-emerald-400/30 dark:from-emerald-950/80 dark:to-teal-950/60 dark:text-emerald-200",
        size === "sm" && "h-5 px-1.5 text-[9px]",
        size === "md" && "h-6 px-2 text-[10px]",
        className,
      )}
      title="Verified advocate"
    >
      <ShieldCheck
        className={cn("shrink-0", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")}
        strokeWidth={2.25}
      />
      {showLabel && <span>Verified</span>}
    </span>
  );
}
