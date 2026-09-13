export function resolvePageType(pathname: string): string {
  if (pathname === "/") return "marketing_landing";
  if (pathname === "/login" || pathname === "/register") return "auth";
  if (pathname.startsWith("/auth/onboarding")) return "onboarding";
  if (pathname === "/mera-vakil") return "ai_chat";
  if (pathname === "/dashboard") return "dashboard";
  if (pathname === "/lawyer-marketplace") return "marketplace";
  if (pathname.startsWith("/appointments")) return "appointments";
  if (pathname.startsWith("/documents")) return "documents";
  if (pathname.startsWith("/cases")) return "cases";
  if (pathname === "/wallet") return "wallet";
  if (pathname === "/profile") return "profile";
  if (pathname === "/research") return "research";
  if (pathname === "/privacy" || pathname === "/terms") return "legal";
  if (pathname === "/faq") return "faq";
  if (pathname.startsWith("/admin")) return "admin";
  return "other";
}
