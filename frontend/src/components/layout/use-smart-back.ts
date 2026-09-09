"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  consumeBackPath,
  getBackLabel,
  markNavigatingBack,
  peekBackPath,
  resolveSmartFallback,
} from "@/lib/nav-history";
import { markNavigationStart } from "@/lib/navigation-feedback";

export function useSmartBack(fallbackHref?: string) {
  const router = useRouter();
  const pathname = usePathname();
  const smartFallback = fallbackHref ?? resolveSmartFallback(pathname);
  const [label, setLabel] = useState("Home");

  useEffect(() => {
    setLabel(getBackLabel(pathname, smartFallback));
  }, [pathname, smartFallback]);

  function go() {
    markNavigatingBack();
    markNavigationStart();
    router.push(consumeBackPath(pathname, smartFallback));
  }

  return {
    label,
    go,
    target: peekBackPath(pathname, smartFallback),
  };
}
