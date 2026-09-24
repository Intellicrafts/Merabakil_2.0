"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trackMarketingCta } from "@/lib/analytics/track-cta";

export function ClosingCtaSection() {
  return (
    <section className="px-4 py-20 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 px-8 py-16 text-center">
          <p className="text-xs font-medium text-white/50">First consultation free · open beta</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-3xl">
            Start with a question
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[13px] text-white/65 sm:text-base">
            Ask Saarthi about your matter and see where it leads.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              className="group rounded-full bg-white text-slate-900 hover:bg-white/90"
            >
              <Link
                href="/mera-vakil"
                onClick={() => trackMarketingCta("closing", "ask_saarthi", "/mera-vakil")}
              >
                Ask Saarthi
                <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="rounded-full border border-white/20 text-white hover:bg-white/10 hover:text-white"
            >
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
