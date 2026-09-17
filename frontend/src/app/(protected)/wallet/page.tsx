"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  CalendarCheck,
  CircleDollarSign,
  Plus,
  RefreshCcw,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsEvents, track } from "@/lib/analytics";
import { getStoredUser, getWalletBalance, listWalletTransactions } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import type { AuthUser } from "@/lib/types";
import type { TransactionType, WalletTransaction } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Formatting ──────────────────────────────────────────────────────────────

function formatAmount(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatCount(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
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

// ─── Transaction metadata ─────────────────────────────────────────────────────

const TX_LABEL_KEY: Record<TransactionType, string> = {
  TOP_UP: "wallet.txTopUp",
  CHATBOT_USAGE: "wallet.txAiQuery",
  APPOINTMENT_BOOKING: "wallet.txBooking",
  APPOINTMENT_REFUND: "wallet.txRefund",
  ADVOCATE_EARNING: "wallet.txEarning",
};

const DEBIT_TYPES = new Set<TransactionType>(["CHATBOT_USAGE", "APPOINTMENT_BOOKING"]);

const TX_ICON_BG: Record<TransactionType, string> = {
  TOP_UP: "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  CHATBOT_USAGE: "bg-violet-100/80 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400",
  APPOINTMENT_BOOKING: "bg-sky-100/80 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400",
  APPOINTMENT_REFUND: "bg-amber-100/80 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  ADVOCATE_EARNING: "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
};

function TxIcon({ type }: { type: TransactionType }) {
  const icons: Record<TransactionType, React.ReactNode> = {
    TOP_UP: <Wallet className="h-4 w-4" />,
    CHATBOT_USAGE: <Bot className="h-4 w-4" />,
    APPOINTMENT_BOOKING: <CalendarCheck className="h-4 w-4" />,
    APPOINTMENT_REFUND: <RefreshCcw className="h-4 w-4" />,
    ADVOCATE_EARNING: <TrendingUp className="h-4 w-4" />,
  };
  return <>{icons[type] ?? <CircleDollarSign className="h-4 w-4" />}</>;
}

// ─── Transaction row ──────────────────────────────────────────────────────────

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
          {formatAmount(tx.amount)}{" "}
          <span className="text-[11px] font-normal opacity-50">pts</span>
        </p>
        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground/60">
          {t("wallet.balAfter")} {formatAmount(tx.balance_after)}
        </p>
      </div>
      <p className="hidden w-16 text-right text-[11px] tabular-nums text-muted-foreground/50 sm:block">
        {formatRelativeTime(tx.created_at, t)}
      </p>
    </div>
  );
}

// ─── Date grouping ────────────────────────────────────────────────────────────

function groupByDate(items: WalletTransaction[]): [string, WalletTransaction[]][] {
  const groups = new Map<string, WalletTransaction[]>();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const tx of items) {
    const date = new Date(tx.created_at);
    let label: string;
    if (date.toDateString() === today.toDateString()) {
      label = "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      label = "Yesterday";
    } else {
      label = date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    }
    const group = groups.get(label) ?? [];
    group.push(tx);
    groups.set(label, group);
  }
  return [...groups.entries()];
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type TxFilter = "ALL" | "AI" | "BOOKINGS" | "CREDITS";

const AI_TYPES = new Set<TransactionType>(["CHATBOT_USAGE"]);
const BOOKING_TYPES = new Set<TransactionType>(["APPOINTMENT_BOOKING", "APPOINTMENT_REFUND"]);
const CREDIT_TYPES = new Set<TransactionType>(["TOP_UP", "ADVOCATE_EARNING"]);

function applyFilter(items: WalletTransaction[], filter: TxFilter): WalletTransaction[] {
  if (filter === "ALL") return items;
  const allowed = filter === "AI" ? AI_TYPES : filter === "BOOKINGS" ? BOOKING_TYPES : CREDIT_TYPES;
  return items.filter((tx) => allowed.has(tx.transaction_type));
}

const FILTER_TABS: { key: TxFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "AI", label: "AI Usage" },
  { key: "BOOKINGS", label: "Bookings" },
  { key: "CREDITS", label: "Credits" },
];

// ─── Pricing strip (inside the balance card) ──────────────────────────────────

interface PricingCol {
  label: string;
  value: string;
  sub: string;
}

const CITIZEN_PRICING: PricingCol[] = [
  { label: "AI query", value: "0.1 pts", sub: "per query" },
  { label: "1st booking", value: "Free", sub: "no charge" },
  { label: "Daily cap", value: "20", sub: "queries / day" },
];

const ADVOCATE_PRICING: PricingCol[] = [
  { label: "AI query", value: "0.1 pts", sub: "per query" },
  { label: "Booking fee", value: "Your rate", sub: "client-paid" },
  { label: "Earnings", value: "On complete", sub: "auto-credited" },
];

