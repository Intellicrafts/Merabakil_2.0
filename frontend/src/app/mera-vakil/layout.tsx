"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getStoredUser, getToken } from "@/lib/api";
import { canAccessRoute } from "@/lib/permissions";

export default function MeraVakilLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

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
      return;
    }
    document.documentElement.classList.add("mera-vakil-locked");
    setReady(true);
    return () => {
      document.documentElement.classList.remove("mera-vakil-locked");
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="mera-vakil-root flex min-h-screen items-center justify-center p-8">
        <div className="glass w-full max-w-md space-y-3 p-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  return <div className="mera-vakil-root no-scrollbar h-screen overflow-hidden">{children}</div>;
}
