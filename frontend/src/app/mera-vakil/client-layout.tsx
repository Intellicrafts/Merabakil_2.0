"use client";

import { useEffect, useState } from "react";

import { SaarthiLanding } from "@/components/mera-vakil/saarthi-landing";
import { AUTH_CHANGED_EVENT, getStoredUser, getToken } from "@/lib/api";

type AuthState = "pending" | "in" | "out";

/**
 * Saarthi is dual-mode: logged-out visitors get the question-first landing
 * (ad entry point), logged-in users get the full chat (`children`). We resolve
 * auth on the client only (avoids an SSR/hydration flash) and react to sign-in
 * so the landing flips to chat without a reload.
 */
export function MeraVakilClientLayout({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>("pending");

  useEffect(() => {
    const resolve = () => setAuth(getToken() && getStoredUser() ? "in" : "out");
    resolve();
    window.addEventListener(AUTH_CHANGED_EVENT, resolve);
    window.addEventListener("storage", resolve);
    window.addEventListener("focus", resolve);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, resolve);
      window.removeEventListener("storage", resolve);
      window.removeEventListener("focus", resolve);
    };
  }, []);

  // Lock global scroll only in the full-screen chat mode; the landing scrolls.
  useEffect(() => {
    if (auth !== "in") return;
    document.documentElement.classList.add("mera-vakil-locked");
    return () => document.documentElement.classList.remove("mera-vakil-locked");
  }, [auth]);

  if (auth === "pending") return null;
  if (auth === "out") return <SaarthiLanding />;

  return <div className="mera-vakil-root no-scrollbar h-[100dvh] overflow-hidden">{children}</div>;
}
