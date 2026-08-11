"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import {
  consumeBackPath,
  getBackLabel,
  markNavigatingBack,
  peekBackPath,
  resolveSmartFallback,
} from "@/lib/nav-history";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  className?: string;
  /** Override when parent module fallback is not enough */
  fallbackHref?: string;
  showLabel?: boolean;
}

export function BackButton({ className, fallbackHref, showLabel = true }: BackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const smartFallback = fallbackHref ?? resolveSmartFallback(pathname);
  const [label, setLabel] = useState("Home");

  useEffect(() => {
    setLabel(getBackLabel(pathname, smartFallback));
  }, [pathname, smartFallback]);

  function handleBack() {
    markNavigatingBack();
    const href = consumeBackPath(pathname, smartFallback);
    router.push(href);
  }

  const target = peekBackPath(pathname, smartFallback);

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={`Back to ${label}`}
      title={`Back to ${label}`}
      className={cn(
        "group relative inline-flex min-h-10 items-center gap-2 overflow-hidden rounded-full border border-black/[0.07] bg-white/75 px-2.5 py-1.5 text-sm font-medium shadow-[0_2px_12px_rgba(15,23,42,0.06)] backdrop-blur-md transition-all duration-300",
        "hover:-translate-x-0.5 hover:border-slate-300/70 hover:bg-white hover:shadow-[0_8px_22px_rgba(15,23,42,0.1)]",
        "active:scale-[0.98] active:shadow-[0_2px_8px_rgba(15,23,42,0.06)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "dark:border-white/10 dark:bg-white/[0.07] dark:hover:border-white/22 dark:hover:bg-white/[0.11]",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-500/[0.04] via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-white/[0.06]"
      />

      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white shadow-[0_2px_8px_rgba(15,23,42,0.25)] transition-transform duration-300 group-hover:-translate-x-0.5 group-hover:scale-105 dark:from-slate-100 dark:via-slate-200 dark:to-slate-300 dark:text-slate-900 dark:shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>

      {showLabel && (
        <span className="relative hidden min-w-0 pr-1.5 sm:block">
          <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
            Back
          </span>
          <span className="block max-w-[8.5rem] truncate text-[13px] font-semibold leading-tight tracking-tight text-foreground">
            {label}
          </span>
        </span>
      )}

      <span className="sr-only">({target})</span>
    </button>
  );
}
