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
    description: "Conversational legal AI with citations and read-aloud.",
    icon: Sparkles,
    permission: Permission.RESEARCH_READ,
  },
  {
    href: "/research",
    title: "Research Console",
    description: "Deep grounded legal research with confidence scoring.",
    icon: Search,
    permission: Permission.RESEARCH_READ,
  },
  {
    href: "/lawyer-marketplace",
    title: "Lawyer Marketplace",
    description: "Browse top lawyers and book consultations.",
    icon: Briefcase,
    permission: Permission.RESEARCH_READ,
  },
  {
    href: "/cases",
    title: "Case Management",
    description: "Track legal matters, status, and timelines.",
    icon: FolderOpen,
    permission: Permission.CASE_READ,
  },
  {
    href: "/courtroom",
    title: "AI Courtroom",
    description: "Simulate hearings with Judge and Advocate AI — procedural and reviewable.",
    icon: Gavel,
    permission: Permission.COURTROOM_SIMULATE,
  },
  {
    href: "/documents",
    title: "Documents",
    description: "Upload, manage, and query your legal documents.",
    icon: FileText,
    permission: Permission.DOCUMENT_READ,
  },
  {
    href: "/admin/knowledge",
    title: "Knowledge Hub",
    description: "Ingest and manage firm-wide legal corpora.",
    icon: Database,
    permission: Permission.KNOWLEDGE_INGEST,
  },
  {
    href: "/admin/users",
    title: "User Management",
    description: "Manage platform users, roles, and access.",
    icon: Users,
    permission: Permission.USER_MANAGE,
  },
  {
    href: "/admin/appointments",
    title: "Appointment Ops",
    description: "Oversee bookings, transcripts, and counsel verification.",
    icon: CalendarClock,
    permission: Permission.USER_MANAGE,
  },
];

const ROLE_CONFIG: Record<
  PrimaryRole,
  Pick<DashboardConfig, "headline" | "subtitle"> & { moduleHrefs: string[] }
> = {
  admin: {
    headline: "Platform control center",
    subtitle: "Full access to research, documents, knowledge ingestion, and user administration.",
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
    headline: "Compliance & document operations",
    subtitle: "Enterprise legal intelligence with document workflows and audit visibility.",
    moduleHrefs: [
      "/mera-vakil",
      "/courtroom",
      "/research",
      "/lawyer-marketplace",
      "/documents",
    ],
  },
  law_firm: {
    headline: "Firm intelligence hub",
    subtitle: "Research, documents, and knowledge management for your practice.",
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
    subtitle: "Research faster, manage documents, and advise clients with grounded citations.",
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
    subtitle: "Ask legal questions and explore Indian law with AI-powered guidance.",
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
