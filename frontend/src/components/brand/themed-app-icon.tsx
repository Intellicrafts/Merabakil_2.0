"use client";

import { useSyncExternalStore } from "react";

import type { LogoTone } from "@/components/brand/brand-types";
import { brandAssets, brandUrl } from "@/lib/brand-assets";
import { cn } from "@/lib/utils";

function getDocumentDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

function subscribeToTheme(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

export function ThemedAppIcon({
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
  const isDark = useSyncExternalStore(
    subscribeToTheme,
    getDocumentDark,
    () => false,
  );

  const resolved =
    force === "dark" ? "dark" : force === "light" ? "light" : tone === "dark" ? "dark" : tone === "light" ? "light" : isDark ? "dark" : "light";

  const src = brandUrl(resolved === "dark" ? brandAssets.mark.dark : brandAssets.mark.light);

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={cn("shrink-0 object-contain bg-transparent", className)}
    />
  );
}
