"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  AnalyticsEvents,
  captureUtmFromSearch,
  resolvePageType,
  track,
  trackFeatureDiscovery,
  trackPageView,
  utmAsAnalyticsParams,
} from "@/lib/analytics";
import { readConsent } from "@/lib/consent";

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (readConsent()?.analytics !== true) return;

    const search = searchParams.toString();
    captureUtmFromSearch(search ? `?${search}` : "");

    const fullPath = search ? `${pathname}?${search}` : pathname;
    if (lastPath.current === fullPath) return;
    lastPath.current = fullPath;

    const pageType = resolvePageType(pathname);
    const utm = utmAsAnalyticsParams();

    trackPageView({
      page_path: pathname,
      page_title: document.title,
      page_type: pageType,
      ...utm,
    });

    trackFeatureDiscovery(pageType);

    if (pathname === "/") {
      track(AnalyticsEvents.LANDING_PAGE_VIEWED, { page_type: "marketing_landing", ...utm });
    }
    if (pathname === "/privacy" || pathname === "/terms") {
      track(AnalyticsEvents.LEGAL_PAGE_VIEWED, { page_type: "legal", page_path: pathname });
    }
    if (pathname === "/faq") {
      track(AnalyticsEvents.FAQ_OPENED, { page_type: "faq" });
    }
  }, [pathname, searchParams]);

  return null;
}
