"use client";

import { useEffect, useState } from "react";
import { Briefcase, Crown, FileText, Gavel, Scale, Shield, Sparkles, X } from "lucide-react";

import { Mascot } from "@/components/mera-vakil/mascot";
import { Button } from "@/components/ui/button";
import { getStoredUser } from "@/lib/api";
import { getPrimaryRole, type PrimaryRole } from "@/lib/dashboard-config";
import { cn } from "@/lib/utils";

const PREMIUM_DISMISS_KEY = "mera-vakil.premium-banner-dismissed";

const QUICK_ACTIONS_BY_ROLE: Record<
  PrimaryRole,
  { icon: React.ElementType; title: string; prompt: string; gradient: string }[]
> = {
  citizen: [
    {
      icon: Scale,
      title: "Know my rights",
      prompt: "What are my fundamental rights as a citizen under the Indian Constitution, and how can I enforce them?",
      gradient: "from-slate-600 to-slate-800",
    },
    {
      icon: FileText,
      title: "Draft a complaint",
      prompt: "Help me draft a complaint letter to the consumer court under the Consumer Protection Act, 2019",
      gradient: "from-zinc-600 to-zinc-800",
    },
    {
      icon: Sparkles,
      title: "Explain a notice",
      prompt: "I received a legal notice. What does it mean, what must I do, and what are my options?",
      gradient: "from-gray-600 to-gray-800",
    },
    {
      icon: Briefcase,
      title: "Find a lawyer",
      prompt: "How do I find and evaluate a good lawyer in India for my legal problem? What should I ask before hiring?",
      gradient: "from-slate-700 to-zinc-900",
    },
  ],
  advocate: [
    {
      icon: FileText,
      title: "Draft a legal notice",
      prompt: "Draft a legal notice for breach of contract under Indian law",
      gradient: "from-slate-600 to-slate-800",
    },
    {
      icon: Scale,
      title: "Explain a section",
      prompt: "What is Article 21 of the Constitution of India?",
      gradient: "from-zinc-600 to-zinc-800",
    },
    {
      icon: Gavel,
      title: "Review a clause",
      prompt: "Review this indemnity clause for risks under Indian contract law",
      gradient: "from-gray-600 to-gray-800",
    },
    {
      icon: Sparkles,
      title: "Find case law",
      prompt: "What are the leading Supreme Court judgments on right to privacy?",
      gradient: "from-slate-700 to-zinc-900",
    },
  ],
  law_firm: [
    {
      icon: Sparkles,
      title: "Precedent research",
      prompt: "What are the leading Supreme Court and High Court judgments on wrongful termination under Indian employment law?",
      gradient: "from-slate-600 to-slate-800",
    },
    {
      icon: FileText,
      title: "Contract review",
      prompt: "Review this commercial contract and identify the key risk clauses under Indian law",
      gradient: "from-zinc-600 to-zinc-800",
    },
    {
      icon: Gavel,
      title: "FIR strategy",
      prompt: "Draft a professional FIR outline with sections likely attracted and documents to annex",
      gradient: "from-gray-600 to-gray-800",
    },
    {
      icon: Scale,
      title: "Section explainer",
      prompt: "Explain the relevant statutory section in plain professional English with leading Supreme Court interpretation",
      gradient: "from-slate-700 to-zinc-900",
    },
  ],
  enterprise: [
    {
      icon: Shield,
      title: "DPDP compliance",
      prompt: "What are our key obligations under the Digital Personal Data Protection Act, 2023 and the implementation timeline?",
      gradient: "from-slate-600 to-slate-800",
    },
    {
      icon: FileText,
      title: "Review a clause",
      prompt: "Review this indemnity clause in our vendor contract for risks under Indian contract law",
      gradient: "from-zinc-600 to-zinc-800",
    },
    {
      icon: Scale,
      title: "Employment law",
      prompt: "Summarise our key obligations under Indian employment and labour laws for a technology company",
      gradient: "from-gray-600 to-gray-800",
    },
    {
      icon: Sparkles,
      title: "Regulatory update",
      prompt: "What are the recent SEBI or RBI regulatory changes that listed companies or NBFCs must comply with?",
      gradient: "from-slate-700 to-zinc-900",
    },
  ],
  admin: [
    {
      icon: FileText,
      title: "Draft a legal notice",
      prompt: "Draft a legal notice for breach of contract under Indian law",
      gradient: "from-slate-600 to-slate-800",
    },
    {
      icon: Scale,
      title: "Explain a section",
      prompt: "What is Article 21 of the Constitution of India?",
      gradient: "from-zinc-600 to-zinc-800",
    },
    {
      icon: Gavel,
      title: "Review a clause",
      prompt: "Review this indemnity clause for risks under Indian contract law",
      gradient: "from-gray-600 to-gray-800",
    },
    {
      icon: Sparkles,
      title: "Find case law",
      prompt: "What are the leading Supreme Court judgments on right to privacy?",
      gradient: "from-slate-700 to-zinc-900",
    },
  ],
};

