"use client";

import { useEffect } from "react";

import { applyThemedFavicon } from "@/lib/favicon-theme";

export function FaviconLinks() {
  useEffect(() => {
    applyThemedFavicon();
    const observer = new MutationObserver(applyThemedFavicon);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      if (!localStorage.getItem("legalos.theme")) applyThemedFavicon();
    };
    media.addEventListener("change", onScheme);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", onScheme);
    };
  }, []);
  return null;
}
