"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Lock, Scale, ShieldCheck } from "lucide-react";

import { AskAuthSheet } from "@/components/ask/ask-auth-sheet";
import { AskComposer } from "@/components/ask/ask-composer";
import { useAskSubmit } from "@/components/ask/use-ask-submit";
import { BrandLogo } from "@/components/brand/brand-logo";
import { StarterSuggestions } from "@/components/mera-vakil/starter-suggestions";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { AnalyticsEvents, captureUtmFromSearch, track } from "@/lib/analytics";
import { useTranslation } from "@/lib/i18n";

const SAARTHI = "/mera-vakil";

/**
 * Logged-out landing shown on /mera-vakil (the Saarthi page's public face). A
 * visitor types a question first; on submit we stash it + open the inline auth
 * sheet, and after sign-in the page flips to the full chat and auto-sends it.
 */
function SaarthiLandingInner() {
  const searchParams = useSearchParams();
  const { t, lang } = useTranslation();
  const [query, setQuery] = useState("");
  const { submitQuestion, authOpen, setAuthOpen } = useAskSubmit();

  const topic = searchParams.get("topic");

  const topicPrefill = useMemo(() => {
    switch (topic) {
      case "property":
        return t("ask.topicProperty");
      case "family":
        return t("ask.topicFamily");
      case "labour":
        return t("ask.topicLabour");
      default:
        return "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, lang]);

  useEffect(() => {
    if (topicPrefill) setQuery(topicPrefill);
  }, [topicPrefill]);

  useEffect(() => {
    // Public landing — capture gclid/utm here too so it survives even if the
    // global tracker hasn't run yet.
    captureUtmFromSearch(window.location.search);
    track(AnalyticsEvents.ASK_PAGE_VIEWED, { lang });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const examples =
    topic === "property"
      ? [t("ask.propertyEx1"), t("ask.propertyEx2"), t("ask.propertyEx3")]
      : topic === "family"
        ? [t("ask.familyEx1"), t("ask.familyEx2"), t("ask.familyEx3")]
        : topic === "labour"
          ? [t("ask.labourEx1"), t("ask.labourEx2"), t("ask.labourEx3")]
          : [t("ask.example1"), t("ask.example2"), t("ask.example3"), t("ask.example4")];

  const trust = [
    { icon: Scale, label: t("ask.trust1") },
    { icon: BadgeCheck, label: t("ask.trust2") },
    { icon: Lock, label: t("ask.trust3") },
    { icon: ShieldCheck, label: t("ask.trust4") },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3.5 sm:px-6">
        <Link href="/" aria-label="MeraBakil home">
          <BrandLogo variant="wordmark" size="md" />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link
            href={`/login?next=${encodeURIComponent(SAARTHI)}`}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            {t("ask.signIn")}
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-24 pt-6 sm:justify-center sm:pb-16 sm:pt-4">
        <h1 className="text-balance text-[1.6rem] font-semibold leading-[1.15] tracking-tight sm:text-[2.1rem]">
          {t("ask.headline")}
        </h1>
        <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
          {t("ask.subline")}
        </p>

        <div className="mt-5">
          <AskComposer
            value={query}
            onChange={setQuery}
            onAsk={(q, opts) => submitQuestion(q, "typed", opts)}
            autoFocus
          />
        </div>

        <div className="mt-3">
          <StarterSuggestions onSelect={(prompt) => submitQuestion(prompt, "chip")} />
        </div>

        <div className="mt-5">
          <p className="mb-2 px-0.5 text-[12px] font-medium text-muted-foreground">
            {t("ask.examplesLabel")}
          </p>
          <div className="flex flex-col gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => submitQuestion(ex, "example")}
                className="rounded-xl border border-black/[0.07] bg-black/[0.02] px-3.5 py-2.5 text-left text-[13.5px] text-foreground/90 transition-colors hover:border-black/[0.12] hover:bg-black/[0.04] dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-muted-foreground/80">
          {trust.map(({ icon: Icon, label }) => (
            <li key={label} className="inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              {label}
            </li>
          ))}
        </ul>
      </main>

      <AskAuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}

export function SaarthiLanding() {
  return (
    <Suspense fallback={null}>
      <SaarthiLandingInner />
    </Suspense>
  );
}
