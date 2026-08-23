import { createRequire } from "module";

const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  /** Route browser API calls through Next.js so one public URL works on any device. */
  async rewrites() {
    const auth = process.env.API_PROXY_AUTH ?? "http://127.0.0.1:8001";
    const search = process.env.API_PROXY_SEARCH ?? "http://127.0.0.1:8003";
    const research = process.env.API_PROXY_RESEARCH ?? "http://127.0.0.1:8004";
    const marketplace = process.env.API_PROXY_MARKETPLACE ?? "http://127.0.0.1:8010";
    const ingestion = process.env.API_PROXY_INGESTION ?? "http://127.0.0.1:8002";
    const document = process.env.API_PROXY_DOCUMENT ?? "http://127.0.0.1:8005";
    return [
      { source: "/svc/auth/:path*", destination: `${auth}/:path*` },
      { source: "/svc/search/:path*", destination: `${search}/:path*` },
      { source: "/svc/research/:path*", destination: `${research}/:path*` },
      { source: "/svc/marketplace/:path*", destination: `${marketplace}/:path*` },
      { source: "/svc/ingestion/:path*", destination: `${ingestion}/:path*` },
      { source: "/svc/document/:path*", destination: `${document}/:path*` },
    ];
  },
};

const withBundleAnalyzer =
  process.env.ANALYZE === "true"
    ? require("@next/bundle-analyzer")({ enabled: true })
    : (config) => config;

export default withBundleAnalyzer(nextConfig);
