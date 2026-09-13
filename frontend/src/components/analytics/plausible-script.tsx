"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

import { readConsent } from "@/lib/consent";

const DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const ENABLED = process.env.NEXT_PUBLIC_PLAUSIBLE_ENABLED === "true";

export function PlausibleScript() {
  const [loadAnalytics, setLoadAnalytics] = useState(false);

  useEffect(() => {
    function sync() {
      const consent = readConsent();
      setLoadAnalytics(Boolean(consent?.analytics));
    }
    sync();
    window.addEventListener("legalos:consent-changed", sync);
    return () => window.removeEventListener("legalos:consent-changed", sync);
  }, []);

  if (!ENABLED || !DOMAIN || !loadAnalytics) return null;

  return (
    <Script
      defer
      data-domain={DOMAIN}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}

/** Fire a custom Plausible event (no-op if analytics not loaded). */
export function trackEvent(name: string, props?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  const plausible = (window as Window & { plausible?: (event: string, opts?: { props?: Record<string, unknown> }) => void }).plausible;
  if (!plausible) return;
  plausible(name, props ? { props } : undefined);
}
