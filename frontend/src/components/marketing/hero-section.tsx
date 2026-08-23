import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { ModuleFeatureShowcase } from "@/components/marketing/module-feature-showcase";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 py-14 md:px-6 md:py-20 lg:py-24">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="hero-mesh-orb hero-mesh-orb-a absolute -left-24 top-0 h-[420px] w-[420px] rounded-full" />
        <div className="hero-mesh-orb hero-mesh-orb-b absolute -right-16 top-1/3 h-[360px] w-[360px] rounded-full" />
        <div className="hero-aurora absolute left-1/2 top-8 h-[400px] w-[400px] -translate-x-1/2" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[1fr_1.08fr] lg:gap-10">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <div className="hero-stagger-1 inline-flex items-center gap-2 rounded-full border border-black/[0.07] bg-background/80 px-3 py-1 text-[11px] font-medium sm:backdrop-blur-sm dark:border-white/10">
            <Sparkles className="h-3 w-3 text-muted-foreground" />
            Mera Vakil
          </div>

          <div className="hero-stagger-2 mt-5 space-y-3">
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl lg:text-[3.25rem]">
              Meet{" "}
              <span className="gradient-text">Mera Vakil</span>
            </h1>
            <p className="mx-auto max-w-sm text-[15px] leading-relaxed text-muted-foreground lg:mx-0">
              Indian legal AI with grounded answers and live citations.
            </p>
          </div>

          <div className="hero-stagger-3 mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-gradient-to-r from-slate-800 to-slate-900 px-7 text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900"
            >
              <Link href="/register">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full">
              <Link href="/login">Sign In</Link>
            </Button>
          </div>

          <p className="hero-stagger-4 mt-4 text-[11px] text-muted-foreground/80 sm:text-xs">
            Free to explore · Built for Indian law
          </p>
        </div>

        <div className="hero-stagger-5 w-full lg:max-w-none">
          <ModuleFeatureShowcase className="mx-auto w-full max-w-md sm:max-w-lg lg:max-w-none" />
        </div>
      </div>
    </section>
  );
}
