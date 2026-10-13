"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";

import { FIELD_ERROR_BORDER, FormField, fieldProps } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { highCourtsForState } from "@/lib/courts";
import { JURISDICTIONS, PRACTICE_AREAS } from "@/lib/mock/lawyers";
import { cn } from "@/lib/utils";

import { ChoiceChips } from "./choice-chips";
import { enrolmentYear, yearsSinceEnrolment, type SectionProps } from "./listing-form";

const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/** Courts, practice areas, experience and languages. The office location is with the enrolment. */
export function PracticeSection({ form, errors, onChange, disabled }: SectionProps) {
  const stateCourts = useMemo(
    () => highCourtsForState(form.state).filter((c) => (JURISDICTIONS as readonly string[]).includes(c)),
    [form.state],
  );
  const courtOptions = useMemo(
    () => [...stateCourts, ...(JURISDICTIONS as readonly string[]).filter((j) => !stateCourts.includes(j))],
    [stateCourts],
  );
  const suggestedCourt = stateCourts.find((c) => !form.courts.includes(c));

  const sinceEnrolment = yearsSinceEnrolment(form.enrolment);
  const year = enrolmentYear(form.enrolment);
  const yearsValue = Number(form.years);
  const yearsTooHigh = form.years !== "" && sinceEnrolment != null && yearsValue > sinceEnrolment;

  return (
    <div className="space-y-5">
      <FormField
        id="listing-courts"
        label="Courts you appear in"
        hint="Choose every court where you take matters."
        error={errors.courts}
        group
      >
        <ChoiceChips
          options={courtOptions}
          selected={form.courts}
          invalid={Boolean(errors.courts)}
          disabled={disabled}
          onToggle={(court) => onChange("courts", toggle(form.courts, court))}
        />
        {suggestedCourt && form.courts.length > 0 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange("courts", [suggestedCourt, ...form.courts])}
            className="inline-flex w-fit items-center gap-1 text-[12px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <Plus className="h-3 w-3" aria-hidden /> Add {suggestedCourt} ({form.state})
          </button>
        )}
      </FormField>

      <FormField
        id="listing-areas"
        label="Practice areas"
        hint="The types of matters you take on."
        error={errors.practiceAreas}
        group
      >
        <ChoiceChips
          options={PRACTICE_AREAS}
          selected={form.practiceAreas}
          invalid={Boolean(errors.practiceAreas)}
          disabled={disabled}
          onToggle={(area) => onChange("practiceAreas", toggle(form.practiceAreas, area))}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          id="listing-years"
          label="Years of experience"
          hint={
            yearsTooHigh ? (
              <span className="text-amber-700 dark:text-amber-400">
                That&apos;s more than the {sinceEnrolment} years since your enrolment in {year} — please check it.
              </span>
            ) : year != null ? (
              `Counted from your enrolment year (${year}) — change it if needed. Enter 0 if it's less than a year.`
            ) : (
              "Enter 0 if it's less than a year."
            )
          }
          error={errors.years}
        >
          <Input
            {...fieldProps("listing-years", { error: errors.years, hint: true })}
            value={form.years}
            disabled={disabled}
            inputMode="numeric"
            onChange={(e) => onChange("years", e.target.value.replace(/\D/g, "").slice(0, 2))}
            className={cn("h-11 rounded-xl sm:max-w-[10rem]", errors.years && FIELD_ERROR_BORDER)}
          />
        </FormField>
        <FormField id="listing-languages" label="Languages" optional hint="Separate with commas.">
          <Input
            {...fieldProps("listing-languages", { optional: true, hint: true })}
            value={form.languages}
            disabled={disabled}
            onChange={(e) => onChange("languages", e.target.value)}
            className="h-11 rounded-xl"
          />
        </FormField>
      </div>
    </div>
  );
}
