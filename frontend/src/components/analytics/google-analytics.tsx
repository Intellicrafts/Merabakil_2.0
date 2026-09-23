"use client";

import Script from "next/script";
import { useEffect } from "react";

import { GA_ENABLED, GA_MEASUREMENT_ID, GOOGLE_ADS_ID } from "@/lib/analytics/constants";
import { updateConsentMode } from "@/lib/analytics/consent-bridge";
import { clearAnalyticsUser } from "@/lib/analytics/track";
import { readConsent } from "@/lib/consent";

/**
 * Consent Mode v2 — opt-out model for India (DPDP Act, not GDPR).
 * analytics_storage AND ad signals default to 'granted' so Google Ads can set
 * the _gcl_aw click cookie and attribute conversions; users opt out via
 * "Necessary only", which downgrades all signals to 'denied'.
 * Only overrides consent mode if the user has already made an explicit choice,
 * so the gtag default is not accidentally revoked for new visitors.
 */
export function GoogleAnalytics() {
  useEffect(() => {
    const consent = readConsent();
    if (consent !== null) {
      updateConsentMode(consent.analytics);
    }

    function onConsentChanged(event: Event) {
      const detail = (event as CustomEvent<{ analytics: boolean }>).detail;
      updateConsentMode(detail.analytics);
      if (!detail.analytics) {
        clearAnalyticsUser();
      }
    }

    window.addEventListener("legalos:consent-changed", onConsentChanged);
    return () => window.removeEventListener("legalos:consent-changed", onConsentChanged);
  }, []);

  if (!GA_ENABLED || !GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script id="ga-consent-defaults" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('consent', 'default', {
            analytics_storage: 'granted',
            ad_storage: 'granted',
            ad_user_data: 'granted',
            ad_personalization: 'granted',
            functionality_storage: 'granted',
            security_storage: 'granted',
            wait_for_update: 500
          });
        `}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            send_page_view: false,
            anonymize_ip: true,
            allow_google_signals: true,
            allow_ad_personalization_signals: true
          });
          ${
            GOOGLE_ADS_ID
              ? `gtag('config', '${GOOGLE_ADS_ID}');`
              : "/* Google Ads tag disabled — set NEXT_PUBLIC_GOOGLE_ADS_ID */"
          }
        `}
      </Script>
    </>
  );
}
