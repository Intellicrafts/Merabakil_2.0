"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  CalendarCheck,
  CircleDollarSign,
  Clock,
  Gift,
  RefreshCcw,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsEvents, track } from "@/lib/analytics";
import { getStoredUser, getWalletBalance, listWalletTransactions } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import type { AuthUser } from "@/lib/types";
import type { TransactionType, WalletTransaction } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatPts(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)} pts`;
}

function formatRelativeTime(iso: string, t: (key: string) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t("wallet.justNow");
  if (mins < 60) return t("wallet.minutesAgo").replace("{{n}}", String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("wallet.hoursAgo").replace("{{n}}", String(hours));
  const days = Math.floor(hours / 24);
  if (days < 30) return t("wallet.daysAgo").replace("{{n}}", String(days));
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const TX_LABEL_KEY: Record<TransactionType, string> = {
  TOP_UP: "wallet.txTopUp",
  CHATBOT_USAGE: "wallet.txAiQuery",
  APPOINTMENT_BOOKING: "wallet.txBooking",
  APPOINTMENT_REFUND: "wallet.txRefund",
  ADVOCATE_EARNING: "wallet.txEarning",
};

const DEBIT_TYPES = new Set<TransactionType>(["CHATBOT_USAGE", "APPOINTMENT_BOOKING"]);

const TX_ICON_BG: Record<TransactionType, string> = {
  TOP_UP:               "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  CHATBOT_USAGE:        "bg-violet-100/80 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400",
  APPOINTMENT_BOOKING:  "bg-sky-100/80 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400",
  APPOINTMENT_REFUND:   "bg-amber-100/80 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  ADVOCATE_EARNING:     "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
};

function TxIcon({ type }: { type: TransactionType }) {
  const icons: Record<TransactionType, React.ReactNode> = {
    TOP_UP:              <Wallet className="h-4 w-4" />,
    CHATBOT_USAGE:       <Bot className="h-4 w-4" />,
    APPOINTMENT_BOOKING: <CalendarCheck className="h-4 w-4" />,
    APPOINTMENT_REFUND:  <RefreshCcw className="h-4 w-4" />,
    ADVOCATE_EARNING:    <TrendingUp className="h-4 w-4" />,
  };
  return <>{icons[type] ?? <CircleDollarSign className="h-4 w-4" />}</>;
}

function TransactionRow({ tx }: { tx: WalletTransaction }) {
  const { t } = useTranslation();
  const isDebit = DEBIT_TYPES.has(tx.transaction_type);
  return (
    <div className="flex items-center gap-3 border-b border-black/[0.05] py-3 last:border-0 dark:border-white/[0.06]">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", TX_ICON_BG[tx.transaction_type])}>
        <TxIcon type={tx.transaction_type} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-none">{t(TX_LABEL_KEY[tx.transaction_type])}</p>
        <p className="mt-1 truncate text-[11.5px] text-muted-foreground">{tx.description}</p>
      </div>
      <div className="text-right">
        <p className={cn("text-[13px] font-semibold tabular-nums", isDebit ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
          {isDebit ? "−" : "+"}
          {formatPts(tx.amount)}
        </p>
        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground/60">
          {t("wallet.balAfter")} {formatPts(tx.balance_after)}
        </p>
      </div>
      <p className="hidden w-16 text-right text-[11px] tabular-nums text-muted-foreground/50 sm:block">
        {formatRelativeTime(tx.created_at, t)}
      </p>
    </div>
  );
}


function InfoCards({ isAdvocate }: { isAdvocate: boolean }) {
  const { t } = useTranslation();

  const citizenCards = [
    {
      icon: <Bot className="h-4 w-4" />,
      bg: "bg-violet-100/70 dark:bg-violet-500/[0.15]",
      color: "text-violet-600 dark:text-violet-400",
      label: t("wallet.aiQuery"),
      value: t("wallet.aiQueryValue"),
      sub: t("wallet.aiQuerySub"),
    },
    {
      icon: <Gift className="h-4 w-4" />,
      bg: "bg-emerald-100/70 dark:bg-emerald-500/[0.15]",
      color: "text-emerald-600 dark:text-emerald-400",
      label: t("wallet.firstConsultation"),
      value: t("wallet.firstConsultationValue"),
      sub: t("wallet.firstConsultationSub"),
    },
    {
      icon: <Zap className="h-4 w-4" />,
      bg: "bg-sky-100/70 dark:bg-sky-500/[0.15]",
      color: "text-sky-600 dark:text-sky-400",
      label: t("wallet.dailyLimit"),
      value: t("wallet.dailyLimitValue"),
      sub: t("wallet.dailyLimitSub"),
    },
  ];

  const advocateCards = [
    {
      icon: <Bot className="h-4 w-4" />,
      bg: "bg-violet-100/70 dark:bg-violet-500/[0.15]",
      color: "text-violet-600 dark:text-violet-400",
      label: t("wallet.aiQuery"),
      value: t("wallet.aiQueryValue"),
      sub: t("wallet.aiQuerySub"),
    },
    {
      icon: <CalendarCheck className="h-4 w-4" />,
      bg: "bg-sky-100/70 dark:bg-sky-500/[0.15]",
      color: "text-sky-600 dark:text-sky-400",
      label: t("wallet.bookingReceived"),
      value: t("wallet.bookingReceivedValue"),
      sub: t("wallet.bookingReceivedSub"),
    },
    {
      icon: <TrendingUp className="h-4 w-4" />,
      bg: "bg-amber-100/70 dark:bg-amber-500/[0.12]",
      color: "text-amber-600 dark:text-amber-500",
      label: t("wallet.earnings"),
      value: t("wallet.earningsValue"),
      sub: t("wallet.earningsSub"),
    },
  ];

  const cards = isAdvocate ? advocateCards : citizenCards;

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map(({ icon, bg, color, label, value, sub }) => (
        <div
          key={label}
          className="rounded-[1.1rem] border border-black/[0.06] bg-white/70 px-3 py-4 text-center dark:border-white/[0.07] dark:bg-white/[0.04]"
        >
          <div className={cn("mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-xl", bg)}>
            <span className={color}>{icon}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-[13.5px] font-semibold tracking-tight">{value}</p>
          <p className="mt-0.5 text-[10.5px] text-muted-foreground/60">{sub}</p>
        </div>
      ))}
    </div>
  );
}

export default function WalletPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
    track(AnalyticsEvents.WALLET_BALANCE_VIEWED);
  }, []);

  const isAdvocate = user?.roles?.includes("advocate") ?? false;

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: getWalletBalance,
    staleTime: 30_000,
  });

  const { data: txList, isLoading: txLoading } = useQuery({
    queryKey: ["wallet-transactions", page],
    queryFn: () => listWalletTransactions(page),
    staleTime: 30_000,
  });

  const totalPages = txList ? Math.ceil(txList.total / txList.size) : 1;
  const balance = wallet ? parseFloat(wallet.balance) : 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-5 pb-12 md:px-0 md:pt-2">

      {/* Balance card */}
      <div className="overflow-hidden rounded-[1.35rem] border border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-white/[0.04]">
        <div className="flex items-start justify-between px-6 pb-2 pt-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              {t("wallet.walletBalance")}
            </p>
            {walletLoading ? (
              <Skeleton className="mt-3 h-10 w-40" />
            ) : (
              <p className="mt-1.5 text-[2.6rem] font-bold tracking-tight leading-none">
                {formatPts(balance)}
              </p>
            )}
            <p className="mt-2 text-[12px] text-muted-foreground/70">
              {t("wallet.availableBalance")}
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100/70 dark:bg-amber-500/[0.15]">
            <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        {/* Divider */}
        <div className="mx-6 my-4 h-px bg-black/[0.05] dark:bg-white/[0.06]" />

        <div className="px-6 pb-5">
          <div className="flex items-start gap-3 rounded-xl border border-dashed border-black/[0.10] bg-black/[0.02] px-4 py-3.5 dark:border-white/[0.10] dark:bg-white/[0.03]">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" />
            <div>
              <p className="text-[13px] font-medium text-foreground/80">{t("wallet.rechargeSoon")}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground/60">
                {t("wallet.rechargeDesc")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Role-aware info cards */}
      <InfoCards isAdvocate={isAdvocate} />

      {/* Transaction history */}
      <div className="overflow-hidden rounded-[1.35rem] border border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-white/[0.04]">
        <div className="flex items-center justify-between border-b border-black/[0.05] px-6 py-4 dark:border-white/[0.06]">
          <p className="text-[15px] font-semibold tracking-tight">{t("wallet.transactionHistory")}</p>
          <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground/70">
            <ArrowDownLeft className="h-3 w-3 text-emerald-600" />
            <span>{t("wallet.credit")}</span>
            <span className="mx-1 opacity-30">·</span>
            <ArrowUpRight className="h-3 w-3 text-red-500" />
            <span>{t("wallet.debit")}</span>
          </div>
        </div>

        <div className="px-6 pb-4 pt-1">
          {txLoading ? (
            <div className="space-y-4 py-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-2.5 w-44" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : !txList?.items.length ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/20" strokeWidth={1.5} />
              <p className="text-[13px] font-medium text-muted-foreground/70">{t("wallet.noTransactionsYet")}</p>
              <p className="text-[12px] text-muted-foreground/50">
                {isAdvocate
                  ? t("wallet.noTransactionsAdvocate")
                  : t("wallet.noTransactionsCitizen")}
              </p>
            </div>
          ) : (
            <>
              {txList.items.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-black/[0.05] pt-4 dark:border-white/[0.06]">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    {t("wallet.previous")}
                  </Button>
                  <span className="text-[12px] text-muted-foreground">
                    {t("wallet.pageOf").replace("{{page}}", String(page)).replace("{{total}}", String(totalPages))}
                  </span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    {t("common.next")}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
