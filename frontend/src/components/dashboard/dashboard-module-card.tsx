"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { DashboardModule } from "@/lib/dashboard-config";
import { getModuleMeta } from "@/lib/dashboard-meta";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const MODULE_TITLE_KEY: Record<string, string> = {
  "/mera-vakil": "modules.saarthiTitle",
  "/research": "modules.researchTitle",
  "/lawyer-marketplace": "modules.marketplaceTitle",
  "/cases": "modules.casesTitle",
  "/documents": "modules.documentsTitle",
  "/appointments": "modules.appointmentsTitle",
  "/wallet": "modules.walletTitle",
  "/admin/knowledge": "modules.knowledgeTitle",
  "/admin/users": "modules.usersTitle",
  "/admin/appointments": "modules.adminApptsTitle",
};

const MODULE_DESC_KEY: Record<string, string> = {
  "/mera-vakil": "modules.saarthiDesc",
  "/research": "modules.researchDesc",
  "/lawyer-marketplace": "modules.marketplaceDesc",
  "/cases": "modules.casesDesc",
  "/documents": "modules.documentsDesc",
  "/appointments": "modules.appointmentsDesc",
  "/wallet": "modules.walletDesc",
  "/admin/knowledge": "modules.knowledgeDesc",
  "/admin/users": "modules.usersDesc",
  "/admin/appointments": "modules.adminApptsDesc",
};

const MODULE_TAG_KEY: Record<string, string> = {
  "/mera-vakil": "modules.saarthiTag",
  "/research": "modules.researchTag",
  "/lawyer-marketplace": "modules.marketplaceTag",
  "/cases": "modules.casesTag",
  "/documents": "modules.documentsTag",
  "/appointments": "modules.appointmentsTag",
  "/wallet": "modules.walletTag",
  "/admin/knowledge": "modules.knowledgeTag",
  "/admin/users": "modules.usersTag",
  "/admin/appointments": "modules.adminApptsTag",
};

const MODULE_CTA_KEY: Record<string, string> = {
  "/mera-vakil": "modules.saarthiCta",
  "/research": "modules.researchCta",
  "/lawyer-marketplace": "modules.marketplaceCta",
  "/cases": "modules.casesCta",
  "/documents": "modules.documentsCta",
  "/appointments": "modules.appointmentsCta",
  "/wallet": "modules.walletCta",
  "/admin/knowledge": "modules.knowledgeCta",
  "/admin/users": "modules.usersCta",
  "/admin/appointments": "modules.adminApptsCta",
};

const FEATURE_KEY: Record<string, string> = {
  "Cited answers": "modules.citedAnswers",
  "Voice support": "modules.voiceSupport",
  "Multi-language": "modules.multiLanguage",
  "Statute search": "modules.statuteSearch",
  "Case law": "modules.caseLaw",
  "Cited sources": "modules.citedSources",
  "Verified advocates": "modules.verifiedAdvocates",
  "Book instantly": "modules.bookInstantly",
  "AI matching": "modules.aiMatching",
  "Matter tracking": "modules.matterTracking",
  "Status timeline": "modules.statusTimeline",
  "Team access": "modules.teamAccess",
  "Upload & query": "modules.uploadAndQuery",
  "AI-powered search": "modules.aiPoweredSearch",
  "Secure storage": "modules.secureStorage",
  "Upcoming": "modules.upcoming",
  "Past sessions": "modules.pastSessions",
  "Balance": "modules.balance",
  "Top up": "modules.topUp",
  "Build firm corpus": "modules.buildFirmCorpus",
  "Team-wide access": "modules.teamWideAccess",
  "AI-indexed": "modules.aiIndexed",
  "Role control": "modules.roleControl",
  "Access management": "modules.accessManagement",
  "Audit trail": "modules.auditTrail",
  "Bookings": "modules.bookings",
  "Transcripts": "modules.transcripts",
  "Sessions": "modules.sessions",
};

export function DashboardModuleCard({ mod }: { mod: DashboardModule }) {
  const { t } = useTranslation();
  const Icon = mod.icon;
  const meta = getModuleMeta(mod.href);
  const titleKey = MODULE_TITLE_KEY[mod.href];
  const descKey = MODULE_DESC_KEY[mod.href];
  const tagKey = MODULE_TAG_KEY[mod.href];
  const ctaKey = MODULE_CTA_KEY[mod.href];

  return (
    <Link
      href={mod.href}
      className={cn(
        "mp-surface-card group relative flex flex-col gap-3.5 overflow-hidden rounded-2xl px-4 py-4 sm:px-5 sm:py-5",
        "transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-px",
        "active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2",
        `dash-module-tint-${meta.tint}`,
      )}
    >
      {/* Tag + CTA */}
      <div className="relative flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground dark:bg-white/[0.08]">
          {tagKey ? t(tagKey) : meta.tag}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            "border-black/[0.08] bg-white text-foreground/55",
            "transition-colors duration-150 group-hover:border-black/15 group-hover:text-foreground",
            "dark:border-white/[0.08] dark:bg-white/[0.05]",
          )}
        >
          {ctaKey ? t(ctaKey) : t("modules.walletCta")}
          <ArrowUpRight className="h-3 w-3 transition-transform duration-150 group-hover:-translate-y-px group-hover:translate-x-px" />
        </span>
      </div>

      {/* Icon + Title */}
      <div className="relative flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/[0.06] bg-white/90 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.08]">
          <Icon className="h-[18px] w-[18px] text-foreground/80" strokeWidth={1.75} />
        </span>
        <span className="text-[15px] font-semibold leading-tight tracking-tight">
          {titleKey ? t(titleKey) : mod.title}
        </span>
      </div>

      {/* Description */}
      <p className="relative line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
        {descKey ? t(descKey) : mod.description}
      </p>

      {/* Feature chips */}
      {meta.features.length > 0 && (
        <div className="relative flex flex-wrap gap-1.5">
          {meta.features.map((f) => (
            <span
              key={f}
              className="rounded-full border border-black/[0.06] bg-black/[0.02] px-2 py-0.5 text-[11px] text-muted-foreground/80 dark:border-white/[0.08] dark:bg-white/[0.04]"
            >
              {FEATURE_KEY[f] ? t(FEATURE_KEY[f]) : f}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
