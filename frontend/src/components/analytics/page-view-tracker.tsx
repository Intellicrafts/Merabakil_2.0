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
import { clarityIdentify, claritySetTag } from "@/lib/analytics/clarity";
import { hashUserId } from "@/lib/analytics/user-id";
import { getStoredUser, primaryRole } from "@/lib/api";
import { readConsent } from "@/lib/consent";

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    // Bail only on an explicit opt-out. GA stays hard-gated on `=== true` inside
    // track()/trackPageView(); Clarity runs under the opt-out model and still needs
    // pageviews from visitors who have not answered the banner yet.
    if (readConsent()?.analytics === false) return;

    const search = searchParams.toString();
    captureUtmFromSearch(search ? `?${search}` : "");

    const fullPath = search ? `${pathname}?${search}` : pathname;
    if (lastPath.current === fullPath) return;
    lastPath.current = fullPath;

    const pageType = resolvePageType(pathname);
    const utm = utmAsAnalyticsParams();

    // Clarity stitches a user's journey across devices only when identify() is called
    // per page; custom-page-id is the route so recordings are filterable by section.
    claritySetTag("page_type", pageType);
    const user = getStoredUser();
    if (user) {
      const role = primaryRole(user.roles);
      claritySetTag("user_role", role);
      void hashUserId(user.user_id).then((hashed) =>
        clarityIdentify(hashed, undefined, pathname, role),
      );
    }

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
