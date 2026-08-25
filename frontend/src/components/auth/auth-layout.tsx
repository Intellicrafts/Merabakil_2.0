"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Moon, Scale, Shield, Sparkles, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { initTheme, toggleTheme } from "@/lib/theme";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(initTheme());
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-[#0f172a] px-10 py-12 text-white lg:flex lg:w-[44%] lg:flex-col lg:justify-between">
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <Scale className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">AI Legal OS</span>
          </Link>
        </div>

        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium dark:bg-black/10">
            <Sparkles className="h-3.5 w-3.5" />
            Mera Vakil · India&apos;s AI Legal Counsel
          </div>
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
            Enterprise legal intelligence for citizens, advocates, and firms.
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-white/75 dark:text-slate-700">
            Grounded research, document intelligence, and conversational legal guidance —
            built for the Indian legal ecosystem.
          </p>
          <div className="flex items-center gap-2 text-xs text-white/60 dark:text-slate-600">
            <Shield className="h-3.5 w-3.5" />
            RBAC · Citations · Secure by design
          </div>
        </div>

        <p className="relative text-xs text-white/50 dark:text-slate-600">
          © MeraBakil · Informational only, not legal advice
        </p>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 flex-col">
        <div className="flex items-center justify-between px-6 py-4 lg:absolute lg:right-0 lg:top-0 lg:z-10 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 lg:hidden">
            <Scale className="h-5 w-5" />
            <span className="font-semibold">AI Legal OS</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto rounded-full"
            onClick={() => setDark(toggleTheme())}
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 pb-10 pt-2 lg:px-8">
          <div className="w-full max-w-md">
            <div className="mb-8 space-y-1 text-center lg:text-left">
              <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>

            <div className="rounded-2xl border border-black/[0.08] bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
              {children}
            </div>

            {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
