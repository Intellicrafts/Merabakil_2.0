"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { PlausibleScript } from "@/components/analytics/plausible-script";
import { FaviconLinks } from "@/components/brand/favicon-links";
import { PwaRegister } from "@/components/brand/pwa-register";
import { CookieConsentBanner } from "@/components/consent/cookie-consent-banner";
import { NavTracker } from "@/components/layout/nav-tracker";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <FaviconLinks />
        <PwaRegister />
        <NavigationProgress />
        <NavTracker />
        {children}
        <CookieConsentBanner />
        <PlausibleScript />
      </ToastProvider>
    </QueryClientProvider>
  );
}
