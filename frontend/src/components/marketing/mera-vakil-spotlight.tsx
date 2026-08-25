import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { MeraVakilLiveDemo } from "@/components/marketing/mera-vakil-live-demo";
import { Button } from "@/components/ui/button";

export function MeraVakilSpotlight() {
  return (
    <section
      id="mera-vakil"
      className="relative overflow-hidden border-y border-black/[0.06] bg-black/[0.02] px-4 py-20 dark:border-white/10 dark:bg-white/[0.02] md:px-6"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="aurora absolute -right-20 top-1/4 h-96 w-96 opacity-30" />
        <div className="aurora absolute -right-20 bottom-1/4 h-80 w-80 opacity-25" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="space-y-5">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Your AI legal guide
          </p>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
            Meet <span className="gradient-text">Saarthi</span>
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            India&apos;s AI legal guide — built for plain-language questions. Whether
            you&apos;re a citizen trying to understand a notice or an advocate researching
            precedents, Saarthi gives you grounded, cited answers from Indian law.
          </p>
          <ul className="space-y-2.5 text-[13px] text-muted-foreground sm:text-sm">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              Ask about property disputes, employment rights, consumer protection, and more
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              Advocates get a structured case brief — statutes, key facts, and document checklist — before starting a matter
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              Every answer cites the statute, article, or judgment it is based on
            </li>
          </ul>
          <Button asChild className="rounded-full">
            <Link href="/register">
              Ask Saarthi
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <MeraVakilLiveDemo className="mx-auto w-full max-w-md lg:max-w-none" />
      </div>
    </section>
  );
}
