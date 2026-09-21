import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site-metadata";

const PUBLIC_ROUTES = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/mera-vakil", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/register", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/login", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/privacy", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/terms", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/faq", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/forgot-password", priority: 0.3, changeFrequency: "yearly" as const },
  // Legal-guides content hub + published clusters (SEO landing pages)
  { path: "/legal-guides", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/legal-guides/property-law", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/legal-guides/family-law", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/legal-guides/labour-law", priority: 0.7, changeFrequency: "monthly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE.url}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
