"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";

import { ProfileSectionCard } from "@/components/profile/profile-hero";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { AnalyticsEvents, track } from "@/lib/analytics";
import {
  ListingValidationError,
  adminGetLawyerListing,
  adminSaveLawyerListing,
  getMyLawyerListing,
  upsertMyLawyerListing,
  type LawyerListingInput,
} from "@/lib/api";
import type { RankedMarketplaceLawyer } from "@/lib/appointment-types";

import { FeeSection } from "./fee-section";
import { FIELD_IDS, firstErrorField, focusField, mapServerFields } from "./focus";
import { IdentitySection } from "./identity-section";
import {
  describeRequired,
  fieldsChanged,
  fromListing,
  toPayload,
  validate,
  verificationOf,
  yearsSinceEnrolment,
  type FieldErrors,
  type ListingField,
  type ListingForm,
} from "./listing-form";
import { ListingStatusPanel } from "./listing-status-panel";
import { PracticeSection } from "./practice-section";
import { useListingVerification } from "./use-listing-verification";

const FIELD_NAMES: Record<ListingField, string> = {
  fullName: "Name",
  enrolment: "Enrolment number",
  pincode: "Pincode",
  city: "City",
  state: "State",
  years: "Years of experience",
  practiceAreas: "Practice areas",
  courts: "Courts",
  languages: "Languages",
  fee: "Consultation fee",
  bio: "About your practice",
};

/** Prefill experience from the enrolment year when it was never filled in. */
function withExperienceSuggestion(form: ListingForm): ListingForm {
  if (form.years !== "") return form;
  const since = yearsSinceEnrolment(form.enrolment);
  return since == null ? form : { ...form, years: String(since) };
}

