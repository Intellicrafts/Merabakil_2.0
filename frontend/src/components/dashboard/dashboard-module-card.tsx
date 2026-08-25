"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import type { DashboardModule } from "@/lib/dashboard-config";
import { getModuleMeta } from "@/lib/dashboard-meta";
import { cn } from "@/lib/utils";

const MODULE_CTA: Record<string, string> = {
  "/mera-vakil": "Start counsel",
  "/research": "Open research",
  "/lawyer-marketplace": "Find lawyers",
  "/cases": "View cases",
  "/documents": "View documents",
  "/courtroom": "Enter courtroom",
  "/admin/knowledge": "Manage corpus",
  "/admin/users": "Manage users",
  "/admin/appointments": "View appointments",
};

export function DashboardModuleCard({
  mod,
  index = 0,
}: {
  mod: DashboardModule;
  index?: number;
}) {
  const Icon = mod.icon;
  const meta = getModuleMeta(mod.href);
  const cta = MODULE_CTA[mod.href] ?? "Open workspace";
  const delayMs = 140 + index * 55;

  return (
    <Link
      href={mod.href}
      className={cn(
        "group relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-2xl p-5",
        "border border-black/[0.06] bg-white",
        "shadow-sm",
        "transition-colors duration-200",
        "hover:border-slate-300 hover:shadow-md",
        "active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/35 focus-visible:ring-offset-2",
        "dark:border-white/[0.08] dark:bg-zinc-900",
        "dark:hover:border-zinc-600",
        "dash-card-in",
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >

      {meta.imageSrc && meta.tint !== "mera-vakil" && (
        <div className="pointer-events-none absolute bottom-0 right-0 h-20 w-28 opacity-40 transition-opacity duration-300 group-hover:opacity-60">
          <Image
            src={meta.imageSrc}
            alt=""
            fill
            className="object-contain object-right-bottom"
            sizes="112px"
          />
        </div>
      )}

      <div className="relative">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-black/[0.06] bg-white/80 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.08]">
            <Icon className="h-[18px] w-[18px] text-foreground/80" strokeWidth={1.75} />
          </div>
          <span className="rounded-full bg-black/[0.04] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:bg-white/[0.06]">
            {meta.tag}
          </span>
        </div>
        <h3 className="text-[15px] font-semibold tracking-tight">{mod.title}</h3>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
          {mod.description}
        </p>
        {meta.features.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1">
            {meta.features.slice(0, 2).map((feature) => (
              <li
                key={feature}
                className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:bg-white/[0.06]"
              >
                {feature}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="relative mt-5 flex items-center justify-between border-t border-black/[0.05] pt-3.5 dark:border-white/[0.06]">
        <span className="text-[11px] font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
          {cta}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.06] bg-black/[0.02] transition-all duration-200 group-hover:bg-slate-900 group-hover:text-white dark:border-white/[0.08] dark:bg-white/[0.04] dark:group-hover:bg-white dark:group-hover:text-slate-900">
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
        </span>
      </div>
    </Link>
  );
}
