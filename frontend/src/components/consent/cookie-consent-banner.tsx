"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Cookie } from "lucide-react";

import { Button } from "@/components/ui/button";
import { hasConsentChoice, writeConsent } from "@/lib/consent";
import { useTranslation } from "@/lib/i18n";

export function CookieConsentBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisible(!hasConsentChoice());

    function onReset() {
      setVisible(true);
    }

    window.addEventListener("legalos:consent-reset", onReset);
    return () => window.removeEventListener("legalos:consent-reset", onReset);
  }, []);

  // While the banner is up, publish its height as a CSS var + a marker class so
  // pages with a bottom-docked composer (Saarthi) can reserve space and never
  // get overlapped. Docked at the bottom on all sizes, so it never covers the
  // top header/headline and header controls stay clickable.
  useEffect(() => {
    const root = document.documentElement;
    if (!visible) {
      root.classList.remove("cookie-banner-visible");
      root.style.removeProperty("--cookie-banner-h");
      return;
    }
    root.classList.add("cookie-banner-visible");
    const measure = () => {
      const h = cardRef.current?.offsetHeight ?? 0;
      root.style.setProperty("--cookie-banner-h", `${h + 24}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (cardRef.current) ro.observe(cardRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      root.classList.remove("cookie-banner-visible");
      root.style.removeProperty("--cookie-banner-h");
    };
  }, [visible]);

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
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] p-3 sm:p-5"
    >
      <div
        ref={cardRef}
        className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-black/[0.08] bg-background/95 p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md dark:border-white/10 dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-muted-foreground dark:bg-white/[0.06]"
            aria-hidden
          >
            <Cookie className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 space-y-0.5">
            <p id="cookie-consent-title" className="text-[13px] font-semibold text-foreground">
              {t("consent.title")}
            </p>
            <p id="cookie-consent-desc" className="text-[12px] leading-relaxed text-muted-foreground">
              {t("consent.description")}{" "}
              <Link
                href="/privacy"
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {t("consent.privacyPolicy")}
              </Link>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 flex-1 rounded-lg px-3 text-[13px] text-muted-foreground hover:text-foreground sm:flex-none sm:px-4"
            onClick={() => accept(false)}
          >
            {t("consent.necessaryOnly")}
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-9 flex-1 rounded-lg px-4 text-[13px] font-medium sm:flex-none sm:px-5"
            onClick={() => accept(true)}
          >
            {t("consent.acceptAll")}
          </Button>
        </div>
      </div>
    </div>
  );
}
