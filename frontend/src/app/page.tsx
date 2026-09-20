"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ClosingCtaSection } from "@/components/marketing/closing-cta-section";
import { FeaturesSection, TrustSection } from "@/components/marketing/features-section";
import { FooterSection } from "@/components/marketing/footer-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { RolesSection } from "@/components/marketing/roles-section";
import { Skeleton } from "@/components/ui/skeleton";
import { getToken } from "@/lib/api";

const HowItWorksSection = dynamic(
  () =>
    import("@/components/marketing/how-it-works-section").then((m) => ({
      default: m.HowItWorksSection,
    })),
  {
    loading: () => <Skeleton className="mx-auto h-96 max-w-6xl rounded-3xl" />,
  },
);

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    if (getToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <MarketingShell>
      <HeroSection />
      <HowItWorksSection />
      <RolesSection />
      <FeaturesSection />
      <TrustSection />
      <ClosingCtaSection />
      <FooterSection />
    </MarketingShell>
  );
}
