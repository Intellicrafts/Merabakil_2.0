"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Moon, Search, Sun, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { ProfileAvatar } from "@/components/auth/profile-avatar";
import {
  AccountMenuItem,
  CircleUserRound,
  Home,
} from "@/components/layout/account-menu-item";
import { DashboardCommandPalette } from "@/components/dashboard/dashboard-command-palette";
import { BrandLockup } from "@/components/layout/brand-lockup";
import { NotificationBell } from "@/components/layout/notification-bell";
import { NotificationProvider } from "@/components/layout/notification-provider";
import { SummonAlertHost } from "@/components/layout/summon-alert-host";
import { IncomingCallHost } from "@/components/layout/incoming-call-host";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { getStoredUser, getWalletBalance, signOut, syncStoredUser } from "@/lib/api";
import { clearConsent } from "@/lib/consent";
import { pickAvatarCandidate, readAvatarUrl } from "@/lib/avatar";
import { useResolvedAvatarSrc } from "@/hooks/use-resolved-avatar-src";
import { useTranslation } from "@/lib/i18n";
import { markNavigationStart } from "@/lib/navigation-feedback";
import { FEATURES } from "@/lib/features";
import { initTheme, toggleTheme } from "@/lib/theme";
import type { AuthUser } from "@/lib/types";

function resolvePageTitle(pathname: string, t: (key: string) => string): string {
  const exact: Record<string, string> = {
    "/dashboard": t("pages.home"),
    "/research": t("pages.research"),
    "/lawyer-marketplace": t("pages.lawyerMarketplace"),
    "/appointments": t("pages.appointments"),
    "/cases": t("pages.cases"),
    "/documents": t("pages.documents"),
    "/admin/knowledge": t("pages.knowledgeHub"),
    "/admin/users": t("pages.userManagement"),
    "/admin/appointments": t("pages.appointmentOps"),
    "/profile": t("pages.profile"),
    "/wallet": t("pages.wallet"),
  };
  if (exact[pathname]) return exact[pathname];
  if (pathname.startsWith("/appointments") && pathname.endsWith("/room")) return t("pages.appointmentRoom");
  if (pathname.startsWith("/appointments")) return t("pages.appointmentDetails");
  if (pathname.startsWith("/cases")) return t("pages.cases");
  if (pathname.startsWith("/documents")) return t("pages.documents");
  if (pathname.startsWith("/admin/knowledge")) return t("pages.knowledgeHub");
  if (pathname.startsWith("/admin/users")) return t("pages.userManagement");
  if (pathname.startsWith("/admin/appointments")) return t("pages.appointmentOps");
  return t("pages.console");
}

