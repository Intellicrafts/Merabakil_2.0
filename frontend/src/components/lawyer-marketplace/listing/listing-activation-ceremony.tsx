"use client";

import Link from "next/link";
import type { RefObject } from "react";
import { BadgeCheck, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ListingActivationCeremony({
  live,
  needsBio,
  headingRef,
  onReview,
}: {
  live: boolean;
  needsBio: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onReview: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="listing-ceremony fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="listing-ceremony-title"
      data-testid="listing-activation-ceremony"
    >
      <div className="listing-ceremony-card relative w-full max-w-md overflow-hidden rounded-t-[1.6rem] border border-black/[0.08] bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 shadow-[0_-12px_60px_rgba(15,23,42,0.18)] dark:border-white/10 sm:rounded-[1.4rem] sm:px-7 sm:pb-7 sm:shadow-[0_16px_60px_rgba(15,23,42,0.22)]">
        <div className="listing-ceremony-burst" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} style={{ ["--i" as string]: i }} />
          ))}
        </div>
        <div className="relative flex flex-col items-center text-center">
          <span
            className={cn(
              "listing-ceremony-mark mb-4 flex h-16 w-16 items-center justify-center rounded-full",
              live
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
            )}
          >
            {live ? <BadgeCheck className="h-8 w-8" aria-hidden /> : <Clock3 className="h-8 w-8" aria-hidden />}
          </span>
          <h2
            id="listing-ceremony-title"
            ref={headingRef}
            tabIndex={-1}
            className="text-[22px] font-semibold tracking-tight outline-none"
          >
            {live ? t("listingActivation.ceremonyLiveTitle") : t("listingActivation.ceremonyPendingTitle")}
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            {live ? t("listingActivation.ceremonyLiveBody") : t("listingActivation.ceremonyPendingBody")}
          </p>
          {needsBio ? (
            <p className="mt-3 text-[12px] leading-snug text-muted-foreground">
              {t("listingActivation.ceremonyBioTip")}
            </p>
          ) : null}
          <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
            <Button asChild className="mp-btn-accent h-11 flex-1 rounded-xl text-[13px] font-semibold">
              <Link href="/dashboard">{t("listingActivation.goDashboard")}</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 rounded-xl text-[13px]"
              onClick={onReview}
            >
              {t("listingActivation.reviewListing")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