const ROLE_SUBTITLES: Record<PrimaryRole, string> = {
  citizen: "Ask about your rights, understand legal notices, or get connected to the right lawyer.",
  advocate: "Research faster, draft precisely, and cite with confidence.",
  law_firm: "Your firm's legal intelligence — research, precedents, and knowledge at your fingertips.",
  enterprise: "Compliance and legal intelligence for your organisation.",
  admin: "Full platform access — research, draft, manage, and administer.",
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
    <div className="no-scrollbar flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-10">
      <div className="relative flex items-center justify-center">
        <div className="aurora pointer-events-none absolute h-48 w-48 rounded-full" aria-hidden />
        <div className="mascot-float relative">
          <Mascot className="h-36 w-32 drop-shadow-lg" />
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Namaste! I&apos;m <span className="gradient-text">Mera Vakil</span>
        </h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">{subtitle}</p>
      </div>

      <div className="grid w-full max-w-xl gap-2.5 sm:grid-cols-2">
        {quickActions.map((action, idx) => {
          const Icon = action.icon as React.ElementType<{ className?: string }>;
          return (
            <button
              key={action.title}
              type="button"
              onClick={() => onQuickAction(action.prompt)}
              className="group flex items-center gap-2.5 rounded-xl border border-black/[0.05] bg-white/50 p-3 text-left shadow-[0_2px_14px_rgba(15,23,42,0.04)] backdrop-blur-md transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:bg-white/75 hover:shadow-[0_6px_22px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
            >
              <div
                className={cn(
                  "icon-breathe flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm transition-transform group-hover:scale-110 dark:from-slate-200 dark:to-slate-400 dark:text-slate-900",
                  action.gradient,
                )}
                style={{ animationDelay: `${idx * 0.4}s` }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-[13px] font-medium">{action.title}</p>
            </button>
          );
        })}
      </div>

      {showBanner && (
        <div
          className={cn(
            "relative w-full max-w-xl overflow-hidden rounded-xl border border-black/[0.05] bg-white/55 shadow-[0_3px_18px_rgba(15,23,42,0.05)] backdrop-blur-md transition-all duration-200 dark:border-white/10 dark:bg-white/[0.04]",
            bannerFading && "scale-[0.98] opacity-0",
          )}
        >
          <Crown
            className="pointer-events-none absolute -right-3 top-1/2 h-20 w-20 -translate-y-1/2 opacity-[0.07] dark:opacity-[0.12]"
            aria-hidden
          />
          <div className="relative flex items-center justify-between gap-3 p-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-sm dark:from-slate-200 dark:to-slate-400 dark:text-slate-900">
                <Crown className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold">Premium Plan</p>
                <p className="text-[11px] text-muted-foreground">
                  Unlimited queries · Priority research · Advanced drafting
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                size="sm"
                className="h-7 shrink-0 rounded-full bg-gradient-to-r from-slate-800 to-slate-900 px-3.5 text-xs font-medium text-white shadow-sm transition-all hover:from-slate-700 hover:to-slate-800 hover:shadow-md dark:from-slate-100 dark:to-slate-300 dark:text-slate-900"
                aria-label="View premium plan"
                onClick={onOpenPremium}
              >
                Upgrade
              </Button>
              <button
                type="button"
                onClick={dismissPremiumBanner}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/[0.06] hover:text-foreground dark:hover:bg-white/10"
                aria-label="Dismiss premium banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
