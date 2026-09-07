import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  CalendarClock,
  Database,
  FileText,
  FolderOpen,
  Search,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import type { AuthUser } from "@/lib/types";
import { FEATURES } from "@/lib/features";
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
  feature?: boolean;
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
    title: "Saarthi",
    description: "Your AI legal counsel — ask any question, get cited answers.",
    icon: Sparkles,
    permission: Permission.RESEARCH_READ,
    feature: FEATURES.SAARTHI,
  },
  {
    href: "/research",
    title: "Research Console",
    description: "Run deep research across statutes and judgments.",
    icon: Search,
    permission: Permission.RESEARCH_READ,
    feature: FEATURES.RESEARCH_CONSOLE,
  },
  {
    href: "/lawyer-marketplace",
    title: "Find an Advocate",
    description: "Connect with a verified advocate and book a consultation.",
    icon: Briefcase,
    permission: Permission.RESEARCH_READ,
    feature: FEATURES.MARKETPLACE,
  },
  {
    href: "/cases",
    title: "Case Management",
    description: "Track your matters, status, and next steps.",
    icon: FolderOpen,
    permission: Permission.CASE_READ,
    feature: FEATURES.CASES,
  },
  {
    href: "/documents",
    title: "Documents",
    description: "Upload files and ask questions about them.",
    icon: FileText,
    permission: Permission.DOCUMENT_READ,
  },
  {
    href: "/appointments",
    title: "My Consultations",
    description: "View and manage your upcoming and past appointments.",
    icon: CalendarClock,
    permission: Permission.RESEARCH_READ,
    feature: FEATURES.BOOKING,
  },
  {
    href: "/admin/knowledge",
    title: "Knowledge Hub",
    description: "Build and search your firm’s legal knowledge base.",
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
  {
    href: "/wallet",
    title: "My Wallet",
    description: "View your balance, top up funds, and track transactions.",
    icon: Wallet,
    permission: Permission.RESEARCH_READ,
    feature: FEATURES.WALLET,
  },
];

const ROLE_CONFIG: Record<
  PrimaryRole,
  Pick<DashboardConfig, "headline" | "subtitle"> & { moduleHrefs: string[] }
> = {
  admin: {
    headline: "Admin console",
    subtitle: "Manage users, appointments, and platform configuration.",
    moduleHrefs: [
      "/mera-vakil",
      "/research",
      "/lawyer-marketplace",
      "/cases",
      "/documents",
      "/admin/knowledge",
      "/admin/users",
      "/admin/appointments",
      "/wallet",
    ],
  },
  enterprise: {
    headline: "Legal counsel, simplified",
    subtitle: "AI-powered guidance and expert advocates when you need them.",
    moduleHrefs: [
      "/mera-vakil",
      "/research",
      "/lawyer-marketplace",
      "/documents",
      "/wallet",
    ],
  },
  law_firm: {
    headline: "Early access for your firm",
    subtitle: "Research, find advocates, and manage your matters.",
    moduleHrefs: [
      "/mera-vakil",
      "/research",
      "/lawyer-marketplace",
      "/cases",
      "/documents",
      "/admin/knowledge",
      "/wallet",
    ],
  },
  advocate: {
    headline: "Your client pipeline",
    subtitle: "Find new cases, manage consultations, and grow your practice.",
    moduleHrefs: [
      "/mera-vakil",
      "/appointments",
      "/cases",
      "/wallet",
    ],
  },
  citizen: {
    headline: "Welcome to the beta",
    subtitle: "AI-powered legal guidance and verified advocates, at your fingertips.",
    moduleHrefs: ["/mera-vakil", "/lawyer-marketplace", "/cases", "/wallet"],
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
    .filter((m) => m.feature !== false)
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
