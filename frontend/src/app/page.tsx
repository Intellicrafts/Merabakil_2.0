"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { FeaturesSection, TrustSection } from "@/components/marketing/features-section";
import { FooterSection } from "@/components/marketing/footer-section";
import { HeroSection } from "@/components/marketing/hero-section";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { RolesSection } from "@/components/marketing/roles-section";
import { Skeleton } from "@/components/ui/skeleton";
import { getToken } from "@/lib/api";

const MeraVakilSpotlight = dynamic(
  () =>
    import("@/components/marketing/mera-vakil-spotlight").then((m) => ({
      default: m.MeraVakilSpotlight,
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
      <MeraVakilSpotlight />
      <RolesSection />
      <FeaturesSection />
      <TrustSection />
      <FooterSection />
    </MarketingShell>
  );
}
