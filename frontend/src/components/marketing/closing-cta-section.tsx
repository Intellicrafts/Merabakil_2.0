"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trackMarketingCta } from "@/lib/analytics/track-cta";

export function ClosingCtaSection() {
  return (
    <section className="px-4 py-20 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-black/[0.06] bg-gradient-to-br from-slate-50 to-white px-8 py-16 text-center dark:border-white/10 dark:from-zinc-900 dark:to-zinc-950">
          <p className="text-xs font-medium text-muted-foreground">Open beta · free to start</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-3xl">
            Start with a question
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[13px] text-muted-foreground sm:text-base">
            Ask Saarthi about your matter and see where it leads.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              className="group rounded-full bg-gradient-to-r from-slate-800 to-slate-900 text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900"
            >
              <Link
                href="/register"
                onClick={() => trackMarketingCta("closing", "register", "/register")}
              >
                Get legal guidance
                <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full">
              <Link
                href="/login"
                onClick={() => trackMarketingCta("closing", "login", "/login")}
              >
                Sign In
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
