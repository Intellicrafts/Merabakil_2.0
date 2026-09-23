import { createRequire } from "module";

const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
    ];

    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          ...securityHeaders,
        ],
      },
    ];
  },
  /** /ask was merged into the Saarthi page; keep the old URL working (the query
   *  string, incl. gclid, is forwarded automatically). */
  async redirects() {
    return [{ source: "/ask", destination: "/mera-vakil", permanent: true }];
  },
  /** Route browser API calls through Next.js so one public URL works on any device. */
  async rewrites() {
    const auth = process.env.API_PROXY_AUTH ?? "http://127.0.0.1:8001";
    const billing = process.env.API_PROXY_BILLING ?? "http://127.0.0.1:8020";
    const search = process.env.API_PROXY_SEARCH ?? "http://127.0.0.1:8003";
    const research = process.env.API_PROXY_RESEARCH ?? "http://127.0.0.1:8004";
    const marketplace = process.env.API_PROXY_MARKETPLACE ?? "http://127.0.0.1:8010";
    const ingestion = process.env.API_PROXY_INGESTION ?? "http://127.0.0.1:8002";
    const document = process.env.API_PROXY_DOCUMENT ?? "http://127.0.0.1:8005";
    const caseService = process.env.API_PROXY_CASE ?? "http://127.0.0.1:8011";
    return [
      { source: "/svc/auth/:path*", destination: `${auth}/:path*` },
      { source: "/svc/billing/:path*", destination: `${billing}/:path*` },
      { source: "/svc/search/:path*", destination: `${search}/:path*` },
      { source: "/svc/research/:path*", destination: `${research}/:path*` },
      { source: "/svc/marketplace/:path*", destination: `${marketplace}/:path*` },
      { source: "/svc/ingestion/:path*", destination: `${ingestion}/:path*` },
      { source: "/svc/document/:path*", destination: `${document}/:path*` },
      { source: "/svc/case/:path*", destination: `${caseService}/:path*` },
    ];
  },
};

const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? require("@next/bundle-analyzer")({ enabled: true })
    : (config) => config;

export default withBundleAnalyzer(nextConfig);
