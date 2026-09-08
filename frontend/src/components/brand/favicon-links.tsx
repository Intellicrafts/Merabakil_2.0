"use client";

import { useEffect } from "react";

const VERSION = "circ3";

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

function upsertIcon(id: string, href: string, sizes: string) {
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/png";
  link.sizes = sizes;
  link.href = `${href}?v=${VERSION}`;
}

export function applyThemedFavicon() {
  if (typeof document === "undefined") return;
  const tone = isDark() ? "dark" : "light";
  upsertIcon("mb-favicon-32", `/brand/favicon-${tone}-32.png`, "32x32");
  upsertIcon("mb-favicon-16", `/brand/favicon-${tone}-16.png`, "16x16");
  upsertIcon("mb-favicon-48", `/brand/favicon-${tone}-48.png`, "48x48");
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
