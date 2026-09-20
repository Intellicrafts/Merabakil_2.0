"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, MessageSquare, Scale, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trackMarketingCta } from "@/lib/analytics/track-cta";
import { cn } from "@/lib/utils";

const MeraVakilLiveDemo = dynamic(
  () =>
    import("@/components/marketing/mera-vakil-live-demo").then((m) => ({
      default: m.MeraVakilLiveDemo,
    })),
  { ssr: false },
);
const ConsultationLiveDemo = dynamic(
  () =>
    import("@/components/marketing/consultation-live-demo").then((m) => ({
      default: m.ConsultationLiveDemo,
    })),
  { ssr: false },
);

const TABS = [
  {
    id: "saarthi",
    num: "01",
    label: "Ask Saarthi",
    icon: MessageSquare,
    heading: "Meet Saarthi, your AI legal guide",
    body: "Describe your matter by text or voice. Saarthi asks the right follow-ups, explains your rights, and answers with citations from Indian law — no legal jargon needed.",
    ctaLabel: "Ask Saarthi",
    ctaHref: "/register",
    ctaEvent: "how_it_works_saarthi",
    handoff: "Your conversation is saved to a case — ready for Smart Matching next.",
  },
  {
    id: "matching",
    num: "02",
    label: "Smart Matching",
    icon: Scale,
    heading: "We read your case. We match your counsel.",
    body: "Smart Matching turns your matter into a structured brief and surfaces the verified advocates best suited to it — each with a clear reason for the match. Book a consultation in minutes.",
    ctaLabel: "Find my advocate",
    ctaHref: "/register",
    ctaEvent: "how_it_works_matching",
    handoff: "Your matched advocate joins you in a secure built-in consultation room.",
  },
];

export function HowItWorksSection() {
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
      },
      { rootMargin: "100px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const tab = TABS[active];

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="border-y border-black/[0.06] bg-black/[0.02] px-4 py-20 dark:border-white/10 dark:bg-white/[0.02] md:px-6"
    >
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <div className="mb-12 text-center">
          <p className="text-xs font-medium text-muted-foreground">How it works</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-3xl">
            From your first question to the right advocate
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[13px] text-muted-foreground sm:text-base">
            MeraBakil guides the whole matter — ask, get matched, and consult with confidence.
          </p>
        </div>

        {/* Step rail — also the tablist */}
        <div
          className="mb-10 flex items-center justify-center"
          role="tablist"
          aria-label="How MeraBakil works"
        >
          {TABS.map((t, i) => {
            const Icon = t.icon;
            const isActive = i === active;
            return (
              <div key={t.id} className="flex items-center">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`hiw-panel-${t.id}`}
                  id={`hiw-tab-${t.id}`}
                  onClick={() => setActive(i)}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-xl px-3 py-2.5 transition-all duration-200 sm:px-4",
                    isActive ? "opacity-100" : "opacity-45 hover:opacity-70",
                  )}
                >
                  {isActive && (
                    <span
                      className="showcase-tab-active absolute inset-0 rounded-xl"
                      aria-hidden
                    />
                  )}
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.07] bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.08]">
                    <Icon
                      className="h-[18px] w-[18px] text-slate-600 dark:text-slate-300"
                      strokeWidth={1.75}
                    />
                  </div>
                  <div className="relative text-center">
                    <p className="text-[10px] tabular-nums text-muted-foreground">{t.num}</p>
                    <p className="text-[12px] font-semibold sm:text-[13px]">{t.label}</p>
                  </div>
                </button>
                <div className="mx-1 h-px w-8 shrink-0 bg-black/[0.08] dark:bg-white/10 sm:mx-2 sm:w-12" />
              </div>
            );
          })}

          {/* Step 03 — Consult (destination marker, non-interactive) */}
          <div
            className="flex flex-col items-center gap-2 px-3 py-2.5 opacity-35 sm:px-4"
            aria-hidden
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-black/[0.10] dark:border-white/[0.12]">
              <Video
                className="h-[18px] w-[18px] text-slate-500"
                strokeWidth={1.75}
              />
            </div>
            <div className="text-center">
              <p className="text-[10px] tabular-nums text-muted-foreground">03</p>
              <p className="text-[12px] font-semibold sm:text-[13px]">Consult</p>
            </div>
          </div>
        </div>

        {/* Active panel */}
        <div
          id={`hiw-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`hiw-tab-${tab.id}`}
          className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-14"
        >
          {/* Copy block */}
          <div className="space-y-5">
            <div className="space-y-3">
              <h3 className="text-[1.3rem] font-semibold leading-[1.2] tracking-tight sm:text-[1.65rem]">
                {tab.heading}
              </h3>
              <p className="text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
                {tab.body}
              </p>
            </div>
            <Button asChild className="group rounded-full">
              <Link
                href={tab.ctaHref}
                onClick={() => trackMarketingCta("how_it_works", tab.ctaEvent, tab.ctaHref)}
              >
                {tab.ctaLabel}
                <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <p className="text-[12px] text-muted-foreground">
              Next: {tab.handoff}
            </p>
          </div>

          {/* Demo — keyed to active so it remounts fresh on tab switch */}
          <div key={active} className="min-h-[400px] sm:min-h-[440px]">
            {inView ? (
              active === 0 ? (
                <MeraVakilLiveDemo active compact={false} className="w-full" />
              ) : (
                <ConsultationLiveDemo active compact={false} className="w-full" />
              )
            ) : (
              <Skeleton className="h-[400px] w-full rounded-3xl sm:h-[440px]" />
            )}
          </div>
        </div>

        <p className="mt-10 text-center text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground/80">Step 3 — Consult:</span>{" "}
          Book a timed consultation and meet in a secure built-in room, included on the platform.
        </p>
      </div>
    </section>
  );
}
