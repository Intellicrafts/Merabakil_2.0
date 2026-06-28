"use client";

import { useEffect } from "react";
import {
  Check,
  Crown,
  FileText,
  Scale,
  Shield,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: Zap, label: "Unlimited legal queries", detail: "No daily caps on research or chat" },
  { icon: Scale, label: "Priority grounded research", detail: "Faster corpus + web intelligence" },
  { icon: FileText, label: "Advanced drafting", detail: "Notices, contracts, compliance memos" },
  { icon: Shield, label: "Enterprise security", detail: "Private document vault & audit trail" },
  { icon: Sparkles, label: "Citation-grade answers", detail: "Verified sources with confidence scoring" },
];

interface PremiumModalProps {
  open: boolean;
  onClose: () => void;
}

export function PremiumModal({ open, onClose }: PremiumModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="premium-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close premium modal"
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-zinc-950">
        {/* Decorative header band */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-black px-6 py-8 text-white dark:from-slate-200 dark:via-slate-300 dark:to-slate-400 dark:text-slate-900">
          <Crown
            className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 opacity-[0.12]"
            aria-hidden
          />
          <Sparkles
            className="pointer-events-none absolute bottom-2 left-4 h-16 w-16 opacity-[0.08]"
            aria-hidden
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white dark:text-slate-700 dark:hover:bg-black/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm dark:bg-black/10">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-widest text-white/60 dark:text-slate-600">
                Bakilat Legal OS
              </p>
              <h2 id="premium-modal-title" className="text-xl font-semibold tracking-tight">
                Mera Vakil Premium
              </h2>
            </div>
          </div>
          <p className="relative mt-3 max-w-sm text-[13px] leading-relaxed text-white/75 dark:text-slate-700">
            Enterprise-grade legal intelligence for advocates, in-house teams, and businesses across India.
          </p>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-6">
          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, label, detail }) => (
              <li key={label} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/[0.04] dark:bg-white/10">
                  <Icon className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                </div>
                <div>
                  <p className="text-[13px] font-medium">{label}</p>
                  <p className="text-[11px] text-muted-foreground">{detail}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-2xl font-semibold tracking-tight">₹2,499</p>
                <p className="text-[11px] text-muted-foreground">per seat / month</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                14-day trial
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              className="h-9 flex-1 rounded-lg bg-gradient-to-r from-slate-800 to-slate-900 text-xs font-medium text-white hover:from-slate-700 hover:to-slate-800 dark:from-slate-100 dark:to-slate-300 dark:text-slate-900"
              onClick={onClose}
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Start free trial
            </Button>
            <Button variant="ghost" className="h-9 rounded-lg text-xs" onClick={onClose}>
              Maybe later
            </Button>
          </div>

          <p className="text-center text-[10px] text-muted-foreground">
            Billing integration coming soon · Contact admin@legalos.in for enterprise plans
          </p>
        </div>
      </div>
    </div>
  );
}
