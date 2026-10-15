"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";

import {
  activationPromptKind,
  firstIncompleteStep,
  remainingRequiredCount,
  type ActivationPromptKind,
} from "@/components/lawyer-marketplace/listing/listing-form";
import { Button } from "@/components/ui/button";
import { AnalyticsEvents, track } from "@/lib/analytics";
import { getMyLawyerListing } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import type { AuthUser } from "@/lib/types";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "legalos.listing.activation_dismissed";
const STEP_INDEX = { identity: 1, practice: 2, fee: 3 } as const;

function sessionDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(DISMISS_KEY) === "1";
}

function dismissForSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(DISMISS_KEY, "1");
}

export function ProfessionalActivationBanner({ user }: { user: AuthUser | null }) {
  const { t } = useTranslation();
  const isAdvocate = Boolean(user?.roles.includes("advocate"));
  const [kind, setKind] = useState<ActivationPromptKind>(null);
  const [remaining, setRemaining] = useState(0);
  const [step, setStep] = useState(1);
  const [hidden, setHidden] = useState(true);
  const shownRef = useRef(false);

  useEffect(() => {
    if (!isAdvocate) {
      setKind(null);
      setHidden(true);
      return;
    }
    let cancelled = false;
    void getMyLawyerListing()
      .then((row) => {
        if (cancelled) return;
        const next = activationPromptKind(row);
        setKind(next);
        setRemaining(remainingRequiredCount(row));
        const resume = firstIncompleteStep(row);
        setStep(resume ? STEP_INDEX[resume] : 3);
        setHidden(next === null || sessionDismissed());
      })
      .catch(() => {
        if (!cancelled) {
          setKind(null);
          setHidden(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isAdvocate, user?.user_id]);

  useEffect(() => {
    if (hidden || !kind || shownRef.current) return;
    shownRef.current = true;
    track(AnalyticsEvents.LISTING_ACTIVATION_BANNER_SHOWN, {
      profile_type: "advocate",
      prompt_kind: kind,
    });
  }, [hidden, kind]);

  if (hidden || !kind) return null;

  const complete = kind === "complete";
  const remainingLabel =
    remaining <= 0
      ? t("listingActivation.stepOf").replace("{current}", String(step)).replace("{total}", "3")
      : remaining === 1
        ? t("listingActivation.remainingOne")
        : t("listingActivation.remaining").replace("{n}", String(remaining));

  return (
    <aside
      role="status"
      aria-live="polite"
      data-testid="listing-activation-banner"
      className={cn(
        "listing-activation-banner flex flex-col gap-3 rounded-2xl border px-3.5 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4",
        complete
          ? "border-amber-500/25 bg-amber-50/80 dark:border-amber-400/20 dark:bg-amber-950/30"
          : "border-sky-500/20 bg-sky-50/80 dark:border-sky-400/20 dark:bg-sky-950/25",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            complete
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
              : "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200",
          )}
        >
          <Scale className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold tracking-tight text-foreground">
            {complete ? t("listingActivation.title") : t("listingActivation.reviewTitle")}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            {complete ? t("listingActivation.body") : t("listingActivation.reviewBody")}
          </p>
          {complete ? (
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">{remainingLabel}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-stretch md:flex-row">
        <Button
          asChild
          className="h-11 flex-1 rounded-xl px-5 text-[13px] font-semibold sm:min-w-[7.5rem]"
        >
          <Link
            href="/profile?activate=1"
            onClick={() =>
              track(AnalyticsEvents.LISTING_ACTIVATION_BANNER_CLICKED, {
                profile_type: "advocate",
                prompt_kind: kind,
                cta_type: "next",
              })
            }
          >
            {complete ? t("listingActivation.next") : t("listingActivation.viewStatus")}
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 rounded-xl px-4 text-[13px]"
          onClick={() => {
            dismissForSession();
            setHidden(true);
            track(AnalyticsEvents.LISTING_ACTIVATION_BANNER_CLICKED, {
              profile_type: "advocate",
              prompt_kind: kind,
              cta_type: "later",
            });
          }}
        >
          {t("listingActivation.later")}
        </Button>
      </div>
    </aside>
  );
}
