"use client";

import { useEffect } from "react";

function upsertIcon(id: string, href: string, sizes?: string) {
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/png";
  if (sizes) link.sizes = sizes;
  link.href = href;
}

export function FaviconLinks() {
  useEffect(() => {
    const apply = () => {
      const dark = document.documentElement.classList.contains("dark");
      const tone = dark ? "dark" : "light";
      upsertIcon("mb-favicon-32", `/brand/favicon-${tone}-32.png`, "32x32");
      upsertIcon("mb-favicon-48", `/brand/favicon-${tone}-48.png`, "48x48");
      upsertIcon("mb-favicon-16", `/brand/favicon-${tone}-16.png`, "16x16");
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return null;
}
