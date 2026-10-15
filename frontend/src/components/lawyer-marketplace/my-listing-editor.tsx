"use client";

import { useCallback, useEffect, useState } from "react";

import { ListingEditForm } from "@/components/lawyer-marketplace/listing/listing-edit-form";
import { firstIncompleteStep, usesSetup } from "@/components/lawyer-marketplace/listing/listing-form";
import { ListingSetup } from "@/components/lawyer-marketplace/listing/listing-setup";
import { ProfileSectionCard } from "@/components/profile/profile-hero";
import { Button } from "@/components/ui/button";
import { adminGetLawyerListing, getMyLawyerListing, getStoredUser } from "@/lib/api";
import type { RankedMarketplaceLawyer } from "@/lib/appointment-types";

interface MyListingEditorProps {
  onSaved?: () => void;
  /** Admin mode: edit this advocate's listing instead of the signed-in user's. */
  advocateUserId?: string;
  advocateName?: string;
  /** Focused activation tour from the dashboard nudge. */
  tour?: boolean;
}

/**
 * An advocate's marketplace listing. New advocates get the guided setup;
 * live listings, and admins, get the single edit page with the same rules.
 */
export function MyListingEditor({ onSaved, advocateUserId, advocateName, tour = false }: MyListingEditorProps) {
  const user = getStoredUser();
  const adminMode = Boolean(advocateUserId);
  const canEdit = adminMode || Boolean(user?.roles.includes("advocate"));
  // Never fall back to the signed-in admin's own name when editing someone else.
  const fallbackName = adminMode ? (advocateName ?? "") : (user?.full_name ?? "");

  const [row, setRow] = useState<RankedMarketplaceLawyer | null>(null);
  const [mode, setMode] = useState<"setup" | "edit" | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const listing = adminMode ? await adminGetLawyerListing(advocateUserId!) : await getMyLawyerListing();
      setRow(listing);
      const setup =
        usesSetup(listing, adminMode) || Boolean(tour && !adminMode && firstIncompleteStep(listing));
      setMode(setup ? "setup" : "edit");
    } catch {
      setLoadError(adminMode ? "We couldn't load this advocate's listing." : "We couldn't load your listing.");
    } finally {
      setLoading(false);
    }
  }, [adminMode, advocateUserId, tour]);

  useEffect(() => {
    if (canEdit) void load();
  }, [canEdit, load]);

  if (!canEdit) return null;

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading your listing">
        {[0, 1, 2].map((i) => (
          <ProfileSectionCard key={i}>
            <div className="animate-pulse space-y-3">
              <div className="h-3.5 w-1/3 rounded-lg bg-black/[0.05] dark:bg-white/[0.07]" />
              <div className="h-11 rounded-xl bg-black/[0.05] dark:bg-white/[0.07]" />
            </div>
          </ProfileSectionCard>
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <ProfileSectionCard>
        <p role="alert" className="text-[13px] text-destructive">
          {loadError} Check your connection and try again.
        </p>
        <Button type="button" variant="outline" className="mt-3 h-10 rounded-xl" onClick={() => void load()}>
          Try again
        </Button>
      </ProfileSectionCard>
    );
  }

  if (mode === "setup") {
    return (
      <ListingSetup
        initialRow={row}
        fallbackName={fallbackName}
        tour={tour}
        onFinished={(finished) => {
          setRow(finished);
          setMode("edit");
          onSaved?.();
        }}
      />
    );
  }

  return (
    <ListingEditForm
      key={row?.id ?? "new"}
      initialRow={row}
      fallbackName={fallbackName}
      advocateUserId={advocateUserId}
      onSaved={onSaved}
    />
  );
}
