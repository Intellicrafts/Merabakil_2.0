import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { BrandLogoStage } from "@/components/marketing/brand-logo-stage";
import { Button } from "@/components/ui/button";

export function MeraVakilSpotlight() {
  return (
    <section
      id="mera-vakil"
      className="relative overflow-hidden border-y border-black/[0.06] bg-black/[0.02] px-4 py-16 dark:border-white/10 dark:bg-white/[0.02] md:px-6 md:py-20"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="aurora absolute -right-20 top-1/4 h-96 w-96 opacity-30" />
        <div className="aurora absolute -right-20 bottom-1/4 h-80 w-80 opacity-25" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div className="mx-auto max-w-md space-y-5 text-center lg:mx-0 lg:text-left">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Your AI legal guide
          </p>
          <h2 className="text-[2rem] font-semibold leading-[1.1] tracking-tight sm:text-4xl">
            Meet <span className="gradient-text">Saarthi</span>
          </h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Ask a legal question in plain language. Get a cited answer from Indian law.
          </p>
          <Button asChild className="rounded-full">
            <Link href="/register">
              Ask Saarthi
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <BrandLogoStage />
      </div>
    </section>
  );
}
