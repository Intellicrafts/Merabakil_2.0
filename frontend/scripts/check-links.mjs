#!/usr/bin/env node
/**
 * Crawl public routes and fail on broken internal links.
 * Usage: node scripts/check-links.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? process.env.CHECK_LINKS_BASE ?? "http://localhost:3000";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/mera-vakil",
  "/privacy",
  "/terms",
  "/faq",
  "/forgot-password",
];

const failures = [];

async function checkRoute(route) {
  const url = `${BASE}${route}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    failures.push(`${route} → HTTP ${res.status}`);
    return;
  }
  const html = await res.text();
  const hrefs = [...html.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1]);
  const unique = [...new Set(hrefs)];

  for (const href of unique) {
    if (href.startsWith("/svc") || href.startsWith("/api")) continue;
    const linkRes = await fetch(`${BASE}${href}`, { redirect: "follow" });
    if (!linkRes.ok) {
      failures.push(`${route} → broken link ${href} (HTTP ${linkRes.status})`);
    }
  }
}

async function main() {
  console.log(`Checking links at ${BASE} …`);
  for (const route of PUBLIC_ROUTES) {
    await checkRoute(route);
  }

  if (failures.length) {
    console.error("Broken links found:");
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log(`All ${PUBLIC_ROUTES.length} public routes OK.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
