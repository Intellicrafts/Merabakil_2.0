"use client";

import Image from "next/image";
import { ArrowUpRight, Sparkles } from "lucide-react";

import type { DemoDocument } from "@/lib/demo-documents";
import { cn } from "@/lib/utils";

interface DocumentsDemoGridProps {
  demos: DemoDocument[];
  onUseDemo: (demo: DemoDocument) => void;
}

export function DocumentsDemoGrid({ demos, onUseDemo }: DocumentsDemoGridProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Demo documents
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Preview common matter types — use a card to prefill your upload title.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {demos.map((demo, index) => (
          <article
            key={demo.id}
            style={{ animationDelay: `${60 + index * 50}ms` }}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white/60 backdrop-blur-xl",
              "transition-all duration-300 ease-out",
              "hover:border-slate-300/70 hover:bg-white/90",
              "hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]",
              "motion-safe:hover:-translate-y-0.5",
              "dark:border-white/[0.08] dark:bg-white/[0.04]",
              "dark:hover:border-white/20 dark:hover:bg-white/[0.07]",
              "dc-card-in",
            )}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px dc-shimmer-line opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="relative h-[120px] overflow-hidden bg-slate-100/80 dark:bg-white/[0.03]">
              <Image
                src={demo.image}
                alt=""
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                sizes="(max-width:640px) 100vw, 33vw"
              />
            </div>

            <div className="flex flex-1 flex-col p-3.5">
              <div className="mb-1.5 flex flex-wrap gap-1">
                {demo.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-black/[0.06] bg-white/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h3 className="text-[14px] font-semibold tracking-tight">{demo.title}</h3>
              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                {demo.subtitle}
              </p>
              <button
                type="button"
                onClick={() => onUseDemo(demo)}
                className="dc-btn-soft mt-3 h-9 w-full rounded-xl text-[12px] font-semibold"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Use this template
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