function PricingStrip({ isAdvocate }: { isAdvocate: boolean }) {
  const cols = isAdvocate ? ADVOCATE_PRICING : CITIZEN_PRICING;
  return (
    <div className="flex divide-x divide-white/[0.07]">
      {cols.map(({ label, value, sub }) => (
        <div key={label} className="flex-1 px-3 text-center first:pl-0 last:pr-0">
          <p className="text-[10px] text-slate-500">{label}</p>
          <p className="mt-0.5 text-[12.5px] font-semibold text-white/75">{value}</p>
          <p className="text-[10px] text-slate-600">{sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const AI_QUERY_COST_PTS = 0.1;

export default function WalletPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [txFilter, setTxFilter] = useState<TxFilter>("ALL");
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
  const approxQueries = balance > 0 ? Math.floor(balance / AI_QUERY_COST_PTS) : 0;

  const filteredGroups = useMemo(() => {
    const items = txList?.items ?? [];
    return groupByDate(applyFilter(items, txFilter));
  }, [txList?.items, txFilter]);

  const hasAnyTransactions = (txList?.items.length ?? 0) > 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-5 pb-12 md:px-0 md:pt-2">

      {/* Balance card — dark surface, pricing strip inside */}
      <div className="overflow-hidden rounded-[1.35rem] bg-slate-900 dark:bg-zinc-950">

        {/* Balance */}
        <div className="px-6 pb-4 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500">
                {t("wallet.walletBalance")}
              </p>
              {walletLoading ? (
                <Skeleton className="mt-3 h-11 w-36 bg-white/[0.08]" />
              ) : (
                <p className="mt-1.5 text-[3.25rem] font-bold leading-none tracking-tight text-white tabular-nums">
                  {formatAmount(balance)}
                </p>
              )}
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <p className="text-[12px] text-slate-500">MeraBakil Points</p>
                {!walletLoading && approxQueries > 0 && (
                  <>
                    <span className="text-slate-700">·</span>
                    <p className="text-[12px] text-slate-400">
                      ~{formatCount(approxQueries)} queries available
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
              <Wallet className="h-4.5 w-4.5 text-slate-500" />
            </div>
          </div>
        </div>

        {/* Pricing strip — what this balance buys */}
        <div className="border-t border-white/[0.06] px-6 py-4">
          <PricingStrip isAdvocate={isAdvocate} />
        </div>

        {/* Add Points footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-6 py-3.5">
          <p className="text-[11.5px] text-slate-600">
            {t("wallet.rechargeSoon")}
          </p>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-[11.5px] font-medium text-slate-500 opacity-60"
          >
            <Plus className="h-3 w-3" />
            Add Points
          </button>
        </div>
      </div>

      {/* Transaction history */}
      <div className="overflow-hidden rounded-[1.35rem] border border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-white/[0.04]">
        <div className="border-b border-black/[0.05] px-6 py-4 dark:border-white/[0.06]">
          <p className="text-[15px] font-semibold tracking-tight">{t("wallet.transactionHistory")}</p>

          {hasAnyTransactions && (
            <div className="mt-3 flex gap-1.5">
              {FILTER_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTxFilter(key)}
                  className={cn(
                    "rounded-lg px-3 py-1 text-[12px] font-medium transition-colors",
                    txFilter === key
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-black/[0.04] text-muted-foreground hover:bg-black/[0.07] dark:bg-white/[0.06] dark:hover:bg-white/[0.10]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 pb-4">
          {txLoading ? (
            <div className="space-y-4 py-4">
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
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/20" strokeWidth={1.5} />
              <p className="text-[13px] font-medium text-muted-foreground/70">
                {txFilter !== "ALL"
                  ? "No transactions in this category"
                  : t("wallet.noTransactionsYet")}
              </p>
              {txFilter === "ALL" && (
                <p className="text-[12px] text-muted-foreground/50">
                  {isAdvocate
                    ? t("wallet.noTransactionsAdvocate")
                    : t("wallet.noTransactionsCitizen")}
                </p>
              )}
            </div>
          ) : (
            <>
              {filteredGroups.map(([dateLabel, items]) => (
                <div key={dateLabel}>
                  <p className="pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/45">
                    {dateLabel}
                  </p>
                  {items.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </div>
              ))}

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-black/[0.05] pt-4 dark:border-white/[0.06]">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {t("wallet.previous")}
                  </Button>
                  <span className="text-[12px] text-muted-foreground">
                    {t("wallet.pageOf")
                      .replace("{{page}}", String(page))
                      .replace("{{total}}", String(totalPages))}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
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
