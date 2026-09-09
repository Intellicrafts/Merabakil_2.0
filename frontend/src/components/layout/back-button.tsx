"use client";

import { ChevronLeft } from "lucide-react";

import { useSmartBack } from "@/components/layout/use-smart-back";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  className?: string;
  fallbackHref?: string;
}

/** Compact back control for screens that do not use the global brand lockup. */
export function BackButton({ className, fallbackHref }: BackButtonProps) {
  const { go, label } = useSmartBack(fallbackHref);

  return (
    <button
      type="button"
      onClick={go}
      aria-label={`Back to ${label}`}
      title={`Back to ${label}`}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full",
        "text-foreground/70 transition-colors",
        "hover:bg-black/[0.04] hover:text-foreground",
        "active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15",
        "dark:hover:bg-white/[0.08]",
        className,
      )}
    >
      <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
    </button>
  );
}
