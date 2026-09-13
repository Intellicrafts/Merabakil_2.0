"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { hasConsentChoice, writeConsent } from "@/lib/consent";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!hasConsentChoice());
  }, []);

  if (!visible) return null;

  function accept(analytics: boolean) {
    writeConsent(analytics);
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className="fixed inset-x-0 bottom-0 z-[90] border-t border-black/[0.08] bg-background/95 p-4 shadow-lg backdrop-blur-sm dark:border-white/10 sm:p-5"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p id="cookie-consent-title" className="text-sm font-semibold text-foreground">
            Cookies &amp; local storage
          </p>
          <p id="cookie-consent-desc" className="text-sm text-muted-foreground">
            We use local storage for sign-in and theme preferences. With your consent, we also use
            privacy-friendly analytics (Plausible) to improve MeraBakil during beta.{" "}
            <Link href="/privacy" className="font-medium text-primary underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => accept(false)}
          >
            Essential only
          </Button>
          <Button type="button" size="sm" className="rounded-full" onClick={() => accept(true)}>
            Accept analytics
          </Button>
        </div>
      </div>
    </div>
  );
}
