"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { getCLS, getFCP, getLCP, getTTFB } from "web-vitals";

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
  const cwvTrackedRef = useRef(false);

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

  useEffect(() => {
    if (readConsent()?.analytics !== true || cwvTrackedRef.current) return;
    cwvTrackedRef.current = true;

    getCLS((metric) => {
      track("web_vital_cls", {
        score: Math.round(metric.value * 10000) / 10000,
        rating: metric.rating || "unknown",
      } as any);
    });
    getFCP((metric) => {
      track("web_vital_fcp", {
        score: Math.round(metric.value),
        rating: metric.rating || "unknown",
      } as any);
    });
    getLCP((metric) => {
      track("web_vital_lcp", {
        score: Math.round(metric.value),
        rating: metric.rating || "unknown",
      } as any);
    });
    getTTFB((metric) => {
      track("web_vital_ttfb", {
        score: Math.round(metric.value),
        rating: metric.rating || "unknown",
      } as any);
    });
  }, []);

  return null;
}
