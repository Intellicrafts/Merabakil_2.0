"use client";

import { AlertTriangle, BadgeCheck, Clock3, Landmark, XCircle } from "lucide-react";

import { FIELD_ERROR_BORDER, FormField, fieldProps } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { barCouncilForState, barCouncilName } from "@/lib/bar-councils";
import { cn } from "@/lib/utils";

import { titleCaseName, type SectionProps, type VerificationView } from "./listing-form";
import { LocationFields } from "./location-fields";

const REVIEW_COPY: Record<string, string> = {
  council_not_supported: "We can't check enrolments in your state automatically yet — our team will verify your enrolment.",
  manual_request: "Our team will check your enrolment and confirm it.",
  not_in_roll: "Your enrolment isn't on the Bar Council's published lists yet (common for recent enrolments) — our team will confirm it.",
  name_changed: "Your name changed after verification — our team will re-check it.",
};

export type VerificationControls = {
  view: VerificationView;
  verifying: boolean;
  /** Couldn't reach the Bar Council records (or another temporary failure). */
  error: string | null;
  onVerify: () => void;
  onUseRecordName: (name: string) => void;
  onRequestReview: () => void;
};

/** Office location first (its state decides the Bar Council), then name and enrolment number. */
export function IdentitySection({
  form,
  errors,
  onChange,
  disabled,
  verification,
  adminMode,
  changeWarning,
  showVerifyButton,
  onLookupFailed,
}: SectionProps & {
  verification: VerificationControls;
  adminMode?: boolean;
  /** Edit page: saving these changes sends a verified profile back for checking. */
  changeWarning?: boolean;
  /** Edit page: an explicit Verify button (setup verifies on Continue). */
  showVerifyButton?: boolean;
  onLookupFailed?: () => void;
}) {
  return (
    <div className="space-y-4">
      <LocationFields form={form} errors={errors} onChange={onChange} disabled={disabled} onLookupFailed={onLookupFailed} />

      {form.state.trim() && verification.view.state === "none" && (
        <CouncilLine state={form.state.trim()} adminMode={adminMode} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          id="listing-name"
          label="Name shown to clients"
          hint="Use the name on your Bar Council record — we check it during verification."
          error={errors.fullName}
        >
          <Input
            {...fieldProps("listing-name", { error: errors.fullName, hint: true })}
            value={form.fullName}
            disabled={disabled}
            autoComplete="name"
            onChange={(e) => onChange("fullName", e.target.value)}
            className={cn("h-11 rounded-xl", errors.fullName && FIELD_ERROR_BORDER)}
          />
        </FormField>
        <FormField
          id="listing-enrolment"
          label="Bar Council enrolment number"
          hint="As on your enrolment certificate, e.g. PH/1234/2020, D/105/2005 or UP1234/25."
          error={errors.enrolment}
        >
          <Input
            {...fieldProps("listing-enrolment", { error: errors.enrolment, hint: true })}
            value={form.enrolment}
            disabled={disabled}
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => onChange("enrolment", e.target.value.toUpperCase())}
            className={cn("h-11 rounded-xl font-mono tracking-wide", errors.enrolment && FIELD_ERROR_BORDER)}
          />
        </FormField>
      </div>

      {changeWarning && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          Saving these changes sends {adminMode ? "this advocate's" : "your"} profile for re-verification.
        </p>
      )}

      <VerificationStatus verification={verification} adminMode={adminMode} showVerifyButton={showVerifyButton} />
    </div>
  );
}

/** Which Bar Council the office's state sends the enrolment to. */
function CouncilLine({ state, adminMode }: { state: string; adminMode?: boolean }) {
  const council = barCouncilForState(state);
  return (
    <p className="flex items-start gap-2 text-[12px] text-muted-foreground">
      <Landmark className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
      {council ? (
        <span>
          {adminMode ? "The enrolment is checked with the " : "We'll check your enrolment with the "}
          <span className="font-medium text-foreground">{barCouncilName(council)}</span>, from{" "}
          {adminMode ? "the" : "your"} office&apos;s state.
        </span>
      ) : (
        <span>
          {adminMode
            ? `Enrolments in ${state} are verified by our team.`
            : `We can't check enrolments in ${state} automatically yet — our team will verify yours.`}
        </span>
      )}
    </p>
  );
}

