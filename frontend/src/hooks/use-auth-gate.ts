"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { getStoredUser, getToken } from "@/lib/api";
import { canAccessRoute } from "@/lib/permissions";

function subscribe() {
  return () => undefined;
}

function sessionAllows(pathname: string): boolean {
  const token = getToken();
  const stored = getStoredUser();
  return Boolean(token && stored && canAccessRoute(pathname, stored));
}

/** Client-side auth gate without a skeleton flash on in-app navigations. */
export function useAuthGate(): boolean {
  const pathname = usePathname();
  const router = useRouter();
  const ready = useSyncExternalStore(
    subscribe,
    () => sessionAllows(pathname),
    () => false,
  );

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      const next = encodeURIComponent(`${pathname}${window.location.search}`);
      router.replace(`/login?next=${next}`);
      return;
    }
    if (!canAccessRoute(pathname, stored)) {
      router.replace("/dashboard");
    }
  }, [pathname, router]);

  return ready;
}
