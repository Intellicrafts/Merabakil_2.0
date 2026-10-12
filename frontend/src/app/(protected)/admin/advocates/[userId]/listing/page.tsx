"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { MyListingEditor } from "@/components/lawyer-marketplace/my-listing-editor";

/** An admin completes or corrects an advocate's marketplace listing. */
export default function AdminAdvocateListingPage() {
  return (
    <Suspense>
      <AdvocateListing />
    </Suspense>
  );
}

function AdvocateListing() {
  const { userId } = useParams<{ userId: string }>();
  const name = useSearchParams().get("name") ?? "";

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24 md:pb-10">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          User management
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{name ? `${name} — listing` : "Advocate listing"}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          What clients see in the advocate listing. Saving doesn&apos;t change Bar Council verification.
        </p>
      </div>
      <MyListingEditor key={userId} advocateUserId={userId} advocateName={name} />
    </div>
  );
}
