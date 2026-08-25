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
    description: "Ask a legal question and get cited answers.",
    icon: Sparkles,
    permission: Permission.RESEARCH_READ,
  },
  {
    href: "/research",
    title: "Research Console",
    description: "Run deep research across statutes and judgments.",
    icon: Search,
    permission: Permission.RESEARCH_READ,
  },
  {
    href: "/lawyer-marketplace",
    title: "Lawyer Marketplace",
    description: "Find a lawyer and book a consultation.",
    icon: Briefcase,
    permission: Permission.RESEARCH_READ,
  },
  {
    href: "/cases",
    title: "Case Management",
    description: "Track your matters, status, and next steps.",
    icon: FolderOpen,
    permission: Permission.CASE_READ,
  },
  {
    href: "/courtroom",
    title: "AI Courtroom",
    description: "Rehearse a hearing with Judge and Advocate AI.",
    icon: Gavel,
    permission: Permission.COURTROOM_SIMULATE,
  },
  {
    href: "/documents",
    title: "Documents",
    description: "Upload files and ask questions about them.",
    icon: FileText,
    permission: Permission.DOCUMENT_READ,
  },
  {
    href: "/admin/knowledge",
    title: "Knowledge Hub",
    description: "Ingest and manage your firm’s legal corpus.",
    icon: Database,
    permission: Permission.KNOWLEDGE_INGEST,
  },
  {
    href: "/admin/users",
    title: "User Management",
    description: "Manage people, roles, and access.",
    icon: Users,
    permission: Permission.USER_MANAGE,
  },
  {
    href: "/admin/appointments",
    title: "Appointment Ops",
    description: "Oversee bookings, transcripts, and sessions.",
    icon: CalendarClock,
    permission: Permission.USER_MANAGE,
  },
];

const ROLE_CONFIG: Record<
  PrimaryRole,
  Pick<DashboardConfig, "headline" | "subtitle"> & { moduleHrefs: string[] }
> = {
  admin: {
    headline: "Everything in one place",
    subtitle: "Pick up counsel, cases, and firm tools.",
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
    headline: "Your legal work, simplified",
    subtitle: "Documents, research, and counsel when you need them.",
    moduleHrefs: [
      "/mera-vakil",
      "/courtroom",
      "/research",
      "/lawyer-marketplace",
      "/documents",
    ],
  },
  law_firm: {
    headline: "Your firm's home",
    subtitle: "Research, cases, and knowledge — continue where you left off.",
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
    headline: "Ready when you are",
    subtitle: "Research, cases, and counsel from one calm place.",
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
    subtitle: "Ask a question or pick up where you left off.",
    moduleHrefs: ["/mera-vakil", "/lawyer-marketplace", "/cases"],
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
