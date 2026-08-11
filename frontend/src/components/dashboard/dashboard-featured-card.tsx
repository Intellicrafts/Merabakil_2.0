"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";

import { FeaturedMotif } from "@/components/dashboard/dashboard-visuals";
import type { DashboardModule } from "@/lib/dashboard-config";
import { getModuleMeta } from "@/lib/dashboard-meta";
import { cn } from "@/lib/utils";

export function DashboardFeaturedCard({ mod }: { mod: DashboardModule }) {
  const meta = getModuleMeta(mod.href);

  return (
    <Link
      href={mod.href}
      className={cn(
        "group relative col-span-full overflow-hidden rounded-3xl md:col-span-2",
        "min-h-[220px] md:min-h-[260px]",
        "border border-black/[0.08] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-800 text-white",
        "shadow-[0_20px_56px_rgba(15,23,42,0.22)]",
        "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_64px_rgba(15,23,42,0.28)]",
        "dark:border-white/[0.10] dark:from-zinc-100 dark:via-zinc-200 dark:to-zinc-300 dark:text-zinc-900",
        "dark:shadow-[0_20px_56px_rgba(0,0,0,0.4)]",
        "dash-card-in dash-module-tint-mera-vakil",
      )}
      style={{ animationDelay: "100ms" }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px dash-shimmer-line opacity-60" />
      <div className="pointer-events-none absolute -left-10 top-1/3 h-40 w-40 rounded-full bg-white/10 blur-3xl dash-hero-glow dark:bg-black/10" />

      <div className="relative grid h-full gap-4 p-6 md:grid-cols-[1.15fr_0.85fr] md:gap-6 md:p-8">
        <div className="flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/15 dark:bg-black/10 dark:ring-black/10">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55 dark:text-zinc-600">
                {meta.tag}
              </span>
            </div>

            <div>
              <h2 className="text-2xl font-semibold tracking-tight md:text-[1.75rem]">
                {mod.title}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-white/70 dark:text-zinc-600">
                {mod.description}
              </p>
            </div>

            {meta.features.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {meta.features.map((f) => (
                  <li
                    key={f}
                    className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90 ring-1 ring-white/10 dark:bg-black/[0.06] dark:text-zinc-700 dark:ring-black/5"
                  >
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition-transform duration-200 group-hover:translate-x-1 dark:bg-zinc-900 dark:text-white">
            Open {mod.title}
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>

        <div className="relative hidden min-h-[160px] overflow-hidden rounded-2xl ring-1 ring-white/10 dark:ring-black/10 md:block">
          {meta.imageSrc ? (
            <Image
              src={meta.imageSrc}
              alt=""
              fill
              priority
              className="object-cover opacity-90 transition-transform duration-500 group-hover:scale-[1.03]"
              sizes="(max-width: 768px) 0px, 360px"
            />
          ) : (
            <FeaturedMotif className="h-full w-full" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent dark:from-zinc-200/30" />
        </div>
      </div>
    </Link>
  );
}
