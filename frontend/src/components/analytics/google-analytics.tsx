"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

import { GA_ENABLED, GA_MEASUREMENT_ID } from "@/lib/analytics/constants";
import { initConsentModeDefaults, updateConsentMode } from "@/lib/analytics/consent-bridge";
import { clearAnalyticsUser } from "@/lib/analytics/track";
import { readConsent } from "@/lib/consent";

export function GoogleAnalytics() {
  const [loadScript, setLoadScript] = useState(false);

  useEffect(() => {
    initConsentModeDefaults();
    const consent = readConsent();
    if (consent?.analytics) {
      updateConsentMode(true);
      setLoadScript(true);
    }

    function onConsentChanged(event: Event) {
      const detail = (event as CustomEvent<{ analytics: boolean }>).detail;
      updateConsentMode(detail.analytics);
      if (detail.analytics) {
        setLoadScript(true);
      } else {
        clearAnalyticsUser();
      }
    }

    window.addEventListener("legalos:consent-changed", onConsentChanged);
    return () => window.removeEventListener("legalos:consent-changed", onConsentChanged);
  }, []);

  if (!GA_ENABLED || !GA_MEASUREMENT_ID) return null;

  return (
    <>
      {loadScript ? (
        <>
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
      ) : null}
    </>
  );
}
