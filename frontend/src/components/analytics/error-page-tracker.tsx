"use client";

import { useEffect } from "react";

import { AnalyticsEvents, track } from "@/lib/analytics";

export function ErrorPageTracker() {
  useEffect(() => {
    track(AnalyticsEvents.ERROR_PAGE_VIEWED, {
      page_path: window.location.pathname,
      error_type: "not_found",
    });
  }, []);

  return null;
}
