"use client";

import Script from "next/script";
import { useEffect } from "react";

import { GA_ENABLED, GA_MEASUREMENT_ID } from "@/lib/analytics/constants";
import { updateConsentMode } from "@/lib/analytics/consent-bridge";
import { clearAnalyticsUser } from "@/lib/analytics/track";
import { readConsent } from "@/lib/consent";

/**
 * Consent Mode v2: gtag.js loads when GA is enabled, but analytics_storage stays
 * denied until the user clicks "Accept all". Custom events are also gated in track().
 */
export function GoogleAnalytics() {
  useEffect(() => {
    const consent = readConsent();
    updateConsentMode(consent?.analytics === true);

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
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
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
            allow_google_signals: false,
            allow_ad_personalization_signals: false
          });
        `}
      </Script>
    </>
  );
}
