"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  CalendarCheck,
  CircleDollarSign,
  RefreshCcw,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getWalletBalance, listWalletTransactions, topUpWallet } from "@/lib/api";
import type { TransactionType, WalletTransaction } from "@/lib/types";

const QUICK_AMOUNTS = [100, 500, 1000, 2000];

function formatInr(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(num);
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

function TransactionRow({ tx }: { tx: WalletTransaction }) {
  const isDebit = DEBIT_TYPES.has(tx.transaction_type);
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/60 last:border-0">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          isDebit
            ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
            : "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400"
        }`}
      >
        <TxIcon type={tx.transaction_type} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-none">{TX_LABELS[tx.transaction_type]}</p>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{tx.description}</p>
      </div>
      <div className="text-right">
        <p
          className={`text-[13px] font-semibold ${
            isDebit ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
          }`}
        >
          {isDebit ? "−" : "+"}
          {formatInr(tx.amount)}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {formatRelativeTime(tx.created_at)}
        </p>
      </div>
      <div className="hidden sm:block">
        <Badge variant="outline" className="text-[11px]">
          {formatInr(tx.balance_after)}
        </Badge>
      </div>
    </div>
  );
}

function TopUpPanel({ onSuccess }: { onSuccess: () => void }) {
  const [amount, setAmount] = useState<number | "">(500);
  const [custom, setCustom] = useState(false);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (amt: number) => topUpWallet(amt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wallet-balance"] });
      qc.invalidateQueries({ queryKey: ["wallet-transactions"] });
      onSuccess();
    },
  });

  const handleTopUp = () => {
    if (!amount || amount <= 0) return;
    mutation.mutate(Number(amount));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {QUICK_AMOUNTS.map((amt) => (
          <button
            key={amt}
            type="button"
            onClick={() => {
              setAmount(amt);
              setCustom(false);
            }}
            className={`rounded-lg border px-2 py-2 text-[13px] font-medium transition-colors ${
              !custom && amount === amt
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-foreground hover:bg-muted"
            }`}
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
          onChange={(e) => {
            setCustom(e.target.checked);
            if (e.target.checked) setAmount("");
          }}
          className="h-3.5 w-3.5"
        />
        <label htmlFor="custom-amt" className="text-[13px] text-muted-foreground cursor-pointer">
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
        <p className="text-[12px] text-red-600 dark:text-red-400">
          Failed to add funds. Please try again.
        </p>
      )}

      <Button
        className="w-full"
        disabled={!amount || Number(amount) <= 0 || mutation.isPending}
        onClick={handleTopUp}
      >
        {mutation.isPending ? "Processing…" : `Add ${amount ? formatInr(amount) : "funds"}`}
      </Button>
    </div>
  );
}

export default function WalletPage() {
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [page, setPage] = useState(1);

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

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-5 pb-12 md:px-0 md:pt-2">
      {/* Balance card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardDescription className="text-[12px] font-medium uppercase tracking-wider">
                Wallet Balance
              </CardDescription>
              {walletLoading ? (
                <Skeleton className="mt-2 h-10 w-40" />
              ) : (
                <CardTitle className="mt-1 text-4xl font-bold tracking-tight">
                  {wallet ? formatInr(wallet.balance) : "₹0.00"}
                </CardTitle>
              )}
              <p className="mt-1 text-[12px] text-muted-foreground">
                {wallet?.currency ?? "INR"} · available balance
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-5">
          {!topUpOpen ? (
            <Button onClick={() => setTopUpOpen(true)} className="gap-2">
              <ArrowUpRight className="h-4 w-4" />
              Add Money
            </Button>
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
        </CardContent>
      </Card>

      {/* Usage info */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { icon: <Bot className="h-4 w-4" />, label: "AI query", price: "₹2" },
          { icon: <CalendarCheck className="h-4 w-4" />, label: "Booking fee", price: "Lawyer rate" },
          { icon: <TrendingUp className="h-4 w-4" />, label: "Earnings", price: "On complete" },
        ].map(({ icon, label, price }) => (
          <div
            key={label}
            className="rounded-lg border border-border/60 bg-muted/30 px-3 py-3"
          >
            <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-background text-muted-foreground">
              {icon}
            </div>
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-[13px] font-semibold">{price}</p>
          </div>
        ))}
      </div>

      {/* Transaction history */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[15px]">Transaction History</CardTitle>
            <div className="flex items-center gap-1">
              <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" />
              <span className="text-[12px] text-muted-foreground">credit</span>
              <span className="mx-1 text-muted-foreground/30">·</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-red-600" />
              <span className="text-[12px] text-muted-foreground">debit</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {txLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : !txList?.items.length ? (
            <div className="py-10 text-center">
              <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-[13px] text-muted-foreground">No transactions yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground/70">
                Your transactions will appear here once you top up or use a paid feature.
              </p>
            </div>
          ) : (
            <>
              {txList.items.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-[12px] text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
