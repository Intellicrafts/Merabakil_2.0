"use client";

import Script from "next/script";
import { useEffect } from "react";

import { GA_ENABLED, GA_MEASUREMENT_ID, GOOGLE_ADS_ID } from "@/lib/analytics/constants";
import { updateConsentMode } from "@/lib/analytics/consent-bridge";
import { clearAnalyticsUser, setUserType } from "@/lib/analytics/track";
import { getToken } from "@/lib/api";
import { CONSENT_STORAGE_KEY, readConsent } from "@/lib/consent";

/**
 * Consent Mode v2 — opt-out model for India (DPDP Act, not GDPR).
 * Every signal defaults to 'granted' so Google Ads can set _gcl_au/_gcl_aw and
 * attribute conversions; "Necessary only" downgrades all of them to 'denied'.
 *
 * Everything runs from ONE inline script, in this order, before gtag.js loads:
 *   consent default (honouring a stored "Necessary only") → js → GA4 config → Ads config.
 * No `wait_for_update`: with it the Ads tag parks until a consent update arrives,
 * and in an opt-out model none is needed — that was why AW-… never sent a hit.
 */
function initScript(): string {
  // Ads gets exactly one page_view per page — from trackPageView (initial load and
  // client-side navigations) — so its own automatic one is off. The conversion
  // linker still writes _gcl_au/_gcl_aw on config.
  const adsConfig = GOOGLE_ADS_ID
    ? `gtag('config', '${GOOGLE_ADS_ID}', { send_page_view: false });`
    : "/* Google Ads tag disabled — set NEXT_PUBLIC_GOOGLE_ADS_ID */";
  return `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    var consentState = 'granted';
    var debug = false;
    try {
      var stored = JSON.parse(localStorage.getItem('${CONSENT_STORAGE_KEY}') || 'null');
      if (stored && stored.analytics === false) consentState = 'denied';
      if (/[?&]ga_debug=1\\b/.test(location.search)) localStorage.setItem('legalos.ga_debug', '1');
      if (/[?&]ga_debug=0\\b/.test(location.search)) localStorage.removeItem('legalos.ga_debug');
      debug = localStorage.getItem('legalos.ga_debug') === '1';
    } catch (e) {}
    gtag('consent', 'default', {
      analytics_storage: consentState,
      ad_storage: consentState,
      ad_user_data: consentState,
      ad_personalization: consentState,
      functionality_storage: 'granted',
      security_storage: 'granted'
    });
    gtag('js', new Date());
    var gaConfig = {
      send_page_view: false,
      anonymize_ip: true,
      allow_google_signals: true,
      allow_ad_personalization_signals: true
    };
    if (debug) gaConfig.debug_mode = true; // GA4 DebugView; the key must be absent otherwise
    gtag('config', '${GA_MEASUREMENT_ID}', gaConfig);
    ${adsConfig}
  `;
}

export function GoogleAnalytics() {
  useEffect(() => {
    // Signed-in state is only known client-side.
    setUserType(getToken() ? "registered" : "guest");

    function onConsentChanged(event: Event) {
      const detail = (event as CustomEvent<{ analytics: boolean }>).detail;
      updateConsentMode(detail.analytics);
      if (!detail.analytics) {
        clearAnalyticsUser();
      }
    }

    // A choice made before this page's first hit is already in the consent default;
    // re-applying it is harmless and covers choices made in another tab.
    const consent = readConsent();
    if (consent !== null) updateConsentMode(consent.analytics);

    window.addEventListener("legalos:consent-changed", onConsentChanged);
    return () => window.removeEventListener("legalos:consent-changed", onConsentChanged);
  }, []);

  if (!GA_ENABLED || !GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script id="ga4-init" strategy="afterInteractive">
        {initScript()}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
    </>
  );
}
