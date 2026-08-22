/**
 * Resolve backend base URLs for local dev vs public tunnel access.
 * On trycloudflare.com (or any non-localhost host), always use same-origin /svc/* proxy.
 */

function isLocalBrowserHost(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export function resolveServiceUrl(
  envValue: string | undefined,
  localDefault: string,
  proxyPath: string,
): string {
  if (envValue?.startsWith("/")) return envValue;
  if (!isLocalBrowserHost()) return proxyPath;
  return envValue ?? localDefault;
}

export function authServiceUrl(): string {
  return resolveServiceUrl(
    process.env.NEXT_PUBLIC_AUTH_API_URL,
    "http://localhost:8001",
    "/svc/auth",
  );
}

export function searchServiceUrl(): string {
  return resolveServiceUrl(
    process.env.NEXT_PUBLIC_SEARCH_API_URL,
    "http://localhost:8003",
    "/svc/search",
  );
}

export function researchServiceUrl(): string {
  return resolveServiceUrl(
    process.env.NEXT_PUBLIC_RESEARCH_API_URL,
    "http://localhost:8004",
    "/svc/research",
  );
}

export function marketplaceServiceUrl(): string {
  return resolveServiceUrl(
    process.env.NEXT_PUBLIC_MARKETPLACE_API_URL,
    "http://localhost:8010",
    "/svc/marketplace",
  );
}

export function ingestionServiceUrl(): string {
  return resolveServiceUrl(
    process.env.NEXT_PUBLIC_INGESTION_API_URL,
    "http://localhost:8002",
    "/svc/ingestion",
  );
}

export function documentServiceUrl(): string {
  return resolveServiceUrl(
    process.env.NEXT_PUBLIC_DOCUMENT_API_URL,
    "http://localhost:8005",
    "/svc/document",
  );
}