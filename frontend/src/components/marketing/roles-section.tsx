"use client";

import Link from "next/link";
import { ArrowRight, Scale, User } from "lucide-react";

import { trackMarketingCta } from "@/lib/analytics/track-cta";
// Building2, Shield — reserved for law firm / enterprise at launch

const ROLES = [
  {
    icon: User,
    title: "Citizens",
    scenario: "I received a legal notice. What do I do?",
    description:
      "Ask Saarthi, understand your rights in plain language, and let Smart Matching connect you with verified advocates suited to your matter — no legal background needed.",
    gradient: "from-blue-600 to-blue-800",
    cta: { label: "Start for free", href: "/register" },
  },
  {
    icon: Scale,
    title: "Advocates",
    scenario: "I want quality clients relevant to my practice.",
    description:
      "Receive clients who have already been guided and briefed by AI — cases that are structured, documented, and matched to your practice area. Focus on advocacy, not intake.",
    gradient: "from-slate-600 to-slate-800",
    cta: { label: "Join as an advocate", href: "/register" },
  },
  // Not available at beta launch:
  // {
  //   icon: Building2,
  //   title: "Law Firms",
  //   scenario: "We're managing 30 active matters across the team.",
  //   description:
  //     "Centralise case management, build a firm knowledge base, and equip every team member with AI-powered research tools — in one workspace.",
  //   gradient: "from-zinc-600 to-zinc-800",
  //   cta: { label: "Learn more", href: "/register" },
  // },
  // {
  //   icon: Shield,
  //   title: "Enterprises",
  //   scenario: "We need to comply with the DPDP Act. Where do we start?",
  //   description:
  //     "Get AI-powered compliance guidance, review contracts, manage legal documents, and understand regulatory obligations relevant to your business.",
  //   gradient: "from-emerald-700 to-emerald-900",
  //   cta: { label: "Learn more", href: "/register" },
  // },
];

export function RolesSection() {
  return (
    <section id="roles" className="px-4 py-20 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <p className="text-xs font-medium text-muted-foreground">
            Who it&apos;s for
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-3xl">
            One platform, two sides of the matter
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[13px] text-muted-foreground sm:text-base">
            You just saw the citizen&apos;s path. Advocates get the mirror image — qualified,
            well-briefed clients, ready to engage.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.title}
                className="group rounded-2xl border border-black/[0.06] bg-white/50 p-4 shadow-[0_4px_20px_rgba(15,23,42,0.04)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(15,23,42,0.08)] sm:p-5 dark:border-white/10 dark:bg-white/[0.04]"
              >
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${role.gradient}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{role.title}</h3>
                <p className="mt-1.5 text-[12px] italic text-muted-foreground/70">
                  &ldquo;{role.scenario}&rdquo;
                </p>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {role.description}
                </p>
                <Link
                  href={role.cta.href}
                  className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-foreground/70 transition-colors hover:text-foreground"
                  onClick={() => trackMarketingCta("roles", role.title.toLowerCase(), role.cta.href)}
                >
                  {role.cta.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
