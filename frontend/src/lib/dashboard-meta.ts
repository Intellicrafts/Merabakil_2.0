export type ModuleTintKey =
  | "mera-vakil"
  | "research"
  | "marketplace"
  | "cases"
  | "documents"
  | "knowledge"
  | "courtroom"
  | "users";

export interface DashboardModuleMeta {
  tag: string;
  features: string[];
  tint: ModuleTintKey;
  /** Path under /public for optional hero accent imagery */
  imageSrc?: string;
  /** Short label for mobile quick-launch */
  shortLabel: string;
}

export const MODULE_META: Record<string, DashboardModuleMeta> = {
  "/mera-vakil": {
    tag: "Flagship",
    features: ["Multi-turn chat", "Live citations", "Read-aloud"],
    tint: "mera-vakil",
    imageSrc: "/dashboard/mera-vakil-hero.svg",
    shortLabel: "Mera Vakil",
  },
  "/research": {
    tag: "Research",
    features: ["Grounded answers", "Confidence scores"],
    tint: "research",
    imageSrc: "/dashboard/research-hero.svg",
    shortLabel: "Research",
  },
  "/lawyer-marketplace": {
    tag: "Marketplace",
    features: ["Top lawyers", "Book consultations"],
    tint: "marketplace",
    imageSrc: "/dashboard/marketplace-hero.svg",
    shortLabel: "Lawyers",
  },
  "/cases": {
    tag: "Cases",
    features: ["Track matters", "Status timeline"],
    tint: "cases",
    shortLabel: "Cases",
  },
  "/documents": {
    tag: "Documents",
    features: ["Upload & query", "Secure storage"],
    tint: "documents",
    shortLabel: "Docs",
  },
  "/courtroom": {
    tag: "Simulation",
    features: ["Live transcript", "Formal judgment"],
    tint: "courtroom",
    imageSrc: "/courtroom/courtroom-hero.svg",
    shortLabel: "Courtroom",
  },
  "/admin/knowledge": {
    tag: "Knowledge",
    features: ["Corpus ingestion", "Firm-wide index"],
    tint: "knowledge",
    shortLabel: "Knowledge",
  },
  "/admin/users": {
    tag: "Admin",
    features: ["Role management", "Access control"],
    tint: "users",
    shortLabel: "Users",
  },
};

export function getModuleMeta(href: string): DashboardModuleMeta {
  return (
    MODULE_META[href] ?? {
      tag: "Module",
      features: [],
      tint: "research",
      shortLabel: "Open",
    }
  );
}

export function tintClassName(tint: ModuleTintKey): string {
  return `dash-module-tint-${tint}`;
}
