"use client";

import Link from "next/link";
import { Scale } from "lucide-react";

import { FeaturedMotif } from "@/components/dashboard/dashboard-visuals";
import { Skeleton } from "@/components/ui/skeleton";
import type { HeroTheme } from "@/lib/dashboard-config";
import type { LegalSpotlight } from "@/lib/legal-spotlight/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function DashboardHeroVisual({
  theme,
  variant,
  spotlight,
  loading,
  className,
}: {
  theme: HeroTheme;
  variant: "desktop" | "mobile";
  spotlight?: LegalSpotlight | null;
  loading?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const fallbackSrc = theme.visual.src;
  const imageSrc = spotlight?.imageUrl ?? fallbackSrc;
  const isRemote = imageSrc.startsWith("http");
  const showOverlay = Boolean(spotlight && !spotlight.fallback);

  const frameClass =
    variant === "mobile"
      ? cn("dash-hero-mobile-banner dash-hero-spotlight relative overflow-hidden rounded-xl lg:hidden", className)
      : cn(
          "dash-hero-spotlight relative hidden min-h-[220px] overflow-hidden rounded-2xl lg:block",
          "ring-1 ring-black/[0.06] shadow-[0_18px_48px_rgba(80,40,10,0.14)]",
          "dark:ring-white/[0.10] dark:shadow-[0_18px_48px_rgba(0,0,0,0.35)]",
          className,
        );

  if (loading) {
    return <Skeleton className={cn(frameClass, "min-h-[5rem] lg:min-h-[220px]")} />;
  }

  const imageLayer = (
    <>
      <FeaturedMotif className={cn("opacity-30", variant === "desktop" && "opacity-40")} />
      {isRemote ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt=""
          className={cn(
            "dash-hero-spotlight-img absolute inset-0 h-full w-full object-cover",
            variant === "desktop" && "dark:brightness-[0.92]",
          )}
          referrerPolicy="no-referrer"
        />
      ) : theme.visual.type === "svg" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center opacity-90"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.92]"
          style={theme.visual.objectPosition ? { objectPosition: theme.visual.objectPosition } : undefined}
        />
      )}
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          variant === "mobile"
            ? "bg-gradient-to-r from-background/85 via-background/30 to-transparent"
            : "bg-gradient-to-t from-black/55 via-black/10 to-white/10",
        )}
      />
    </>
  );

  const overlay = showOverlay ? (
    <div className="absolute inset-x-0 bottom-0 z-10 p-3 sm:p-4">
      <div className="flex items-start gap-2">
        <span className="dash-hero-spotlight-badge">
          <Scale className="h-3 w-3" strokeWidth={2} />
          {t("dashboard.legalSpotlight")}
        </span>
      </div>
      {spotlight?.sourceUrl ? (
        <Link
          href={spotlight.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block max-w-full text-[12px] font-medium leading-snug text-white drop-shadow-sm transition-opacity hover:opacity-90 sm:text-[13px]"
        >
          {spotlight.topic}
        </Link>
      ) : (
        <p className="mt-2 max-w-full text-[12px] font-medium leading-snug text-white/95 drop-shadow-sm sm:text-[13px]">
          {spotlight?.topic}
        </p>
      )}
      {spotlight?.imageCredit ? (
        <p className="mt-1 text-[10px] text-white/70">{spotlight.imageCredit}</p>
      ) : null}
    </div>
  ) : null;

  return (
    <div className={frameClass} aria-hidden={!showOverlay}>
      {imageLayer}
      {overlay}
    </div>
  );
}
