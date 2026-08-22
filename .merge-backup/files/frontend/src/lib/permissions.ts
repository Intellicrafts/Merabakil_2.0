import type { AuthUser } from "@/lib/types";

export const Permission = {
  RESEARCH_READ: "research:read",
  KNOWLEDGE_INGEST: "knowledge:ingest",
  SEARCH_READ: "search:read",
  DOCUMENT_READ: "document:read",
  DOCUMENT_WRITE: "document:write",
  USER_MANAGE: "user:manage",
  ROLE_MANAGE: "role:manage",
  AUDIT_READ: "audit:read",
  CASE_READ: "case:read",
  CASE_WRITE: "case:write",
  COURTROOM_SIMULATE: "courtroom:simulate",
} as const;

export type PermissionCode = (typeof Permission)[keyof typeof Permission];

/** Roles that receive courtroom access per platform seed (citizen excluded). */
const COURTROOM_ROLES = new Set(["advocate", "law_firm", "enterprise"]);

export function hasPermission(
  user: Pick<AuthUser, "roles" | "permissions"> | null | undefined,
  perm: string,
): boolean {
  if (!user) return false;
  if (user.roles.includes("admin")) return true;
  if (perm === Permission.COURTROOM_SIMULATE) {
    if (user.roles.some((r) => COURTROOM_ROLES.has(r))) return true;
  }
  return user.permissions.includes(perm);
}

const ROUTE_RULES: { pattern: RegExp; permission: PermissionCode | null }[] = [
  { pattern: /^\/login$/, permission: null },
  { pattern: /^\/register$/, permission: null },
  { pattern: /^\/forgot-password$/, permission: null },
  { pattern: /^\/reset-password$/, permission: null },
  { pattern: /^\/dashboard$/, permission: null },
  { pattern: /^\/mera-vakil$/, permission: Permission.RESEARCH_READ },
  { pattern: /^\/research$/, permission: Permission.RESEARCH_READ },
  { pattern: /^\/lawyer-marketplace$/, permission: Permission.RESEARCH_READ },
  { pattern: /^\/appointments(\/.*)?$/, permission: Permission.RESEARCH_READ },
  { pattern: /^\/cases(\/.*)?$/, permission: Permission.CASE_READ },
  { pattern: /^\/documents(\/.*)?$/, permission: Permission.DOCUMENT_READ },
  { pattern: /^\/courtroom$/, permission: Permission.COURTROOM_SIMULATE },
  { pattern: /^\/admin\/knowledge$/, permission: Permission.KNOWLEDGE_INGEST },
  { pattern: /^\/admin\/users$/, permission: Permission.USER_MANAGE },
  { pattern: /^\/admin\/appointments$/, permission: Permission.USER_MANAGE },
];

export function canAccessRoute(
  path: string,
  user: Pick<AuthUser, "roles" | "permissions"> | null | undefined,
): boolean {
  const normalized = path.split("?")[0].replace(/\/$/, "") || "/";
  if (normalized === "/") return true;
  const rule = ROUTE_RULES.find((r) => r.pattern.test(normalized));
  if (!rule) return true;
  if (rule.permission === null) return true;
  return hasPermission(user, rule.permission);
}

export function loginRedirectForUser(
  _user: Pick<AuthUser, "roles" | "permissions"> | null | undefined,
): string {
  return "/dashboard";
}
