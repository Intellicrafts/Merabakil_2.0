"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useState } from "react";

import { FaviconLinks } from "@/components/brand/favicon-links";
import { PwaRegister } from "@/components/brand/pwa-register";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { MicrosoftClarity } from "@/components/analytics/microsoft-clarity";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { CookieConsentBanner } from "@/components/consent/cookie-consent-banner";
import { NavTracker } from "@/components/layout/nav-tracker";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { ToastProvider } from "@/components/ui/toast";
import { LanguageProvider } from "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
      }),
  );

  return (
    <LanguageProvider>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <FaviconLinks />
          <PwaRegister />
          <NavigationProgress />
          <NavTracker />
          <GoogleAnalytics />
          <MicrosoftClarity />
          <Suspense fallback={null}>
            <PageViewTracker />
          </Suspense>
          {children}
          <CookieConsentBanner />
        </ToastProvider>
      </QueryClientProvider>
    </LanguageProvider>
  );
}