function AppTopBar({
  user,
  dark,
  pageTitle,
  isHome,
  walletBalance,
  avatarSrc,
  onToggleTheme,
  onGoHome,
  onGoToProfile,
  onGoToWallet,
  onSignOut,
  onOpenPalette,
}: {
  user: AuthUser | null;
  dark: boolean;
  pageTitle: string;
  isHome: boolean;
  walletBalance: string | null;
  avatarSrc: string | null;
  onToggleTheme: () => void;
  onGoHome: () => void;
  onGoToProfile: () => void;
  onGoToWallet: () => void;
  onSignOut: () => void;
  onOpenPalette: () => void;
}) {
  const [modKey, setModKey] = useState("Ctrl");
  const { t } = useTranslation();

  useEffect(() => {
    setModKey(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl");
  }, []);

  return (
    <header className="app-topbar sticky top-0 z-40 flex h-14 items-center justify-between gap-3 px-5 md:h-16 md:px-8">
      <div className="flex min-w-0 items-center">
        <BrandLockup isHome={isHome} pageTitle={pageTitle} />
      </div>

      <div className="flex items-center gap-1">
        {/* Desktop search bar */}
        <button
          type="button"
          onClick={onOpenPalette}
          className="mr-1 hidden items-center gap-2 rounded-xl border border-black/[0.07] bg-white/60 px-3 py-1.5 text-muted-foreground/65 transition-all hover:bg-white hover:text-muted-foreground hover:shadow-[0_2px_8px_rgba(42,28,12,0.08)] dark:border-white/[0.09] dark:bg-white/[0.05] dark:hover:bg-white/[0.09] sm:inline-flex"
          aria-label={t("nav.openSearch")}
          aria-keyshortcuts="Meta+K Control+K"
        >
          <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
          <span className="text-[12.5px]">{t("nav.search")}</span>
          <kbd className="dash-kbd ml-0.5">{modKey}K</kbd>
        </button>
        {/* Mobile search icon */}
        <button
          type="button"
          onClick={onOpenPalette}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/[0.08] bg-white/60 text-foreground backdrop-blur-sm transition hover:bg-white dark:border-white/10 dark:bg-white/[0.06] sm:hidden"
          aria-label={t("nav.openSearch")}
        >
          <Search className="h-4 w-4" />
        </button>
        <NotificationBell />
        {FEATURES.WALLET && (
          <Link
            href="/wallet"
            className="hidden items-center gap-1.5 rounded-lg border border-black/[0.06] bg-white/50 px-2.5 py-1 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground dark:border-white/[0.10] dark:bg-white/[0.05] dark:hover:bg-white/[0.08] sm:flex"
            aria-label={t("nav.myWallet")}
          >
            <Wallet className="h-3.5 w-3.5" />
            {walletBalance ?? "— pts"}
          </Link>
        )}
        <LanguageSwitcher />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]"
          onClick={onToggleTheme}
          aria-label={t("nav.toggleTheme")}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className="ml-1 flex items-center gap-2 rounded-xl border border-transparent px-1.5 py-1 text-sm transition-colors hover:border-black/[0.06] hover:bg-white/80 dark:hover:border-white/10 dark:hover:bg-white/[0.07]" aria-label={t("nav.accountMenu")}>
            <ProfileAvatar
              src={avatarSrc}
              name={user?.full_name ?? "User"}
              className="h-7 w-7"
            />
            <div className="hidden text-left md:block">
              <p className="text-[13px] font-medium leading-none">{user?.full_name ?? "User"}</p>
              <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">
                {user?.roles?.[0]?.replace("_", " ") ?? "Member"}
              </p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[15rem]">
            <AccountMenuItem
              icon={Home}
              label={t("nav.home")}
              accent="home"
              onClick={onGoHome}
            />
            <AccountMenuItem
              icon={CircleUserRound}
              label={t("nav.myProfile")}
              accent="profile"
              onClick={onGoToProfile}
            />
            {FEATURES.WALLET && (
              <AccountMenuItem
                icon={Wallet}
                label={t("nav.wallet")}
                accent="wallet"
                onClick={onGoToWallet}
                trailing={
                  walletBalance ? (
                    <span className="ml-auto text-[11px] font-medium text-muted-foreground">
                      {walletBalance}
                    </span>
                  ) : null
                }
              />
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => clearConsent()} className="min-h-11">
              {t("nav.cookieSettings")}
            </DropdownMenuItem>
            <DropdownMenuItem destructive onClick={onSignOut} className="min-h-11">
              <LogOut className="mr-2 h-4 w-4" />
              {t("nav.signOut")}
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
  const { t } = useTranslation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [dark, setDark] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const { data: walletData } = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: getWalletBalance,
    staleTime: 60_000,
    retry: false,
    enabled: FEATURES.WALLET,
  });

  const walletBalance = walletData
    ? `${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(parseFloat(walletData.balance))} pts`
    : null;

  const isHome = pathname === "/dashboard";
  const isRoom = pathname.startsWith("/appointments") && pathname.endsWith("/room");
  const pageTitle = resolvePageTitle(pathname, t);

  useEffect(() => {
    setUser(getStoredUser());
    setDark(initTheme());
    void syncStoredUser().then((fresh) => {
      if (fresh) setUser(fresh);
    });
  }, []);

  const avatarCandidate = pickAvatarCandidate(user?.avatar_url, readAvatarUrl());
  const avatarSrc = useResolvedAvatarSrc(avatarCandidate);

  useEffect(() => {
    if (!isRoom) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [isRoom]);

  useEffect(() => {
    if (isRoom) setPaletteOpen(false);
  }, [isRoom]);

  useEffect(() => {
    if (isRoom) return;

    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setPaletteOpen((open) => !open);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isRoom]);

  function handleToggleTheme() {
    setDark(toggleTheme());
  }

  function handleSignOut() {
    signOut();
    router.replace("/login");
  }

  return (
    <NotificationProvider>
      <div className={isRoom ? "dashboard-root h-dvh overflow-hidden" : "dashboard-root min-h-screen"}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(100,116,139,0.07),transparent)] dark:bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(148,163,184,0.06),transparent)]" />
      </div>
      <div className={isRoom ? "relative flex h-full flex-col overflow-hidden" : "relative flex min-h-screen flex-col"}>
        <div className={isRoom ? "hidden md:block" : undefined}>
          <AppTopBar
            user={user}
            dark={dark}
            pageTitle={pageTitle}
            isHome={isHome}
            walletBalance={walletBalance}
            avatarSrc={avatarSrc}
            onToggleTheme={handleToggleTheme}
            onGoHome={() => {
              markNavigationStart();
              router.push("/dashboard");
            }}
            onGoToProfile={() => {
              markNavigationStart();
              router.push("/profile");
            }}
            onGoToWallet={() => {
              markNavigationStart();
              router.push("/wallet");
            }}
            onSignOut={handleSignOut}
            onOpenPalette={() => setPaletteOpen(true)}
          />
        </div>
        <SummonAlertHost />
        <IncomingCallHost />
        {!isRoom && (
          <DashboardCommandPalette
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            user={user}
          />
        )}
        <main
          className={
            isHome
              ? "flex-1 px-0 pb-0 pt-0 md:px-8"
              : isRoom
                ? "flex min-h-0 flex-1 flex-col overflow-hidden px-0 pt-[env(safe-area-inset-top,0px)] md:pt-0"
                : "flex-1 px-5 pb-10 pt-2 md:px-8"
          }
        >
          <div className={isRoom ? "flex min-h-0 flex-1 flex-col" : "page-enter"}>
            {children}
          </div>
        </main>
      </div>
    </div>
    </NotificationProvider>
  );
}
