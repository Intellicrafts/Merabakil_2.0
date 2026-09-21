"use client";

import { useCallback, useEffect, useState } from "react";

import { CitizenProfileEditor } from "@/components/profile/citizen-profile-editor";
import { ProfileHero } from "@/components/profile/profile-hero";
import { ProfilePhotoEditor } from "@/components/profile/profile-photo-editor";
import { MyListingEditor } from "@/components/lawyer-marketplace/my-listing-editor";
import { useCitizenProfile } from "@/hooks/use-citizen-profile";
import { AnalyticsEvents, track } from "@/lib/analytics";
import { getMyLawyerListing, getStoredUser, uploadLawyerAvatar } from "@/lib/api";

export default function ProfilePage() {
  const user = getStoredUser();
  const isAdvocate = Boolean(user?.roles.includes("advocate"));
  const isCitizen = Boolean(user?.roles.includes("citizen"));
  const isAdmin = Boolean(user?.roles.includes("admin"));
  const showCitizenProfile = (isCitizen || isAdmin) && !isAdvocate;

  useEffect(() => {
    track(AnalyticsEvents.PROFILE_PAGE_VIEWED, {
      profile_type: isAdvocate ? "advocate" : "citizen",
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const citizen = useCitizenProfile(showCitizenProfile);

  // Advocates' photo lives in the marketplace listing (lawyers.photo_url), not the
  // auth user avatar — fetch it so the hero matches what the upload writes.
  const [advocatePhoto, setAdvocatePhoto] = useState<string | null>(null);
  const loadAdvocatePhoto = useCallback(async () => {
    try {
      const listing = await getMyLawyerListing();
      setAdvocatePhoto(listing.photo_url ?? null);
    } catch {
      /* no listing yet — fall back to default avatar */
    }
  }, []);
  useEffect(() => {
    if (isAdvocate) void loadAdvocatePhoto();
  }, [isAdvocate, loadAdvocatePhoto]);

  const displayName = showCitizenProfile
    ? citizen.form.full_name || user?.full_name || "User"
    : user?.full_name ?? "User";
  const displayEmail = showCitizenProfile ? citizen.form.email || user?.email : user?.email;
  const displayAvatar = showCitizenProfile
    ? citizen.profile?.avatar_url ?? user?.avatar_url
    : isAdvocate
      ? advocatePhoto
      : user?.avatar_url;

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-2 pb-6 sm:space-y-5 sm:px-0 sm:py-4">
      <ProfileHero isAdvocate={isAdvocate} />
      <ProfilePhotoEditor
        avatarUrl={displayAvatar}
        fullName={displayName}
        email={displayEmail}
        uploadFn={isAdvocate ? uploadLawyerAvatar : undefined}
        onAvatarChange={() => {
          if (isAdvocate) void loadAdvocatePhoto();
          else void citizen.refresh();
        }}
      />
      {showCitizenProfile && (
        <CitizenProfileEditor
          loading={citizen.loading}
          saving={citizen.saving}
          error={citizen.error}
          form={citizen.form}
          isDirty={citizen.isDirty}
          setField={citizen.setField}
          onUpdate={async () => {
            await citizen.updateProfile();
          }}
          onRetry={() => void citizen.refresh()}
        />
      )}
      {isAdvocate && <MyListingEditor />}
    </div>
  );
}
