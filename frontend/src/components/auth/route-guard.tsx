"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useAuthGate } from "@/hooks/use-auth-gate";

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const ready = useAuthGate();
  if (!ready) return null;
  return <AppShell>{children}</AppShell>;
}
