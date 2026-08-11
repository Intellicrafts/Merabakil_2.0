"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, Moon, Scale, Sun, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getToken } from "@/lib/api";
import { initTheme, toggleTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#mera-vakil", label: "Mera Vakil" },
  { href: "#roles", label: "For You" },
  { href: "#features", label: "Platform" },
  { href: "#trust", label: "Trust" },
];

interface MarketingShellProps {
  children: React.ReactNode;
}

export function MarketingShell({ children }: MarketingShellProps) {
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setDark(initTheme());
    setLoggedIn(Boolean(getToken()));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-sm dark:from-slate-200 dark:to-slate-400 dark:text-slate-900">
              <Scale className="h-4 w-4" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold tracking-tight">AI Legal OS</p>
              <p className="text-[10px] text-muted-foreground">for India</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() => setDark(toggleTheme())}
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {loggedIn ? (
              <Button asChild size="sm" className="rounded-full">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden rounded-full sm:inline-flex">
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="rounded-full bg-gradient-to-r from-slate-800 to-slate-900 text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900"
                >
                  <Link href="/register">Get Started</Link>
                </Button>
              </>
            )}

            <button
              type="button"
              className="rounded-lg p-2 md:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div
          className={cn(
            "border-t border-black/[0.06] bg-white/95 px-4 py-4 dark:border-white/10 dark:bg-zinc-950/95 md:hidden",
            mobileOpen ? "block" : "hidden",
          )}
        >
          <nav className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            {!loggedIn && (
              <div className="flex gap-2 pt-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button asChild size="sm" className="flex-1">
                  <Link href="/register">Get Started</Link>
                </Button>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
