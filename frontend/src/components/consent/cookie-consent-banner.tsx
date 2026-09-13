"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";

import { Button } from "@/components/ui/button";
import { hasConsentChoice, writeConsent } from "@/lib/consent";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!hasConsentChoice());

    function onReset() {
      setVisible(true);
    }

    window.addEventListener("legalos:consent-reset", onReset);
    return () => window.removeEventListener("legalos:consent-reset", onReset);
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
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] p-4 sm:p-5"
    >
      <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-black/[0.08] bg-background/95 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md dark:border-white/10 dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-muted-foreground dark:bg-white/[0.06]"
            aria-hidden
          >
            <Cookie className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 space-y-1">
            <p id="cookie-consent-title" className="text-sm font-semibold text-foreground">
              We use cookies
            </p>
            <p id="cookie-consent-desc" className="text-[13px] leading-relaxed text-muted-foreground">
              Essential cookies keep you signed in and remember your preferences. Optional analytics
              help us improve MeraBakil.{" "}
              <Link
                href="/privacy"
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 rounded-lg px-4 text-[13px] text-muted-foreground hover:text-foreground"
            onClick={() => accept(false)}
          >
            Necessary only
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-lg px-5 text-[13px] font-medium"
            onClick={() => accept(true)}
          >
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
