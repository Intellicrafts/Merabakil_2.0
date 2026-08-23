"use client";

import { MyListingEditor } from "@/components/lawyer-marketplace/my-listing-editor";

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight">My profile</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Keep your profile complete so the AI can match you with the right clients.
        </p>
      </div>
      <MyListingEditor />
    </div>
  );
}
