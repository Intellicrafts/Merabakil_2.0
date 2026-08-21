"use client";

import { memo } from "react";
import { BookOpen, Gavel, Globe, Scale } from "lucide-react";

import type { Citation, RetrievedSource, WebSearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

type AuthorityKind = "statute" | "judgment" | "web" | "authority";

interface AuthorityCard {
  id: string;
  kind: AuthorityKind;
  label: string;
  title: string;
  subtitle?: string;
  marker?: string;
}

function classifySource(source: RetrievedSource): AuthorityKind {
  const type = (source.doc_type || "").toLowerCase();
  if (
    type.includes("constitution") ||
    type.includes("act") ||
    type.includes("statute") ||
    type.includes("amendment")
  ) {
    return "statute";
  }
  if (type.includes("judgment") || type.includes("case") || type.includes("court")) {
    return "judgment";
  }
  const cite = (source.citation || "").toUpperCase();
  if (/\b(AIR|SCC|SCR|SCALE)\b/.test(cite)) return "judgment";
  return "authority";
}

function buildCards(
  sources: RetrievedSource[],
  citations: Citation[],
  webSources: WebSearchResult[],
): AuthorityCard[] {
  const cards: AuthorityCard[] = [];
  sources.slice(0, 6).forEach((source, idx) => {
    const kind = classifySource(source);
    const cite = citations.find((c) => c.document_id === source.document_id);
    cards.push({
      id: source.chunk_id,
      kind,
      label: kind === "statute" ? "Statute" : kind === "judgment" ? "Judgment" : "Authority",
      title: source.title || source.document_id,
      subtitle: source.section
        ? `§ ${source.section}${source.citation ? ` · ${source.citation}` : ""}`
        : source.citation || undefined,
      marker: cite?.marker || `[KB-${idx + 1}]`,
    });
  });
  webSources.slice(0, 3).forEach((src, idx) => {
    cards.push({
      id: src.url,
      kind: "web",
      label: "Web",
      title: src.title,
      subtitle: src.snippet.slice(0, 80),
      marker: `[WEB-${idx + 1}]`,
    });
  });
  return cards;
}

const KIND_ICON = {
  statute: Scale,
  judgment: Gavel,
  web: Globe,
  authority: BookOpen,
} as const;

interface AuthorityCardsProps {
  sources: RetrievedSource[];
  citations?: Citation[];
  webSources?: WebSearchResult[];
  onCitationClick?: (marker: string) => void;
}

export const AuthorityCards = memo(function AuthorityCards({
  sources,
  citations = [],
  webSources = [],
  onCitationClick,
}: AuthorityCardsProps) {
  const cards = buildCards(sources, citations, webSources);
  if (cards.length === 0) return null;

  return (
    <div className="mv-authority-strip" aria-label="Cited authorities">
      {cards.map((card) => {
        const Icon = KIND_ICON[card.kind];
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => card.marker && onCitationClick?.(card.marker)}
            className={cn(
              "mv-authority-card group text-left",
              card.kind === "web" && "mv-authority-card-web",
            )}
          >
            <span className="flex items-center gap-1.5">
              <Icon className="h-3 w-3 shrink-0 text-slate-500 dark:text-slate-400" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {card.label}
              </span>
            </span>
            <span className="mt-1 line-clamp-2 text-[12px] font-medium leading-snug">{card.title}</span>
            {card.subtitle && (
              <span className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{card.subtitle}</span>
            )}
          </button>
        );
      })}
    </div>
  );
});
