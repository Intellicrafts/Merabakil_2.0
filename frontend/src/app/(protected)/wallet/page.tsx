"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  CalendarCheck,
  CircleDollarSign,
  Gift,
  RefreshCcw,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsEvents, bucketAmount, track } from "@/lib/analytics";
import { getStoredUser, getWalletBalance, listWalletTransactions, topUpWallet } from "@/lib/api";
import type { AuthUser } from "@/lib/types";
import type { TransactionType, WalletTransaction } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUICK_AMOUNTS = [100, 500, 1000, 2000];

function formatPts(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return `${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)} pts`;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const TX_LABELS: Record<TransactionType, string> = {
  TOP_UP: "Top-up",
  CHATBOT_USAGE: "AI Query",
  APPOINTMENT_BOOKING: "Booking",
  APPOINTMENT_REFUND: "Refund",
  ADVOCATE_EARNING: "Earning",
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
  const isDebit = DEBIT_TYPES.has(tx.transaction_type);
  return (
    <div className="flex items-center gap-3 border-b border-black/[0.05] py-3 last:border-0 dark:border-white/[0.06]">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", TX_ICON_BG[tx.transaction_type])}>
        <TxIcon type={tx.transaction_type} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-none">{TX_LABELS[tx.transaction_type]}</p>
        <p className="mt-1 truncate text-[11.5px] text-muted-foreground">{tx.description}</p>
      </div>
      <div className="text-right">
        <p className={cn("text-[13px] font-semibold tabular-nums", isDebit ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
          {isDebit ? "−" : "+"}
          {formatPts(tx.amount)}
        </p>
        <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground/60">
          Bal {formatPts(tx.balance_after)}
        </p>
      </div>
      <p className="hidden w-16 text-right text-[11px] tabular-nums text-muted-foreground/50 sm:block">
        {formatRelativeTime(tx.created_at)}
      </p>
    </div>
  );
}

function TopUpPanel({ onSuccess }: { onSuccess: () => void }) {
  const [amount, setAmount] = useState<number | "">(500);
  const [custom, setCustom] = useState(false);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (amt: number) => {
      track(AnalyticsEvents.PAYMENT_STARTED, {
        payment_type: "wallet_top_up",
        amount_bucket: bucketAmount(amt),
      });
      return topUpWallet(amt);
    },
    onSuccess: (_data, amt) => {
      track(AnalyticsEvents.PAYMENT_COMPLETED, {
        payment_type: "wallet_top_up",
        amount_bucket: bucketAmount(amt),
      });
      qc.invalidateQueries({ queryKey: ["wallet-balance"] });
      qc.invalidateQueries({ queryKey: ["wallet-transactions"] });
      onSuccess();
    },
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {QUICK_AMOUNTS.map((amt) => (
          <button
            key={amt}
            type="button"
            onClick={() => { setAmount(amt); setCustom(false); }}
            className={cn(
              "rounded-xl border py-2.5 text-[13px] font-medium transition-colors",
              !custom && amount === amt
                ? "border-primary bg-primary/10 text-primary"
                : "border-black/[0.08] bg-white/60 text-foreground hover:bg-white dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.09]",
            )}
          >
            ₹{amt.toLocaleString("en-IN")}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="custom-amt"
          checked={custom}
          onChange={(e) => { setCustom(e.target.checked); if (e.target.checked) setAmount(""); }}
          className="h-3.5 w-3.5 cursor-pointer"
        />
        <label htmlFor="custom-amt" className="cursor-pointer text-[13px] text-muted-foreground">
          Enter custom amount
        </label>
      </div>

      {custom && (
        <Input
          type="number"
          min={1}
          max={100000}
          placeholder="Amount in ₹"
          value={amount}
          onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
          className="text-[14px]"
        />
      )}

      {mutation.isError && (
        <p className="text-[12px] text-red-600 dark:text-red-400">Failed to add funds. Please try again.</p>
      )}

      <Button
        className="w-full"
        disabled={!amount || Number(amount) <= 0 || mutation.isPending}
        onClick={() => { if (amount) mutation.mutate(Number(amount)); }}
      >
        {mutation.isPending ? "Processing…" : `Add ${amount ? formatPts(amount) : "funds"}`}
      </Button>
    </div>
  );
}

function InfoCards({ isAdvocate }: { isAdvocate: boolean }) {
  const citizenCards = [
    {
      icon: <Bot className="h-4 w-4" />,
      bg: "bg-violet-100/70 dark:bg-violet-500/[0.15]",
      color: "text-violet-600 dark:text-violet-400",
      label: "AI query",
      value: "0.1 pts / query",
      sub: "20 queries/day",
    },
    {
      icon: <Gift className="h-4 w-4" />,
      bg: "bg-emerald-100/70 dark:bg-emerald-500/[0.15]",
      color: "text-emerald-600 dark:text-emerald-400",
      label: "First consultation",
      value: "Free",
      sub: "No charge on 1st booking",
    },
    {
      icon: <Zap className="h-4 w-4" />,
      bg: "bg-sky-100/70 dark:bg-sky-500/[0.15]",
      color: "text-sky-600 dark:text-sky-400",
      label: "Daily limit",
      value: "20 queries",
      sub: "Resets every 24 hours",
    },
  ];

  const advocateCards = [
    {
      icon: <Bot className="h-4 w-4" />,
      bg: "bg-violet-100/70 dark:bg-violet-500/[0.15]",
      color: "text-violet-600 dark:text-violet-400",
      label: "AI query",
      value: "0.1 pts / query",
      sub: "20 queries/day",
    },
    {
      icon: <CalendarCheck className="h-4 w-4" />,
      bg: "bg-sky-100/70 dark:bg-sky-500/[0.15]",
      color: "text-sky-600 dark:text-sky-400",
      label: "Booking received",
      value: "At your rate",
      sub: "Charged to client",
    },
    {
      icon: <TrendingUp className="h-4 w-4" />,
      bg: "bg-amber-100/70 dark:bg-amber-500/[0.12]",
      color: "text-amber-600 dark:text-amber-500",
      label: "Earnings",
      value: "On complete",
      sub: "Credited after session",
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
  const [topUpOpen, setTopUpOpen] = useState(false);
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
              Wallet Balance
            </p>
            {walletLoading ? (
              <Skeleton className="mt-3 h-10 w-40" />
            ) : (
              <p className="mt-1.5 text-[2.6rem] font-bold tracking-tight leading-none">
                {formatPts(balance)}
              </p>
            )}
            <p className="mt-2 text-[12px] text-muted-foreground/70">
              MeraBakil Points · available balance
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100/70 dark:bg-amber-500/[0.15]">
            <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        {/* Divider */}
        <div className="mx-6 my-4 h-px bg-black/[0.05] dark:bg-white/[0.06]" />

        <div className="px-6 pb-6">
          {!topUpOpen ? (
            <div className="flex items-center gap-3">
              <Button onClick={() => setTopUpOpen(true)} className="gap-2">
                <ArrowUpRight className="h-4 w-4" />
                Add Points
              </Button>
              {!walletLoading && balance === 0 && (
                <p className="text-[12px] text-muted-foreground/60">
                  Top up to start using paid features
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium">Add funds</p>
                <button
                  type="button"
                  onClick={() => setTopUpOpen(false)}
                  className="text-[12px] text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
              <TopUpPanel onSuccess={() => setTopUpOpen(false)} />
            </div>
          )}
        </div>
      </div>

      {/* Role-aware info cards */}
      <InfoCards isAdvocate={isAdvocate} />

      {/* Transaction history */}
      <div className="overflow-hidden rounded-[1.35rem] border border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-white/[0.04]">
        <div className="flex items-center justify-between border-b border-black/[0.05] px-6 py-4 dark:border-white/[0.06]">
          <p className="text-[15px] font-semibold tracking-tight">Transaction History</p>
          <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground/70">
            <ArrowDownLeft className="h-3 w-3 text-emerald-600" />
            <span>credit</span>
            <span className="mx-1 opacity-30">·</span>
            <ArrowUpRight className="h-3 w-3 text-red-500" />
            <span>debit</span>
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
              <p className="text-[13px] font-medium text-muted-foreground/70">No transactions yet</p>
              <p className="text-[12px] text-muted-foreground/50">
                {isAdvocate
                  ? "Earnings from completed consultations will appear here."
                  : "Use Saarthi AI or book a consultation to see activity."}
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
                    Previous
                  </Button>
                  <span className="text-[12px] text-muted-foreground">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
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
