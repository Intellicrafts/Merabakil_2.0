"use client";

import { useMemo } from "react";
import { BookMarked, ExternalLink } from "lucide-react";

import type { LegalAuthority } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

interface CitationsPanelProps {
  authorities: LegalAuthority[];
  /** When true, hide unverified cites (e.g. PDF-ready view). */
  verifiedOnly?: boolean;
}

function kindLabel(kind?: string): string {
  if (kind === "corpus") return "Corpus";
  if (kind === "document") return "Document";
  if (kind === "web") return "Web";
  return "Unverified";
}

export function CitationsPanel({ authorities, verifiedOnly = false }: CitationsPanelProps) {
  const list = useMemo(
    () => (verifiedOnly ? authorities.filter((a) => a.verified) : authorities),
    [authorities, verifiedOnly],
  );
  const verifiedCount = useMemo(
    () => authorities.filter((a) => a.verified).length,
    [authorities],
  );
  const unverifiedCount = authorities.length - verifiedCount;

  return (
    <section
      className={cn(
        "rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-xl",
        "dark:border-white/[0.08] dark:bg-white/[0.035]",
        "cs-card-in",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookMarked className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Legal authorities · {list.length}
          </h2>
        </div>
        {authorities.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {verifiedCount} verified · {unverifiedCount} unverified
          </p>
        )}
      </div>
      {list.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          Authorities cited during hearing appear here with provenance.
        </p>
      ) : (
        <ul className="space-y-2">
          {list.map((auth) => (
            <li
              key={auth.id}
              className="flex gap-2 rounded-xl border border-black/[0.05] bg-white/50 p-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]"
            >
              <span className="shrink-0 rounded-md border border-stone-300/60 bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-700 dark:border-white/15 dark:bg-white/10 dark:text-zinc-200">
                {auth.marker}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[12px] font-medium">{auth.title}</p>
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                      auth.verified
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300",
                    )}
                  >
                    {auth.verified ? "Verified" : "Unverified"}
                  </span>
                  <span className="rounded-full border border-black/[0.06] px-1.5 py-0.5 text-[9px] text-muted-foreground dark:border-white/10">
                    {kindLabel(auth.sourceKind)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{auth.citation}</p>
                {auth.snippet && (
                  <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground/90">
                    {auth.snippet}
                  </p>
                )}
                {auth.url && (
                  <a
                    href={auth.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-sky-800 dark:text-sky-300"
                  >
                    Open source <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
