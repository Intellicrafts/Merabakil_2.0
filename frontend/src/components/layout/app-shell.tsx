"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Moon, Scale, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { BackButton } from "@/components/layout/back-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clearSession, getStoredUser } from "@/lib/api";
import { initTheme, toggleTheme } from "@/lib/theme";
import type { AuthUser } from "@/lib/types";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Home",
  "/research": "Research Console",
  "/lawyer-marketplace": "Lawyer Marketplace",
  "/cases": "Case Management",
  "/documents": "Documents",
  "/courtroom": "AI Courtroom",
  "/admin/knowledge": "Knowledge Hub",
  "/admin/users": "User Management",
};

function resolvePageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/cases")) return "Case Management";
  if (pathname.startsWith("/documents")) return "Documents";
  if (pathname.startsWith("/courtroom")) return "AI Courtroom";
  if (pathname.startsWith("/admin/knowledge")) return "Knowledge Hub";
  if (pathname.startsWith("/admin/users")) return "User Management";
  return "Console";
}

function AppTopBar({
  user,
  dark,
  pageTitle,
  isHome,
  onToggleTheme,
  onGoHome,
  onSignOut,
}: {
  user: AuthUser | null;
  dark: boolean;
  pageTitle: string;
  isHome: boolean;
  onToggleTheme: () => void;
  onGoHome: () => void;
  onSignOut: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 px-5 md:h-16 md:px-8">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        {!isHome && <BackButton />}

        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/[0.08] bg-white/50 dark:border-white/[0.10] dark:bg-white/[0.06]">
            <Scale className="h-3.5 w-3.5 text-foreground/80" strokeWidth={1.75} />
          </div>
          <div className="hidden sm:block">
            <p className="text-[13px] font-semibold leading-none tracking-tight">AI Legal OS</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">India</p>
          </div>
        </Link>

        {!isHome && (
          <>
            <span className="hidden text-muted-foreground/40 md:inline" aria-hidden>
              /
            </span>
            <span className="hidden truncate text-[13px] font-medium text-muted-foreground md:inline">
              {pageTitle}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className="ml-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-black/[0.08] bg-white/50 text-[11px] font-semibold dark:border-white/[0.10] dark:bg-white/[0.06]">
              {user?.full_name?.charAt(0) ?? "?"}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-[13px] font-medium leading-none">{user?.full_name ?? "User"}</p>
              <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">
                {user?.roles?.[0]?.replace("_", " ") ?? "Member"}
              </p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {!isHome && (
              <>
                <DropdownMenuItem onClick={onGoHome}>Home</DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem destructive onClick={onSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [dark, setDark] = useState(false);

  const isHome = pathname === "/dashboard";
  const pageTitle = resolvePageTitle(pathname);

  useEffect(() => {
    setUser(getStoredUser());
    setDark(initTheme());
  }, []);

  function handleToggleTheme() {
    setDark(toggleTheme());
  }

  function handleSignOut() {
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="dashboard-root min-h-screen">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(100,116,139,0.07),transparent)] dark:bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(148,163,184,0.06),transparent)]" />
      </div>
      <div className="relative flex min-h-screen flex-col">
        <AppTopBar
          user={user}
          dark={dark}
          pageTitle={pageTitle}
          isHome={isHome}
          onToggleTheme={handleToggleTheme}
          onGoHome={() => router.push("/dashboard")}
          onSignOut={handleSignOut}
        />
        <main
          className={
            isHome
              ? "flex-1 px-0 pb-0 pt-0 md:px-8"
              : "flex-1 px-5 pb-10 pt-2 md:px-8"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
