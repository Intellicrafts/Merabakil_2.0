import type { Metadata } from "next";

import { RouteGuard } from "@/components/auth/route-guard";
import { NOINDEX } from "@/lib/site-metadata";

export const metadata: Metadata = {
  robots: NOINDEX,
};

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <RouteGuard>{children}</RouteGuard>;
}
