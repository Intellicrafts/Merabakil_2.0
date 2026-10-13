"use client";

import { useState } from "react";

import { ListingValidationError, verifyMyEnrollment, type LawyerListingInput } from "@/lib/api";
import type { RankedMarketplaceLawyer } from "@/lib/appointment-types";

import { mapServerFields } from "./focus";
import { toPayload, type ListingForm } from "./listing-form";

type RunOptions = { manualReview?: boolean; nameOverride?: string };

/**
 * Verify the enrolment: save the office location, name and number first (the
 * office's state decides which Bar Council checks the number, and the saved
 * name is compared with its record), then verify, then re-read the listing so
 * its status is what the server stored.
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
  const [error, setError] = useState<string | null>(null);

  async function run(options: RunOptions = {}): Promise<RankedMarketplaceLawyer | null> {
    const form = getForm();
    setVerifying(true);
    setError(null);
    try {
      await save({ ...toPayload(form, "identity"), full_name: (options.nameOverride ?? form.fullName).trim() });
      await verifyMyEnrollment(form.enrolment.trim(), { manualReview: options.manualReview });
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

  return { verifying, error, run };
}
