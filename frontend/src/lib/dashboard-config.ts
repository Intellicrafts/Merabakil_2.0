import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  CalendarClock,
  Database,
  FileText,
  FolderOpen,
  Gavel,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

import type { AuthUser } from "@/lib/types";
import { Permission, hasPermission } from "@/lib/permissions";

export type PrimaryRole =
  | "admin"
  | "enterprise"
  | "law_firm"
  | "advocate"
  | "citizen";

export interface DashboardModule {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  permission: string;
}

export interface DashboardConfig {
  role: PrimaryRole;
  headline: string;
  subtitle: string;
  modules: DashboardModule[];
}

const ROLE_PRIORITY: PrimaryRole[] = [
  "admin",
  "enterprise",
  "law_firm",
  "advocate",
  "citizen",
];

const ALL_MODULES: DashboardModule[] = [
  {
    href: "/mera-vakil",
    title: "Mera Vakil",
    description: "Chat with India's AI legal counsel — cited answers, voice support, document understanding.",
    icon: Sparkles,
    permission: Permission.RESEARCH_READ,
  },
  {
    href: "/research",
    title: "Research Console",
    description: "Research Indian law with AI precision — grounded in statutes, judgments, and cited sources.",
    icon: Search,
    permission: Permission.RESEARCH_READ,
  },
  {
    href: "/lawyer-marketplace",
    title: "Lawyer Marketplace",
    description: "Find verified lawyers by practice area, book consultations, and manage appointments.",
    icon: Briefcase,
    permission: Permission.RESEARCH_READ,
  },
  {
    href: "/cases",
    title: "Case Management",
    description: "Track your legal matters, monitor status updates, and keep all case details in one place.",
    icon: FolderOpen,
    permission: Permission.CASE_READ,
  },
  {
    href: "/courtroom",
    title: "AI Courtroom",
    description: "Practice hearings with an AI Judge and Advocate — structured, recorded, and reviewable.",
    icon: Gavel,
    permission: Permission.COURTROOM_SIMULATE,
  },
  {
    href: "/documents",
    title: "Documents",
    description: "Upload, organise, and query your legal documents — contracts, notices, evidence, and more.",
    icon: FileText,
    permission: Permission.DOCUMENT_READ,
  },
  {
    href: "/admin/knowledge",
    title: "Knowledge Hub",
    description: "Build and manage your firm's legal knowledge base — ingest documents for AI-powered search.",
    icon: Database,
    permission: Permission.KNOWLEDGE_INGEST,
  },
  {
    href: "/admin/users",
    title: "User Management",
    description: "Manage platform users, assign roles, and control access permissions.",
    icon: Users,
    permission: Permission.USER_MANAGE,
  },
  {
    href: "/admin/appointments",
    title: "Appointment Ops",
    description: "Oversee consultation bookings, review transcripts, and verify counsel.",
    icon: CalendarClock,
    permission: Permission.USER_MANAGE,
  },
];

const ROLE_CONFIG: Record<
  PrimaryRole,
  Pick<DashboardConfig, "headline" | "subtitle"> & { moduleHrefs: string[] }
> = {
  admin: {
    headline: "Platform control centre",
    subtitle: "Full access to all modules — research, documents, knowledge ingestion, users, and appointments.",
    moduleHrefs: [
      "/mera-vakil",
      "/courtroom",
      "/research",
      "/lawyer-marketplace",
      "/cases",
      "/documents",
      "/admin/knowledge",
      "/admin/users",
      "/admin/appointments",
    ],
  },
  enterprise: {
    headline: "Your organisation's legal intelligence",
    subtitle: "Stay compliant, manage legal documents, and get AI-powered guidance on Indian law.",
    moduleHrefs: [
      "/mera-vakil",
      "/courtroom",
      "/research",
      "/lawyer-marketplace",
      "/documents",
    ],
  },
  law_firm: {
    headline: "Your firm's legal intelligence hub",
    subtitle: "Research precedents, manage case documents, and build a searchable knowledge base for your practice.",
    moduleHrefs: [
      "/mera-vakil",
      "/courtroom",
      "/research",
      "/lawyer-marketplace",
      "/cases",
      "/documents",
      "/admin/knowledge",
    ],
  },
  advocate: {
    headline: "Your practice workspace",
    subtitle: "Research faster, draft with precision, and advise clients backed by cited Indian law.",
    moduleHrefs: [
      "/mera-vakil",
      "/courtroom",
      "/research",
      "/lawyer-marketplace",
      "/cases",
      "/documents",
    ],
  },
  citizen: {
    headline: "Your legal companion",
    subtitle: "Ask any legal question in plain language and get clear, cited answers on Indian law.",
    moduleHrefs: ["/mera-vakil", "/research", "/lawyer-marketplace", "/cases"],
  },
};

export function getPrimaryRole(
  user: Pick<AuthUser, "roles"> | null | undefined,
): PrimaryRole {
  if (!user?.roles?.length) return "citizen";
  for (const role of ROLE_PRIORITY) {
    if (user.roles.includes(role)) return role;
  }
  return "citizen";
}

export function getDashboardConfig(
  user: Pick<AuthUser, "roles" | "permissions"> | null | undefined,
): DashboardConfig {
  const role = getPrimaryRole(user);
  const roleMeta = ROLE_CONFIG[role];

  const modules = roleMeta.moduleHrefs
    .map((href) => ALL_MODULES.find((m) => m.href === href))
    .filter((m): m is DashboardModule => Boolean(m))
    .filter((m) => hasPermission(user, m.permission));

  return {
    role,
    headline: roleMeta.headline,
    subtitle: roleMeta.subtitle,
    modules,
  };
}

export function getRoleLabel(role: PrimaryRole): string {
  const labels: Record<PrimaryRole, string> = {
    admin: "Administrator",
    enterprise: "Enterprise",
    law_firm: "Law Firm",
    advocate: "Advocate",
    citizen: "Citizen",
  };
  return labels[role];
}
