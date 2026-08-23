const STACK_KEY = "legalos.nav.stack";
const SKIP_KEY = "legalos.nav.skipNext";
const FALLBACK = "/dashboard";

const PUBLIC_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password", "/auth/onboarding"];

/** Module list routes — top-level destinations after dashboard. */
const MODULE_ROOTS = [
  "/mera-vakil",
  "/research",
  "/lawyer-marketplace",
  "/cases",
  "/documents",
  "/courtroom",
  "/admin/knowledge",
  "/admin/users",
  "/admin/appointments",
] as const;

export function resolveRouteLabel(pathname: string): string {
  if (pathname === "/dashboard" || pathname === "/") return "Home";
  if (pathname === "/research") return "Research";
  if (pathname === "/lawyer-marketplace") return "Marketplace";
  if (pathname === "/mera-vakil") return "Mera Vakil";
  if (pathname.startsWith("/cases")) return "Cases";
  if (pathname.startsWith("/documents")) return "Documents";
  if (pathname.startsWith("/courtroom")) return "AI Courtroom";
  if (pathname.startsWith("/admin/knowledge")) return "Knowledge Hub";
  if (pathname.startsWith("/admin/users")) return "Users";
  if (pathname.startsWith("/admin/appointments")) return "Appointments";
  return "previous page";
}

/** Parent route when there is no navigation history (refresh, deep link). */
export function resolveSmartFallback(pathname: string): string {
  const path = pathname.split("?")[0] || pathname;
  if (path.startsWith("/cases/") && path !== "/cases") return "/cases";
  if (path.startsWith("/documents/") && path !== "/documents") return "/documents";
  if (MODULE_ROOTS.includes(path as (typeof MODULE_ROOTS)[number])) return FALLBACK;
  if (path.startsWith("/admin/")) return FALLBACK;
  return FALLBACK;
}

function normalizePath(pathname: string): string {
  return pathname.split("?")[0] || pathname;
}

function isTrackable(path: string): boolean {
  if (!path || path === "/") return false;
  return !PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(`${p}?`));
}

function loadStack(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STACK_KEY);
    const stack = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(stack) ? stack.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}

function saveStack(stack: string[]): void {
  window.sessionStorage.setItem(STACK_KEY, JSON.stringify(stack.slice(-24)));
}

function shouldSkipNextTrack(): boolean {
  if (typeof window === "undefined") return false;
  const skip = window.sessionStorage.getItem(SKIP_KEY);
  if (skip === "1") {
    window.sessionStorage.removeItem(SKIP_KEY);
    return true;
  }
  return false;
}

/** Tell the tracker the next pathname change is from our Back button (not a new visit). */
export function markNavigatingBack(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SKIP_KEY, "1");
}

/** Align stack with browser back/forward so peek/consume stay accurate. */
export function syncStackToPath(pathname: string): void {
  if (typeof window === "undefined") return;
  const path = normalizePath(pathname);
  if (!isTrackable(path)) return;

  const stack = loadStack();
  const idx = stack.lastIndexOf(path);
  if (idx >= 0) {
    saveStack(stack.slice(0, idx + 1));
    return;
  }
  if (stack[stack.length - 1] !== path) {
    stack.push(path);
    saveStack(stack);
  }
}

/** Record a visited app route (skips auth pages and duplicates). */
export function trackNavPath(pathname: string): void {
  if (typeof window === "undefined") return;
  const path = normalizePath(pathname);
  if (!isTrackable(path)) return;

  if (shouldSkipNextTrack()) {
    syncStackToPath(path);
    return;
  }

  const stack = loadStack();
  if (stack[stack.length - 1] === path) return;
  stack.push(path);
  saveStack(stack);
}

export function peekBackPath(currentPathname: string, fallback?: string): string {
  const fallbackHref = fallback ?? resolveSmartFallback(currentPathname);
  const stack = loadStack();
  const current = normalizePath(currentPathname);

  if (stack.length >= 2 && stack[stack.length - 1] === current) {
    return stack[stack.length - 2] || fallbackHref;
  }
  if (stack.length >= 2) {
    return stack[stack.length - 2] || fallbackHref;
  }
  return fallbackHref;
}

/** Pop current route and return the previous path to navigate to. */
export function consumeBackPath(currentPathname: string, fallback?: string): string {
  const fallbackHref = fallback ?? resolveSmartFallback(currentPathname);
  const stack = loadStack();
  const current = normalizePath(currentPathname);

  if (stack.length >= 2 && stack[stack.length - 1] === current) {
    stack.pop();
    const prev = stack[stack.length - 1] || fallbackHref;
    saveStack(stack);
    return prev;
  }

  saveStack([fallbackHref]);
  return fallbackHref;
}

export function getBackLabel(currentPathname: string, fallback?: string): string {
  const prev = peekBackPath(currentPathname, fallback);
  return resolveRouteLabel(prev);
}
