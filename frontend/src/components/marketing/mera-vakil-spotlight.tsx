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
            Your AI legal counsel
          </p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Meet <span className="gradient-text">Mera Vakil</span>
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            India's first AI legal counsel designed for plain-language questions. Whether
            you're a citizen trying to understand a notice or an advocate researching
            precedents — Mera Vakil gives you grounded, cited answers from Indian law.
          </p>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              Ask about property disputes, employment rights, consumer protection, and more
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              Every answer cites the statute, article, or judgment it&apos;s based on
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
              Available in English, Hindi, and regional Indian languages
            </li>
          </ul>
          <Button asChild className="rounded-full">
            <Link href="/register">
              Try Mera Vakil
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <MeraVakilLiveDemo className="mx-auto w-full max-w-md lg:max-w-none" />
      </div>
    </section>
  );
}
