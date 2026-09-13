import type { MetadataRoute } from "next";

import { SITE } from "@/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/api", "/svc", "/cases", "/documents", "/appointments", "/profile", "/wallet", "/research"],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
