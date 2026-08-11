import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { ModuleFeatureShowcase } from "@/components/marketing/module-feature-showcase";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 py-20 md:px-6 md:py-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="aurora absolute left-1/2 top-0 h-[480px] w-[480px] -translate-x-1/2 opacity-50" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/60 px-3 py-1 text-xs font-medium backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.05]">
            <Sparkles className="h-3.5 w-3.5" />
            AI-native legal operating system
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight md:text-5xl lg:text-[3.25rem]">
              AI Legal OS for{" "}
              <span className="gradient-text">India</span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
              Enterprise-grade legal intelligence for citizens, advocates, law firms, and
              enterprises — grounded in Indian statutes, with citations you can trust.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-gradient-to-r from-slate-800 to-slate-900 px-8 text-white shadow-lg dark:from-slate-100 dark:to-slate-300 dark:text-slate-900"
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

          <p className="text-xs text-muted-foreground">
            Free to explore · Role-based access · Built for Indian law
          </p>
        </div>

        <ModuleFeatureShowcase className="mx-auto w-full max-w-lg lg:max-w-none" />
      </div>
    </section>
  );
}
