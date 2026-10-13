"use client";

import { useState } from "react";

import { ListingValidationError, verifyMyEnrollment, type LawyerListingInput } from "@/lib/api";
import type { RankedMarketplaceLawyer } from "@/lib/appointment-types";
import { detectBarCouncil } from "@/lib/bar-councils";

import { mapServerFields } from "./focus";
import type { ListingForm } from "./listing-form";

type RunOptions = { manualReview?: boolean; nameOverride?: string; council?: string };

/**
 * Verify the enrolment: save name + number first (verification compares the
 * saved name with the Bar Council record), then verify, then re-read the
 * listing so its status is what the server stored.
 */
export function useListingVerification({
  save,
  refresh,
  getForm,
  onFieldErrors,
}: {
  save: (body: LawyerListingInput) => Promise<RankedMarketplaceLawyer>;
  refresh: () => Promise<RankedMarketplaceLawyer>;
  getForm: () => ListingForm;
  onFieldErrors: (fields: Record<string, string>) => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [councilPrompt, setCouncilPrompt] = useState(false);
  const [council, setCouncil] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function run(options: RunOptions = {}): Promise<RankedMarketplaceLawyer | null> {
    const form = getForm();
    const enrolment = form.enrolment.trim();
    const state = options.council || council || detectBarCouncil(enrolment) || undefined;
    if (!state && !options.manualReview) {
      setCouncilPrompt(true);
      return null;
    }
    setVerifying(true);
    setError(null);
    try {
      await save({ full_name: (options.nameOverride ?? form.fullName).trim(), bar_council_id: enrolment });
      await verifyMyEnrollment(enrolment, state, { manualReview: options.manualReview });
      setCouncilPrompt(false);
      return await refresh();
    } catch (err) {
      if (err instanceof ListingValidationError) {
        if (Object.keys(mapServerFields(err.fields)).length) onFieldErrors(err.fields);
        else setError(err.message);
      } else {
        setError("We couldn't reach the Bar Council records right now.");
      }
      return null;
    } finally {
      setVerifying(false);
    }
  }

  return {
    verifying,
    councilPrompt,
    council,
    error,
    run,
    chooseCouncil: (value: string) => {
      setCouncil(value);
      return value ? run({ council: value }) : Promise.resolve(null);
    },
  };
}