/** Live listings, advocates listed before the rules, and admins: everything on one page. */
export function ListingEditForm({
  initialRow,
  fallbackName,
  advocateUserId,
  onSaved,
}: {
  initialRow: RankedMarketplaceLawyer | null;
  fallbackName: string;
  /** Admin mode: edit this advocate's listing. */
  advocateUserId?: string;
  onSaved?: () => void;
}) {
  const adminMode = Boolean(advocateUserId);
  const { toast } = useToast();
  const [row, setRow] = useState(initialRow);
  const [baseline, setBaseline] = useState<ListingForm>(() => fromListing(initialRow, fallbackName));
  const [form, setForm] = useState<ListingForm>(() => withExperienceSuggestion(baseline));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [summary, setSummary] = useState(false);
  const [saving, setSaving] = useState(false);
  const formRef = useRef(form);
  formRef.current = form;

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);
  const view = verificationOf(row);
  const identityChanged = form.fullName.trim() !== baseline.fullName || form.enrolment.trim() !== baseline.enrolment;

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const onChange = <K extends ListingField>(field: K, value: ListingForm[K]) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  };

  const save = (body: LawyerListingInput) =>
    adminMode ? adminSaveLawyerListing(advocateUserId!, body) : upsertMyLawyerListing(body);
  const refresh = async () => {
    const fresh = adminMode ? await adminGetLawyerListing(advocateUserId!) : await getMyLawyerListing();
    if (fresh) setRow(fresh);
    return fresh as RankedMarketplaceLawyer;
  };

  function showErrors(next: FieldErrors) {
    setErrors(next);
    setSummary(true);
    const first = firstErrorField(next);
    if (first) requestAnimationFrame(() => focusField(first));
    track(AnalyticsEvents.LISTING_SAVE_FAILED, { profile_type: "advocate", error_type: "validation" });
  }

  const verification = useListingVerification({
    save,
    refresh: async () => {
      const fresh = await refresh();
      // The identity part is now saved — keep the rest of the edits.
      setBaseline((b) => ({ ...b, fullName: formRef.current.fullName.trim(), enrolment: formRef.current.enrolment.trim() }));
      return fresh;
    },
    getForm: () => formRef.current,
    onFieldErrors: (fields) => showErrors(mapServerFields(fields)),
  });

  async function handleSave() {
    const found = validate(form, "all");
    if (Object.keys(found).length) {
      showErrors(found);
      return;
    }
    setSaving(true);
    try {
      const saved = await save(toPayload(form, "all"));
      const fresh = fromListing(saved, fallbackName);
      setRow(saved);
      track(AnalyticsEvents.PROFILE_SAVED, {
        profile_type: "advocate",
        fields_changed_count: fieldsChanged(baseline, form),
      });
      setBaseline(fresh);
      setForm(fresh);
      setErrors({});
      setSummary(false);
      toast({
        title: "Changes saved",
        description: saved.listed
          ? "Your listing is up to date."
          : saved.missing_required?.length
            ? `Not live yet — add ${describeRequired(saved.missing_required)}.`
            : "Saved. The listing goes live once the enrolment is confirmed.",
        variant: "success",
      });
      onSaved?.();
    } catch (err) {
      if (err instanceof ListingValidationError && Object.keys(mapServerFields(err.fields)).length) {
        showErrors(mapServerFields(err.fields));
      } else if (err instanceof ListingValidationError) {
        toast({ title: "Couldn't save", description: err.message, variant: "destructive" });
      } else {
        track(AnalyticsEvents.LISTING_SAVE_FAILED, { profile_type: "advocate", error_type: "network" });
        toast({
          title: "Couldn't save",
          description: "Check your connection and try again — your changes are still here.",
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  const errorList = (Object.keys(errors) as ListingField[]).filter((f) => errors[f]);
  const busy = saving || verification.verifying;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
      className="space-y-4 pb-28 sm:pb-0"
      aria-label={adminMode ? "Advocate listing" : "Your listing"}
    >
      <ListingStatusPanel row={row} adminMode={adminMode} />

      {summary && errorList.length > 0 && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-red-800 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {errorList.length === 1 ? "1 detail needs attention" : `${errorList.length} details need attention`}
          </p>
          <ul className="mt-1.5 space-y-0.5 pl-6 text-[12px] text-red-800 dark:text-red-300">
            {errorList.map((field) => (
              <li key={field}>
                <a
                  href={`#${FIELD_IDS[field]}`}
                  onClick={(e) => {
                    e.preventDefault();
                    focusField(field);
                  }}
                  className="underline underline-offset-2"
                >
                  {FIELD_NAMES[field]}
                </a>
                : {errors[field]}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ProfileSectionCard title="Identity and verification">
        <IdentitySection
          form={form}
          errors={errors}
          onChange={onChange}
          disabled={busy}
          adminMode={adminMode}
          changeWarning={view.state === "verified" && identityChanged}
          showVerifyButton
          verification={{
            view: identityChanged ? { state: "none", reason: null, recordName: null, message: null } : view,
            verifying: verification.verifying,
            councilPrompt: verification.councilPrompt,
            council: verification.council,
            onCouncilChange: (value) => void verification.chooseCouncil(value),
            error: verification.error,
            onVerify: () => {
              const found = validate(form, "identity");
              if (Object.keys(found).length) showErrors(found);
              else void verification.run();
            },
            onUseRecordName: (name) => {
              onChange("fullName", name);
              void verification.run({ nameOverride: name });
            },
            onRequestReview: () => void verification.run({ manualReview: true }),
          }}
        />
      </ProfileSectionCard>

      <ProfileSectionCard title="Your practice">
        <PracticeSection
          form={form}
          errors={errors}
          onChange={onChange}
          disabled={busy}
          onLookupFailed={() =>
            track(AnalyticsEvents.LISTING_SAVE_FAILED, { profile_type: "advocate", error_type: "pincode_lookup" })
          }
        />
      </ProfileSectionCard>

      <ProfileSectionCard title="Fee and about you">
        <FeeSection form={form} errors={errors} onChange={onChange} disabled={busy} />
      </ProfileSectionCard>

      <div className="mp-profile-sticky-footer flex items-center justify-between gap-3">
        <p aria-live="polite" className="text-[12px] text-muted-foreground">
          {saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}
        </p>
        <Button
          type="submit"
          disabled={busy || !dirty}
          className="mp-btn-accent h-11 rounded-xl px-6 text-[13px] font-semibold sm:min-w-[10rem]"
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
