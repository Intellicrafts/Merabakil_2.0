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
    tag: "Saarthi AI",
    features: ["Cited answers", "Voice support", "Multi-language"],
    tint: "mera-vakil",
    imageSrc: "/dashboard/mera-vakil-hero.svg",
    shortLabel: "Saarthi",
  },
  "/research": {
    tag: "Research",
    features: ["Statute search", "Case law", "Cited sources"],
    tint: "research",
    imageSrc: "/dashboard/research-hero.svg",
    shortLabel: "Research",
  },
  "/lawyer-marketplace": {
    tag: "Find an Advocate",
    features: ["Verified advocates", "Book instantly", "AI matching"],
    tint: "marketplace",
    imageSrc: "/dashboard/marketplace-hero.svg",
    shortLabel: "Advocates",
  },
  "/cases": {
    tag: "Case Management",
    features: ["Matter tracking", "Status timeline", "Team access"],
    tint: "cases",
    shortLabel: "Cases",
  },
  "/documents": {
    tag: "Documents",
    features: ["Upload & query", "AI-powered search", "Secure storage"],
    tint: "documents",
    shortLabel: "Docs",
  },
  "/courtroom": {
    tag: "Simulation",
    features: ["Practice hearings", "AI judge feedback", "Transcript"],
    tint: "courtroom",
    imageSrc: "/courtroom/courtroom-hero.svg",
    shortLabel: "Courtroom",
  },
  "/admin/knowledge": {
    tag: "Knowledge Base",
    features: ["Build firm corpus", "Team-wide access", "AI-indexed"],
    tint: "knowledge",
    shortLabel: "Knowledge",
  },
  "/admin/users": {
    tag: "Administration",
    features: ["Role control", "Access management", "Audit trail"],
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
