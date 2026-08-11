"use client";

import { BookOpen, Shield, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const TRUST_ITEMS = [
  { icon: Shield, text: "Enterprise RBAC" },
  { icon: BookOpen, text: "Indian legal corpus" },
  { icon: Sparkles, text: "Citation-grounded AI" },
] as const;

export function DashboardTrustBar({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 border-t border-black/[0.05] pt-8 dark:border-white/[0.06]",
        "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        "dash-card-in",
        className,
      )}
      style={{ animationDelay: "420ms" }}
    >
      {TRUST_ITEMS.map(({ icon: Icon, text }) => (
        <span
          key={text}
          className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-2 py-1 text-[11px] text-muted-foreground/70 transition-colors hover:border-black/[0.06] hover:bg-white/40 hover:text-muted-foreground dark:hover:border-white/[0.08] dark:hover:bg-white/[0.04]"
        >
          <Icon className="h-3 w-3" strokeWidth={1.75} />
          {text}
        </span>
      ))}
    </footer>
  );
}
