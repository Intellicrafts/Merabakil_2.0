"use client";

import { useEffect, useState } from "react";
import { Crown, FileText, Gavel, Scale, Sparkles, X } from "lucide-react";

import { Mascot } from "@/components/mera-vakil/mascot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PREMIUM_DISMISS_KEY = "mera-vakil.premium-banner-dismissed";

const QUICK_ACTIONS = [
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
];

interface EmptyStateProps {
  onQuickAction: (prompt: string) => void;
  onOpenPremium: () => void;
}

export function EmptyState({ onQuickAction, onOpenPremium }: EmptyStateProps) {
  const [premiumDismissed, setPremiumDismissed] = useState(false);

  useEffect(() => {
    setPremiumDismissed(localStorage.getItem(PREMIUM_DISMISS_KEY) === "true");
  }, []);

  function dismissPremiumBanner() {
    setPremiumDismissed(true);
    localStorage.setItem(PREMIUM_DISMISS_KEY, "true");
  }

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
      </div>

      <div className="grid w-full max-w-xl gap-2.5 sm:grid-cols-2">
        {QUICK_ACTIONS.map((action, idx) => {
          const Icon = action.icon;
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

      {!premiumDismissed && (
        <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-black/[0.05] bg-white/55 p-3 shadow-[0_3px_18px_rgba(15,23,42,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]">
          <button
            type="button"
            onClick={dismissPremiumBanner}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10"
            aria-label="Dismiss premium banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <Crown
            className="pointer-events-none absolute -right-3 top-1/2 h-20 w-20 -translate-y-1/2 opacity-[0.07] dark:opacity-[0.12]"
            aria-hidden
          />
          <div className="relative flex flex-col items-start justify-between gap-2.5 pr-8 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-sm dark:from-slate-200 dark:to-slate-400 dark:text-slate-900">
                <Crown className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-[13px] font-semibold">Premium Plan</p>
                <p className="text-[11px] text-muted-foreground">
                  Unlimited queries · Priority research · Advanced drafting
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="h-7 shrink-0 rounded-full bg-gradient-to-r from-slate-800 to-slate-900 px-3.5 text-xs font-medium text-white shadow-sm transition-all hover:from-slate-700 hover:to-slate-800 hover:shadow-md dark:from-slate-100 dark:to-slate-300 dark:text-slate-900"
              aria-label="View premium plan"
              onClick={onOpenPremium}
            >
              Upgrade
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
