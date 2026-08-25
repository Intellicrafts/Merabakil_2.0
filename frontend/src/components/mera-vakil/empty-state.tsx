"use client";

import { useEffect, useState } from "react";
import { Crown, X } from "lucide-react";

import { AshokaStambh } from "@/components/mera-vakil/ashoka-stambh";
import { getStoredUser } from "@/lib/api";
import { getPrimaryRole, type PrimaryRole } from "@/lib/dashboard-config";
import { cn } from "@/lib/utils";

const PREMIUM_DISMISS_KEY = "mera-vakil.premium-banner-dismissed";

const QUICK_ACTIONS_BY_ROLE: Record<PrimaryRole, { title: string; prompt: string }[]> = {
  citizen: [
    { title: "Know my rights", prompt: "What are my fundamental rights under the Indian Constitution?" },
    { title: "Draft a complaint", prompt: "Help me draft a consumer complaint under the Consumer Protection Act, 2019." },
    { title: "Explain a notice", prompt: "I received a legal notice. What does it mean and what should I do?" },
    { title: "Find a lawyer", prompt: "How do I find and evaluate a lawyer in India for my matter?" },
  ],
  advocate: [
    { title: "Draft a notice", prompt: "Draft a legal notice for breach of contract under Indian law." },
    { title: "Explain a section", prompt: "What is Article 21 of the Constitution of India?" },
    { title: "Review a clause", prompt: "Review this indemnity clause for risks under Indian contract law." },
    { title: "Find case law", prompt: "What are the leading Supreme Court judgments on the right to privacy?" },
  ],
  law_firm: [
    { title: "Find precedent", prompt: "Leading Supreme Court and High Court judgments on wrongful termination in India." },
    { title: "Review a contract", prompt: "Identify the key risk clauses in this commercial contract under Indian law." },
    { title: "FIR outline", prompt: "Draft a professional FIR outline with likely sections and documents to annex." },
    { title: "Explain a section", prompt: "Explain the relevant statutory section with leading Supreme Court interpretation." },
  ],
  enterprise: [
    { title: "DPDP compliance", prompt: "What are our key obligations under the Digital Personal Data Protection Act, 2023?" },
    { title: "Review a clause", prompt: "Review this vendor indemnity clause for risks under Indian contract law." },
    { title: "Employment law", prompt: "Summarise key Indian employment obligations for a technology company." },
    { title: "Regulatory update", prompt: "What recent SEBI or RBI changes must listed companies or NBFCs comply with?" },
  ],
  admin: [
    { title: "Draft a notice", prompt: "Draft a legal notice for breach of contract under Indian law." },
    { title: "Explain a section", prompt: "What is Article 21 of the Constitution of India?" },
    { title: "Review a clause", prompt: "Review this indemnity clause for risks under Indian contract law." },
    { title: "Find case law", prompt: "What are the leading Supreme Court judgments on the right to privacy?" },
  ],
};

const ROLE_SUBTITLES: Record<PrimaryRole, string> = {
  citizen: "Ask a legal question. Receive cited guidance.",
  advocate: "Research, draft, and cite with confidence.",
  law_firm: "Firm research, precedents, and knowledge in one place.",
  enterprise: "Compliance and legal intelligence for your organisation.",
  admin: "Research, draft, and administer from one desk.",
};

interface EmptyStateProps {
  onQuickAction: (prompt: string) => void;
  onOpenPremium: () => void;
}

export function EmptyState({ onQuickAction, onOpenPremium }: EmptyStateProps) {
  const [premiumDismissed, setPremiumDismissed] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [bannerFading, setBannerFading] = useState(false);

  const role = getPrimaryRole(getStoredUser());
  const quickActions = QUICK_ACTIONS_BY_ROLE[role];
  const subtitle = ROLE_SUBTITLES[role];

  useEffect(() => {
    setPremiumDismissed(localStorage.getItem(PREMIUM_DISMISS_KEY) === "true");
  }, []);

  function dismissPremiumBanner(e: React.MouseEvent) {
    e.stopPropagation();
    setBannerFading(true);
    setTimeout(() => {
      setPremiumDismissed(true);
      setBannerVisible(false);
      localStorage.setItem(PREMIUM_DISMISS_KEY, "true");
    }, 200);
  }

  const showBanner = !premiumDismissed && bannerVisible;

  return (
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10">
      <AshokaStambh className="h-36 w-[7.5rem]" size="hero" />

      <div className="mt-5 max-w-md text-center">
        <h2 className="text-[1.7rem] font-semibold tracking-tight">
          <span className="gradient-text">Saarthi</span>
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      </div>

      <div
        className="mt-8 grid w-full max-w-md grid-cols-2 gap-2"
        aria-label="Suggested questions"
      >
        {quickActions.map((action) => (
          <button
            key={action.title}
            type="button"
            onClick={() => onQuickAction(action.prompt)}
            className={cn(
              "rounded-xl border border-black/[0.07] bg-white px-3.5 py-3 text-left text-[13px] font-medium leading-snug text-foreground/90",
              "shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] transition-colors",
              "hover:border-amber-800/25 hover:bg-amber-50/70 hover:text-foreground",
              "dark:border-white/[0.10] dark:bg-zinc-900 dark:shadow-none",
              "dark:hover:border-amber-500/30 dark:hover:bg-amber-500/[0.06]",
            )}
          >
            {action.title}
          </button>
        ))}
      </div>

      {showBanner && (
        <div
          className={cn(
            "mt-8 flex w-full max-w-md items-center justify-between gap-3 transition-opacity duration-200",
            bannerFading && "opacity-0",
          )}
        >
          <button
            type="button"
            onClick={onOpenPremium}
            className="flex min-w-0 items-center gap-2 text-left text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Crown className="h-3.5 w-3.5 shrink-0 text-amber-800/70 dark:text-amber-500/80" />
            <span className="truncate">Premium — unlimited queries</span>
          </button>
          <button
            type="button"
            onClick={dismissPremiumBanner}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10"
            aria-label="Dismiss premium note"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