function failureCopy(view: VerificationView): string {
  if (!view.council) return `We couldn't confirm this enrolment${view.message ? `: ${view.message}` : "."}`;
  const council = barCouncilName(view.council);
  if (!view.message || /not found/i.test(view.message)) return `We couldn't find this enrolment with the ${council}.`;
  return `The ${council} couldn't confirm this enrolment: ${view.message}`;
}

function VerificationStatus({
  verification,
  adminMode,
  showVerifyButton,
}: {
  verification: VerificationControls;
  adminMode?: boolean;
  showVerifyButton?: boolean;
}) {
  const { view, verifying, error, onVerify, onUseRecordName, onRequestReview } = verification;
  const linkButton =
    "font-semibold underline underline-offset-2 hover:text-foreground disabled:opacity-50 disabled:no-underline";

  return (
    <div aria-live="polite" className="space-y-3">
      {view.state === "verified" && (
        <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
          <BadgeCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Verified with the {view.council ? barCouncilName(view.council) : "Bar Council"}
            {view.recordName ? ` — record: ${view.recordName}` : ""}.
          </span>
        </p>
      )}

      {view.state === "review" && view.reason === "name_mismatch" && view.recordName && (
        <div className="space-y-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              The Bar Council record is under <strong>“{view.recordName}”</strong>.{" "}
              {adminMode
                ? "Approve or reject it from User management."
                : "Use that spelling to be verified now, or keep yours and our team will review it."}
            </span>
          </p>
          {!adminMode && (
            <button
              type="button"
              disabled={verifying}
              onClick={() => onUseRecordName(titleCaseName(view.recordName!))}
              className={cn("ml-5", linkButton)}
            >
              Use “{titleCaseName(view.recordName)}”
            </button>
          )}
        </div>
      )}

      {view.state === "review" && view.reason !== "name_mismatch" && (
        <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2.5 text-[12px] text-sky-900 dark:bg-sky-900/20 dark:text-sky-200">
          <Clock3 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {REVIEW_COPY[view.reason ?? ""] ?? view.message ?? "Our team is checking your enrolment."}{" "}
            {!adminMode && "You can carry on — you'll go live once it's confirmed."}
          </span>
        </p>
      )}

      {view.state === "failed" && (
        <div className="space-y-2 rounded-xl bg-red-50 px-3 py-2.5 text-[12px] text-red-800 dark:bg-red-900/20 dark:text-red-300">
          <p className="flex items-start gap-2">
            <XCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {failureCopy(view)} Check the number
              {adminMode ? "." : ". If you're enrolled with another State Bar Council, request a manual review."}
            </span>
          </p>
          {!adminMode && (
            <button type="button" disabled={verifying} onClick={onRequestReview} className={cn("ml-5", linkButton)}>
              Request a manual review
            </button>
          )}
        </div>
      )}

      {error && !adminMode && (
        <div role="alert" className="space-y-2 rounded-xl bg-red-50 px-3 py-2.5 text-[12px] text-red-800 dark:bg-red-900/20 dark:text-red-300">
          <p className="flex items-start gap-2">
            <XCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            {error}
          </p>
          <div className="ml-5 flex gap-4">
            <button type="button" disabled={verifying} onClick={onVerify} className={linkButton}>
              Try again
            </button>
            <button type="button" disabled={verifying} onClick={onRequestReview} className={linkButton}>
              Request a manual review
            </button>
          </div>
        </div>
      )}

      {adminMode && view.state !== "verified" && (
        <p className="text-[11px] text-muted-foreground">Verify or approve the enrolment from User management.</p>
      )}

      {showVerifyButton && !adminMode && view.state !== "verified" && (
        <button
          type="button"
          disabled={verifying}
          onClick={onVerify}
          className="mp-btn-accent h-10 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-60"
        >
          {verifying ? "Verifying…" : "Verify enrolment"}
        </button>
      )}
    </div>
  );
}
