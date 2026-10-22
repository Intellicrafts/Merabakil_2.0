"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { RegisterStepIndicator } from "@/components/auth/register-step-indicator";
import { ProfileSectionCard } from "@/components/profile/profile-hero";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AnalyticsEvents, bucketAmount, track } from "@/lib/analytics";
import { ListingValidationError, getMyLawyerListing, upsertMyLawyerListing } from "@/lib/api";
import type { RankedMarketplaceLawyer } from "@/lib/appointment-types";
import { barCouncilForState } from "@/lib/bar-councils";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { ListingActivationCeremony } from "./listing-activation-ceremony";
import { FeeSection } from "./fee-section";
import { firstErrorField, focusField, mapServerFields } from "./focus";
import { IdentitySection } from "./identity-section";
import {
  BIO_MIN_FOR_MATCHING,
  NO_VERIFICATION,
  SETUP_STEPS,
  STEP_FIELDS,
  firstIncompleteStep,
  fromListing,
  toPayload,
  validate,
  verificationOf,
  yearsSinceEnrolment,
  type FieldErrors,
  type ListingField,
  type ListingForm,
  type ListingStep,
} from "./listing-form";
import { PracticeSection } from "./practice-section";
import { useListingVerification } from "./use-listing-verification";

const STEP_INDEX: Record<ListingStep, 1 | 2 | 3> = { identity: 1, practice: 2, fee: 3 };

function stepOf(field: ListingField): ListingStep {
  return (Object.keys(STEP_FIELDS) as ListingStep[]).find((s) => STEP_FIELDS[s].includes(field)) ?? "identity";
}

