"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { useSmartBack } from "@/components/layout/use-smart-back";
import { cn } from "@/lib/utils";

export function BrandLockup({
  isHome,
  pageTitle,
}: {
  isHome: boolean;
  pageTitle?: string;
}) {
  const back = useSmartBack();

  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
      {isHome ? (
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2"
          aria-label="MeraBakil home"
        >
          <BrandLogo variant="mark" className="h-7 w-7" />
          <Wordmark subtitle="Your Legal Saarthi" />
        </Link>
      ) : (
        <>
          <button
            type="button"
            onClick={back.go}
            aria-label={`Back to ${back.label}`}
            title={`Back to ${back.label}`}
            className={cn(
              "group relative inline-flex h-7 shrink-0 items-center overflow-hidden rounded-[0.65rem]",
              "bg-white pl-[3px] pr-px shadow-[0_1px_2px_rgba(42,28,12,0.07)]",
              "ring-1 ring-[hsl(28_14%_68%)]",
              "transition-[box-shadow,background-color] duration-200",
              "hover:bg-[hsl(40_20%_98%)] hover:shadow-[0_4px_12px_rgba(42,28,12,0.08)]",
              "active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2",
              "dark:bg-white/[0.07] dark:ring-white/15 dark:hover:bg-white/[0.11]",
            )}
          >
            <ChevronLeft
              className="h-3.5 w-3.5 shrink-0 text-foreground/55 transition-transform duration-200 group-hover:-translate-x-px group-hover:text-foreground"
              strokeWidth={2.25}
            />
            <BrandLogo variant="mark" className="h-[26px] w-[26px]" />
          </button>
          <Link
            href="/dashboard"
            className="min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15"
            aria-label="MeraBakil home"
          >
            <Wordmark subtitle={pageTitle || `Back to ${back.label}`} />
          </Link>
        </>
      )}
    </div>
  );
}

function Wordmark({ subtitle }: { subtitle: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[13px] font-semibold leading-none tracking-tight">MeraBakil</p>
      <p className="mt-0.5 hidden truncate text-[10px] text-muted-foreground sm:block">{subtitle}</p>
    </div>
  );
}
