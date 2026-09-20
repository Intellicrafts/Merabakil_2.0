"use client";

import { useEffect } from "react";

const VERSION = "circ3";

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

function upsertIcon(id: string, href: string) {
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/svg+xml";
  link.href = `${href}?v=${VERSION}`;
}

export function applyThemedFavicon() {
  if (typeof document === "undefined") return;
  const tone = isDark() ? "dark" : "normal";
  upsertIcon("mb-favicon-svg", `/brand/favicon_${tone}.svg`);
}

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
