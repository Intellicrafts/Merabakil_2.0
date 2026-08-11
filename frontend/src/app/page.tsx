"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { FeaturesSection, TrustSection } from "@/components/marketing/features-section";
import { FooterSection } from "@/components/marketing/footer-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { MeraVakilSpotlight } from "@/components/marketing/mera-vakil-spotlight";
import { RolesSection } from "@/components/marketing/roles-section";
import { getToken } from "@/lib/api";

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
      <MeraVakilSpotlight />
      <RolesSection />
      <FeaturesSection />
      <TrustSection />
      <FooterSection />
    </MarketingShell>
  );
}
