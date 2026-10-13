"use client";

import { AlertTriangle, BadgeCheck, Clock3, XCircle } from "lucide-react";

import { FIELD_ERROR_BORDER, FormField, fieldProps } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { BAR_COUNCILS } from "@/lib/bar-councils";
import { cn } from "@/lib/utils";

import { titleCaseName, type SectionProps, type VerificationView } from "./listing-form";

const REVIEW_COPY: Record<string, string> = {
  council_not_supported: "We can't check this Bar Council automatically yet — our team will verify your enrolment.",
  manual_request: "Our team will check your enrolment and confirm it.",
  not_in_roll: "Your enrolment isn't on the Bar Council's published lists yet (common for recent enrolments) — our team will confirm it.",
  name_changed: "Your name changed after verification — our team will re-check it.",
};

export type VerificationControls = {
  view: VerificationView;
  verifying: boolean;
  /** The Bar Council couldn't be told from the number — ask which one. */
  councilPrompt: boolean;
  council: string;
  onCouncilChange: (council: string) => void;
  /** Couldn't reach the Bar Council records (or another temporary failure). */
  error: string | null;
  onVerify: () => void;
  onUseRecordName: (name: string) => void;
  onRequestReview: () => void;
};

export function IdentitySection({
  form,
  errors,
  onChange,
  disabled,
  verification,
  adminMode,
  changeWarning,
  showVerifyButton,
}: SectionProps & {
  verification: VerificationControls;
  adminMode?: boolean;
  /** Edit page: a change here sends a verified profile back for review. */
  changeWarning?: boolean;
  /** Edit page: an explicit Verify button (setup verifies on Continue). */
  showVerifyButton?: boolean;
}) {
  return (
    <div className="space-y-4">
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
          Saving a different name or enrolment number sends your profile for re-verification.
        </p>
      )}

      <VerificationStatus verification={verification} adminMode={adminMode} showVerifyButton={showVerifyButton} />
    </div>
  );
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
  const { view, verifying, councilPrompt, council, onCouncilChange, error, onVerify, onUseRecordName, onRequestReview } =
    verification;
  const linkButton =
    "font-semibold underline underline-offset-2 hover:text-foreground disabled:opacity-50 disabled:no-underline";

  return (
    <div aria-live="polite" className="space-y-3">
      {view.state === "verified" && (
        <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[12px] text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
          <BadgeCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Verified with the Bar Council
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
              We couldn&apos;t confirm this enrolment{view.message ? `: ${view.message}` : "."} Check the number
              {adminMode ? "." : ", or ask our team to check it."}
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

      {councilPrompt && !adminMode && (
        <FormField
          id="listing-council"
          label="Which State Bar Council are you enrolled with?"
          hint="We couldn't tell from the number."
        >
          <select
            {...fieldProps("listing-council", { hint: true })}
            value={council}
            onChange={(e) => onCouncilChange(e.target.value)}
            className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">Choose your Bar Council</option>
            {BAR_COUNCILS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
            <option value="other">My Bar Council isn&apos;t listed</option>
          </select>
        </FormField>
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
