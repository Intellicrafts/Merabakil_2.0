"use client";

import { ThemedAppIcon } from "@/components/brand/themed-app-icon";
import type { BrandLogoSize, BrandLogoVariant, LogoTone } from "@/components/brand/brand-types";
import { cn } from "@/lib/utils";

export type { BrandLogoSize, BrandLogoVariant, LogoTone };

const WORDMARK_SIZE: Record<BrandLogoSize, { wrap: string; mark: string; title: string; tag: string }> = {
  sm: { wrap: "brand-lockup-tight gap-1", mark: "h-7", title: "text-[13.5px]", tag: "text-[8.5px]" },
  md: { wrap: "brand-lockup-tight gap-1", mark: "h-8", title: "text-[15px]", tag: "text-[10px]" },
  lg: { wrap: "brand-lockup-tight gap-1.5", mark: "h-[3.25rem]", title: "text-[1.45rem]", tag: "text-[12px]" },
};

function titleClass(force?: "light" | "dark") {
  if (force === "dark") return "text-white";
  if (force === "light") return "text-slate-900";
  return "text-foreground";
}

function tagClass(force?: "light" | "dark") {
  if (force === "dark") return "text-white/65";
  if (force === "light") return "text-slate-500";
  return "text-muted-foreground";
}

export function AppIcon({
  className,
  alt = "",
  tone = "auto",
  force,
}: {
  className?: string;
  alt?: string;
  tone?: LogoTone;
  force?: "light" | "dark";
}) {
  return <ThemedAppIcon className={className} alt={alt} tone={tone} force={force} />;
}

export function BrandLogo({
  variant = "mark",
  className,
  force,
  size = "md",
  alt = "Mera Bakil",
}: {
  variant?: BrandLogoVariant;
  className?: string;
  force?: "light" | "dark";
  size?: BrandLogoSize;
  alt?: string;
}) {
  if (variant === "app" || variant === "mark") {
    return (
      <span className={cn("brand-mark inline-flex items-center justify-center", className)} role="img" aria-label={alt}>
        <AppIcon alt="" force={force} className="h-full w-full" />
      </span>
    );
  }

  const scale = WORDMARK_SIZE[size];
  return (
    <span
      className={cn("inline-flex items-center", scale.wrap, className)}
      role="img"
      aria-label={alt}
    >
      <AppIcon alt="" force={force} className={cn("brand-mark brand-mark-wordmark", scale.mark, "w-auto")} />
      <span className="flex min-w-0 flex-col justify-center leading-none">
        <span className={cn("font-semibold tracking-tight", scale.title, titleClass(force))}>Mera Bakil</span>
        <span className={cn("mt-1 font-medium tracking-[0.01em]", scale.tag, tagClass(force))}>
          Legal Help. Made Simple.
        </span>
      </span>
    </span>
  );
}
