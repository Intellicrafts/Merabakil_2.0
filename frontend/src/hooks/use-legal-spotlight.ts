"use client";

import { useQuery } from "@tanstack/react-query";

import type { PrimaryRole } from "@/lib/dashboard-config";
import type { LegalSpotlight } from "@/lib/legal-spotlight/types";

async function fetchLegalSpotlight(role: PrimaryRole): Promise<LegalSpotlight> {
  const res = await fetch(`/api/dashboard/legal-spotlight?role=${encodeURIComponent(role)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not load spotlight");
  return res.json() as Promise<LegalSpotlight>;
}

export function useLegalSpotlight(role: PrimaryRole) {
  return useQuery({
    queryKey: ["legal-spotlight", role],
    queryFn: () => fetchLegalSpotlight(role),
    staleTime: 86_400_000,
    gcTime: 86_400_000,
    retry: 1,
  });
}
