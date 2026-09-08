"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NAV_START_EVENT } from "@/lib/navigation-feedback";

export function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return;
      const next = href.split("?")[0];
      if (next === pathname) return;
      setActive(true);
    }

    function onNavStart() {
      setActive(true);
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener(NAV_START_EVENT, onNavStart);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(NAV_START_EVENT, onNavStart);
    };
  }, [pathname]);

  useEffect(() => {
    setActive(false);
  }, [pathname]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-0.5 overflow-hidden bg-primary/15"
      aria-hidden
    >
      <div className="h-full w-1/2 animate-[nav-progress_0.9s_ease-in-out_infinite] rounded-full bg-primary" />
    </div>
  );
}
