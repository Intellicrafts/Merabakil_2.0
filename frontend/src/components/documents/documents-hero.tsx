"use client";

import Image from "next/image";
import { FileStack, ShieldCheck, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

interface DocumentsHeroProps {
  documentCount?: number;
}

export function DocumentsHero({ documentCount }: DocumentsHeroProps) {
  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/55 backdrop-blur-xl",
        "px-4 py-4 sm:rounded-3xl sm:px-6 sm:py-5",
        "dark:border-white/[0.08] dark:bg-white/[0.03]",
        "dc-card-in",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px dc-shimmer-line" />
      <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-slate-400/15 blur-3xl dc-hero-glow dark:bg-slate-300/10" />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.05]">
            <span className="dc-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Secure document workspace
          </div>
          <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight sm:text-[1.65rem]">
            Document Library
          </h1>
          <p className="text-[13px] leading-relaxed text-muted-foreground sm:text-[14px]">
            Upload contracts and pleadings, then run scoped Q&amp;A with citations —
            kept private to your account.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-1 text-[11px] text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]">
              <FileStack className="h-3 w-3" strokeWidth={1.75} />
              {typeof documentCount === "number" ? `${documentCount} in library` : "Your corpus"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-1 text-[11px] text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]">
              <ShieldCheck className="h-3 w-3" strokeWidth={1.75} />
              Scoped Q&amp;A
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-1 text-[11px] text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]">
              <Sparkles className="h-3 w-3" strokeWidth={1.75} />
              PDF · TXT · DOC
            </span>
          </div>
        </div>

        <div className="relative mx-auto h-[120px] w-full max-w-[220px] shrink-0 sm:h-[140px] sm:max-w-[260px] lg:mx-0">
          <Image
            src="/documents/documents-hero.svg"
            alt=""
            fill
            className="object-contain"
            sizes="260px"
            priority
          />
        </div>
      </div>
    </header>
  );
}
