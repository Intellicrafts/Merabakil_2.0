"use client";

import Script from "next/script";
import { useEffect } from "react";

import { clarityConsent, clarityRevoke } from "@/lib/analytics/clarity";
import { CLARITY_ENABLED, CLARITY_PROJECT_ID } from "@/lib/analytics/constants";
import { readConsent } from "@/lib/consent";

/**
 * Microsoft Clarity — session replay, heatmaps, rage/dead-click detection.
 *
 * Opt-out model for India (DPDP Act), matching GoogleAnalytics: the tag loads on every
 * visit. Before the user chooses, Clarity runs in no-consent mode — no cookies, a fresh
 * id per page view. "Accept all" grants analytics_Storage; "Necessary only" revokes and
 * erases the cookies.
 *
 * Sensitive content is masked at the element level via CLARITY_MASK, so recordings
 * never carry chat, documents, case details or personal identifiers.
 */
export function MicrosoftClarity() {
  useEffect(() => {
    // Undecided (null) is treated as denied: recording continues, cookies do not.
    clarityConsent(readConsent()?.analytics === true);

    function onConsentChanged(event: Event) {
      const detail = (event as CustomEvent<{ analytics: boolean }>).detail;
      clarityConsent(detail.analytics);
      if (!detail.analytics) clarityRevoke();
    }

    window.addEventListener("legalos:consent-changed", onConsentChanged);
    return () => window.removeEventListener("legalos:consent-changed", onConsentChanged);
  }, []);

  if (!CLARITY_ENABLED || !CLARITY_PROJECT_ID) return null;

  return (
    <Script id="clarity-init" strategy="afterInteractive">
      {`
        (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
      `}
    </Script>
  );
}