/** New advocates: three short steps to a live listing. */
export function ListingSetup({
  initialRow,
  fallbackName,
  onFinished,
  tour = false,
}: {
  initialRow: RankedMarketplaceLawyer | null;
  fallbackName: string;
  onFinished: (row: RankedMarketplaceLawyer) => void;
  tour?: boolean;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [row, setRow] = useState(initialRow);
  const [form, setForm] = useState<ListingForm>(() => fromListing(initialRow, fallbackName));
  const [step, setStep] = useState<ListingStep>(() => firstIncompleteStep(initialRow) ?? "fee");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef(form);
  formRef.current = form;
  const startedRef = useRef(false);
  const movedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    track(AnalyticsEvents.LISTING_SETUP_STARTED, { profile_type: "advocate", setup_step: step });
  }, [step]);

  // Experience: start from the years since enrolment (the advocate can change it).
  useEffect(() => {
    if (step !== "practice" || form.years !== "") return;
    const since = yearsSinceEnrolment(form.enrolment);
    if (since != null) setForm((f) => ({ ...f, years: String(since) }));
  }, [step, form.years, form.enrolment]);

  // Focus the new step's heading after moving, so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (movedRef.current) headingRef.current?.focus();
  }, [step, done]);

  const onChange = <K extends ListingField>(field: K, value: ListingForm[K]) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  function go(next: ListingStep) {
    movedRef.current = true;
    setErrors({});
    setStep(next);
  }

  function showErrors(next: FieldErrors) {
    setErrors(next);
    const first = firstErrorField(next);
    if (!first) return;
    if (stepOf(first) !== step) {
      movedRef.current = false;
      setStep(stepOf(first));
    }
    requestAnimationFrame(() => focusField(first));
    track(AnalyticsEvents.LISTING_SAVE_FAILED, { profile_type: "advocate", setup_step: step, error_type: "validation" });
  }

  const refresh = async () => {
    const fresh = await getMyLawyerListing();
    setRow(fresh);
    return fresh;
  };
  const verification = useListingVerification({
    save: upsertMyLawyerListing,
    refresh,
    getForm: () => formRef.current,
    onFieldErrors: (fields) => showErrors(mapServerFields(fields)),
  });
  const view = verificationOf(row);

  async function afterVerification(fresh: RankedMarketplaceLawyer | null) {
    if (!fresh) return;
    const v = verificationOf(fresh);
    // Verified, or with our team: carry on. A name mismatch waits for the advocate's choice.
    if (v.state === "verified" || (v.state === "review" && v.reason !== "name_mismatch")) {
      track(AnalyticsEvents.LISTING_SETUP_STEP_COMPLETED, { profile_type: "advocate", setup_step: "identity" });
      go("practice");
    }
  }

  // Same name and number as the last check (the office no longer affects the council).
  const identityUnchanged =
    (row?.bar_council_id ?? "") === form.enrolment.trim() &&
    (row?.full_name ?? "") === form.fullName.trim();
  const identityAccepted = identityUnchanged && (view.state === "verified" || view.state === "review");
  const locationChanged =
    (row?.pincode ?? "") !== form.pincode ||
    (row?.city ?? "") !== form.city.trim() ||
    (row?.location_state ?? "") !== form.state.trim();

  async function next() {
    const stepErrors = validate(form, step);
    if (Object.keys(stepErrors).length) {
      showErrors(stepErrors);
      return;
    }
    if (step === "identity" && !identityAccepted) {
      await afterVerification(await verification.run());
      return;
    }
    if (step === "identity" && !locationChanged) {
      track(AnalyticsEvents.LISTING_SETUP_STEP_COMPLETED, { profile_type: "advocate", setup_step: "identity" });
      go("practice");
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertMyLawyerListing(toPayload(form, step));
      setRow(saved);
      track(AnalyticsEvents.LISTING_SETUP_STEP_COMPLETED, { profile_type: "advocate", setup_step: step });
      if (step === "identity") {
        go("practice");
      } else if (step === "practice") {
        go("fee");
      } else {
        track(AnalyticsEvents.LISTING_PUBLISHED, {
          profile_type: "advocate",
          price_bucket: bucketAmount(Number(form.fee)),
          reason: saved.listed ? "live" : "awaiting_verification",
        });
        movedRef.current = true;
        setDone(true);
      }
    } catch (err) {
      if (err instanceof ListingValidationError && Object.keys(mapServerFields(err.fields)).length) {
        showErrors(mapServerFields(err.fields));
      } else if (err instanceof ListingValidationError) {
        toast({ title: "Couldn't save", description: err.message, variant: "destructive" });
      } else {
        track(AnalyticsEvents.LISTING_SAVE_FAILED, { profile_type: "advocate", setup_step: step, error_type: "network" });
        toast({
          title: "Couldn't save",
          description: "Check your connection and try again — nothing you entered is lost.",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  if (done && row) {
    return (
      <ListingActivationCeremony
        live={Boolean(row.listed)}
        needsBio={form.bio.trim().length < BIO_MIN_FOR_MATCHING}
        headingRef={headingRef}
        onReview={() => onFinished(row)}
      />
    );
  }

  const meta = SETUP_STEPS[STEP_INDEX[step] - 1];
  const busy = saving || verification.verifying;
  // An office in a state whose council we can't check goes to our team — nothing to verify here.
  const councilUnsupported = Boolean(form.state.trim()) && !barCouncilForState(form.state);
  const primaryLabel =
    step === "identity"
      ? verification.verifying
        ? councilUnsupported
          ? "Saving…"
          : "Verifying…"
        : saving
          ? "Saving…"
          : identityAccepted || councilUnsupported
            ? "Continue"
            : "Verify and continue"
      : saving
        ? "Saving…"
        : step === "fee"
          ? "Finish and go live"
          : "Continue";

  const progress = (STEP_INDEX[step] / 3) * 100;

  return (
    <div className={cn("space-y-4 pb-28 sm:pb-0", tour && "listing-tour")}>
      <ProfileSectionCard>
        <div className="space-y-1 text-center">
          {tour ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("listingActivation.tourEyebrow")}
              </p>
              <p className="text-[15px] font-semibold tracking-tight">
                {t("listingActivation.stepOf")
                  .replace("{current}", String(STEP_INDEX[step]))
                  .replace("{total}", "3")}
              </p>
              <p className="text-[12px] text-muted-foreground">{t("listingActivation.tourSubtitle")}</p>
            </>
          ) : (
            <>
              <p className="text-[15px] font-semibold tracking-tight">Get listed</p>
              <p className="text-[12px] text-muted-foreground">
                3 short steps · about 3 minutes. Clients find you once you&apos;re live.
              </p>
            </>
          )}
        </div>
        {tour ? (
          <div
            className="listing-tour-progress mt-4 h-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={3}
            aria-valuenow={STEP_INDEX[step]}
            aria-label={t("listingActivation.stepOf")
              .replace("{current}", String(STEP_INDEX[step]))
              .replace("{total}", "3")}
          >
            <span
              className="block h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        ) : (
          <div className="mt-4">
            <RegisterStepIndicator
              currentStep={STEP_INDEX[step]}
              labels={[SETUP_STEPS[0].label, SETUP_STEPS[1].label, SETUP_STEPS[2].label]}
            />
          </div>
        )}
      </ProfileSectionCard>

      <ProfileSectionCard>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void next();
          }}
          aria-labelledby="listing-step-title"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Step {STEP_INDEX[step]} of 3
          </p>
          <h2
            id="listing-step-title"
            ref={headingRef}
            tabIndex={-1}
            className="mt-1 text-[17px] font-semibold tracking-tight outline-none"
          >
            {meta.title}
          </h2>
          <p className="mb-5 mt-1 text-[13px] text-muted-foreground">{meta.intro}</p>

          {step === "identity" && (
            <IdentitySection
              form={form}
              errors={errors}
              onChange={onChange}
              disabled={busy}
              onLookupFailed={() =>
                track(AnalyticsEvents.LISTING_SAVE_FAILED, {
                  profile_type: "advocate",
                  setup_step: "identity",
                  error_type: "pincode_lookup",
                })
              }
              verification={{
                view: identityUnchanged ? view : NO_VERIFICATION,
                verifying: verification.verifying,
                error: verification.error,
                onVerify: () => void next(),
                onUseRecordName: (name) => {
                  onChange("fullName", name);
                  void verification.run({ nameOverride: name }).then(afterVerification);
                },
                onRequestReview: () => void verification.run({ manualReview: true }).then(afterVerification),
              }}
            />
          )}
          {step === "practice" && (
            <PracticeSection form={form} errors={errors} onChange={onChange} disabled={busy} />
          )}
          {step === "fee" && <FeeSection form={form} errors={errors} onChange={onChange} disabled={busy} />}

          <div className="mp-profile-sticky-footer mt-6 flex items-center gap-2 sm:justify-between">
            {step !== "identity" ? (
              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-xl px-3 text-[13px]"
                disabled={busy}
                onClick={() => go(step === "fee" ? "practice" : "identity")}
              >
                <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
                Back
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            <Button
              type="submit"
              disabled={busy}
              className="mp-btn-accent h-11 flex-1 rounded-xl text-[13px] font-semibold sm:min-w-[12rem] sm:flex-none"
            >
              {primaryLabel}
            </Button>
          </div>
        </form>
      </ProfileSectionCard>
    </div>
  );
}
