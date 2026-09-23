"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, FileText, MessageSquare, Mic, Scale, ShieldCheck, Video } from "lucide-react";

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
    ctaHref: "/mera-vakil",
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
  {
    id: "consult",
    num: "03",
    label: "Consult",
    icon: Video,
    heading: "Consult with confidence",
    body: "Your matched advocate joins you in a dedicated consultation room — chat, voice, and video in one secure space. Share documents, send voice notes, and get clear advice without leaving the platform.",
    ctaLabel: "Get started free",
    ctaHref: "/register",
    ctaEvent: "how_it_works_consult",
    handoff: null,
  },
];

const CONSULT_FEATURES = [
  {
    icon: MessageSquare,
    title: "Chat, voice & video",
    desc: "Text chat, audio call, and video call — all in one room, switch anytime.",
  },
  {
    icon: FileText,
    title: "Share documents",
    desc: "Upload PDFs, Word files, and images directly in the consultation.",
  },
  {
    icon: Mic,
    title: "Voice notes",
    desc: "Record and send voice notes up to 2 minutes — useful when typing isn't enough.",
  },
  {
    icon: ShieldCheck,
    title: "Secure & moderated",
    desc: "Role-controlled access, session oversight, and an emergency help system built in.",
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

        {/* Step rail — horizontally scrollable on mobile so all 3 steps are always visible */}
        <div className="-mx-4 mb-10 overflow-x-auto md:mx-0">
          <div
            className="flex min-w-max items-center justify-center px-4 md:px-0"
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
                  {/* connector line — only between steps, not after the last */}
                  {i < TABS.length - 1 && (
                    <div className="mx-1 h-px w-8 shrink-0 bg-black/[0.08] dark:bg-white/10 sm:mx-2 sm:w-12" />
                  )}
                </div>
              );
            })}
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
            {tab.handoff && (
              <p className="text-[12px] text-muted-foreground">
                Next: {tab.handoff}
              </p>
            )}
            {active === 2 && (
              <p className="text-[12px] text-muted-foreground">
                <span className="font-semibold text-foreground">First consultation free</span> — book your matched advocate at no cost.
              </p>
            )}
          </div>

          {/* Right panel — keyed to active so demos remount fresh on tab switch */}
          <div key={active} className="min-h-[380px] sm:min-h-[420px]">
            {active === 2 ? (
              /* Consult tab: feature list card instead of live demo */
              <div className="rounded-2xl border border-black/[0.06] bg-white p-6 dark:border-white/10 dark:bg-white/[0.04] sm:p-8">
                <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  What&apos;s included
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {CONSULT_FEATURES.map((f) => {
                    const FIcon = f.icon;
                    return (
                      <div key={f.title} className="flex gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
                          <FIcon className="h-4 w-4 text-slate-600 dark:text-slate-300" strokeWidth={1.75} />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold">{f.title}</p>
                          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{f.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 border-t border-black/[0.06] pt-4 dark:border-white/10">
                  <p className="text-[12px] text-muted-foreground">
                    <span className="font-semibold text-foreground">First consultation free</span> — book your matched advocate at no cost, no card required.
                  </p>
                </div>
              </div>
            ) : inView ? (
              active === 0 ? (
                <MeraVakilLiveDemo active compact={false} className="w-full" />
              ) : (
                <ConsultationLiveDemo active compact={false} className="w-full" />
              )
            ) : (
              <Skeleton className="h-[380px] w-full rounded-3xl sm:h-[420px]" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
