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
} as const;

export type PermissionCode = (typeof Permission)[keyof typeof Permission];

const ROUTE_RULES: { pattern: RegExp; permission: PermissionCode | null }[] = [
  { pattern: /^\/login$/, permission: null },
  { pattern: /^\/mera-vakil$/, permission: Permission.RESEARCH_READ },
  { pattern: /^\/research$/, permission: Permission.RESEARCH_READ },
  { pattern: /^\/documents(\/.*)?$/, permission: Permission.DOCUMENT_READ },
  { pattern: /^\/admin\/knowledge$/, permission: Permission.KNOWLEDGE_INGEST },
  { pattern: /^\/admin\/users$/, permission: Permission.USER_MANAGE },
];

export function hasPermission(
  user: Pick<AuthUser, "roles" | "permissions"> | null | undefined,
  perm: string,
): boolean {
  if (!user) return false;
  if (user.roles.includes("admin")) return true;
  return user.permissions.includes(perm);
}

export function canAccessRoute(
  path: string,
  user: Pick<AuthUser, "roles" | "permissions"> | null | undefined,
): boolean {
  const normalized = path.split("?")[0].replace(/\/$/, "") || "/";
  const rule = ROUTE_RULES.find((r) => r.pattern.test(normalized));
  if (!rule) return true;
  if (rule.permission === null) return true;
  return hasPermission(user, rule.permission);
}

export function loginRedirectForUser(
  user: Pick<AuthUser, "roles" | "permissions"> | null | undefined,
): string {
  if (hasPermission(user, Permission.RESEARCH_READ)) return "/research";
  if (hasPermission(user, Permission.DOCUMENT_READ)) return "/documents";
  if (hasPermission(user, Permission.KNOWLEDGE_INGEST)) return "/admin/knowledge";
  if (hasPermission(user, Permission.USER_MANAGE)) return "/admin/users";
  return "/research";
}
