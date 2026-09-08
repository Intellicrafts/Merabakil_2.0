"use client";

import { useEffect } from "react";

import { useAuthGate } from "@/hooks/use-auth-gate";

export default function MeraVakilLayout({ children }: { children: React.ReactNode }) {
  const ready = useAuthGate();

  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.add("mera-vakil-locked");
    return () => {
      document.documentElement.classList.remove("mera-vakil-locked");
    };
  }, [ready]);

  if (!ready) return null;

  return <div className="mera-vakil-root no-scrollbar h-[100dvh] overflow-hidden">{children}</div>;
}
