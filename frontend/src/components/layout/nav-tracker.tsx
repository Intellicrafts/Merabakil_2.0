"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { syncStackToPath, trackNavPath } from "@/lib/nav-history";

/** Keeps a session stack of visited app routes for smart Back navigation. */
export function NavTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) trackNavPath(pathname);
  }, [pathname]);

  useEffect(() => {
    function onPopState() {
      syncStackToPath(window.location.pathname);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return null;
}
