"use client";

import { CheckCircle2 } from "lucide-react";

import { FIELD_ERROR_BORDER, FormField, fieldProps } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { BIO_MAX, BIO_MIN_FOR_MATCHING, formatInr, type SectionProps } from "./listing-form";

/** Digits of the rupee amount, so a pasted "₹1,500.00" becomes 1500 (not 150000). */
const wholeRupees = (raw: string) => raw.split(".")[0].replace(/\D/g, "").slice(0, 7);

export function FeeSection({ form, errors, onChange, disabled }: SectionProps) {
  const fee = Number(form.fee);
  const bioLength = form.bio.trim().length;
  const feeHint =
    fee > 0
      ? `${formatInr(fee)} — charged once per booked consultation (60 minutes).`
      : "What a client pays to book one consultation with you (a 60-minute session).";

  return (
    <div className="space-y-5">
      <FormField id="listing-fee" label="Consultation fee" hint={feeHint} error={errors.fee}>
        <div className="relative sm:max-w-[16rem]">
          <span
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] font-medium text-muted-foreground"
          >
            ₹
          </span>
          <Input
            {...fieldProps("listing-fee", { error: errors.fee, hint: true })}
            value={form.fee}
            disabled={disabled}
            inputMode="numeric"
            placeholder="e.g. 1500"
            onChange={(e) => onChange("fee", wholeRupees(e.target.value))}
            className={cn("h-11 rounded-xl pl-8 text-[15px] font-semibold tabular-nums", errors.fee && FIELD_ERROR_BORDER)}
          />
        </div>
      </FormField>

      <FormField
        id="listing-bio"
        label="About your practice"
        optional
        hint={
          bioLength >= BIO_MIN_FOR_MATCHING ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" aria-hidden /> Saarthi can recommend you to clients with matching cases.
            </span>
          ) : (
            `2–3 lines on the matters you handle and where. Saarthi needs at least ${BIO_MIN_FOR_MATCHING} characters to recommend you (${bioLength}/${BIO_MIN_FOR_MATCHING}).`
          )
        }
        error={errors.bio}
      >
        <Textarea
          {...fieldProps("listing-bio", { error: errors.bio, hint: true, optional: true })}
          value={form.bio}
          disabled={disabled}
          rows={4}
          maxLength={BIO_MAX}
          placeholder="e.g. 12 years in criminal and bail matters before the Punjab and Haryana High Court and the district courts in Ropar. I explain options in Hindi, Punjabi or English."
          onChange={(e) => onChange("bio", e.target.value)}
          className={cn("rounded-xl text-[13px]", errors.bio && FIELD_ERROR_BORDER)}
        />
      </FormField>
    </div>
  );
}
