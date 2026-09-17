"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Search,
  Wallet,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  adminAdjustWallet,
  adminGetUserTransactions,
  adminListWallets,
  listUsers,
} from "@/lib/api";
import type { AuthUser, WalletTransactionList } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatBalance(val: string | number): string {
  return Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}

const TX_TYPE_META: Record<string, { label: string; color: string; sign: "+" | "−" }> = {
  TOP_UP:               { label: "Top-up",       color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400", sign: "+" },
  ADMIN_CREDIT:         { label: "Admin credit", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400", sign: "+" },
  APPOINTMENT_REFUND:   { label: "Refund",        color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400", sign: "+" },
  ADVOCATE_EARNING:     { label: "Earning",       color: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400", sign: "+" },
  CHATBOT_USAGE:        { label: "Chatbot",       color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400", sign: "−" },
  APPOINTMENT_BOOKING:  { label: "Booking",       color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400", sign: "−" },
  ADMIN_DEBIT:          { label: "Admin debit",   color: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400", sign: "−" },
};

function TxTypeBadge({ type }: { type: string }) {
  const meta = TX_TYPE_META[type] ?? { label: type, color: "bg-zinc-100 text-zinc-600", sign: "+" as const };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold", meta.color)}>
      {meta.label}
    </span>
  );
}

// ── Adjust Wallet Dialog ─────────────────────────────────────────────────────

interface AdjustDialogProps {
  open: boolean;
  userId: string;
  userName: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AdjustDialog({ open, userId, userName, onClose, onSuccess }: AdjustDialogProps) {
  const [type, setType] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => adminAdjustWallet(userId, { amount: Number(amount), type, reason }),
    onSuccess: () => {
      toast({ title: `Wallet ${type === "credit" ? "credited" : "debited"} successfully` });
      setAmount(""); setReason(""); setType("credit");
      onSuccess();
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: "Adjustment failed", description: e.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Adjust wallet</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{userName}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Type</p>
            <div className="grid grid-cols-2 gap-2">
              {(["credit", "debit"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                    type === t
                      ? t === "credit"
                        ? "border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950 dark:text-emerald-400"
                        : "border-rose-500/40 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-950 dark:text-rose-400"
                      : "border-black/[0.08] bg-black/[0.02] text-muted-foreground hover:bg-black/[0.05] dark:border-white/10 dark:bg-white/[0.03]",
                  )}
                >
                  {t === "credit" ? "+ Credit" : "− Debit"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="w-adj-amount">Amount (₹)</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <Input id="w-adj-amount" type="number" min={1} placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-7" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="w-adj-reason">Reason</label>
            <textarea
              id="w-adj-reason"
              rows={3}
              placeholder="Reason for this adjustment…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="flex gap-2 border-t border-black/[0.06] bg-black/[0.02] px-5 py-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
          <Button variant="ghost" className="flex-1 rounded-xl" onClick={onClose}>Cancel</Button>
          <Button
            className={cn("flex-1 rounded-xl", type === "credit" ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-rose-600 text-white hover:bg-rose-700")}
            disabled={!amount || !reason || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Processing…" : type === "credit" ? "Credit" : "Debit"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Wallet Detail Sheet ──────────────────────────────────────────────────────

interface WalletDetailSheetProps {
  open: boolean;
  userId: string;
  userName: string;
  balance: string;
  onClose: () => void;
  onAdjusted: () => void;
}

function WalletDetailSheet({ open, userId, userName, balance, onClose, onAdjusted }: WalletDetailSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [txPage, setTxPage] = useState(1);
  const queryClient = useQueryClient();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) { setTxPage(1); return; }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const { data: txData, isLoading: txLoading } = useQuery<WalletTransactionList>({
    queryKey: ["admin-wallet-txns", userId, txPage],
    queryFn: () => adminGetUserTransactions(userId, txPage, 15),
    enabled: open && !!userId,
  });

  if (!mounted || !open) return null;

  const totalTxPages = txData ? Math.ceil(txData.total / 15) : 1;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-stretch sm:justify-end">
        <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="wallet-detail-title"
          className={cn(
            "relative z-[81] flex w-full flex-col bg-white",
            "max-h-[92vh] rounded-t-[1.6rem] border border-black/[0.08] shadow-[0_-12px_60px_rgba(15,23,42,0.18)]",
            "dark:border-white/10 dark:bg-[hsl(220_14%_9%)]",
            "sm:h-full sm:max-h-none sm:max-w-[520px] sm:rounded-none sm:border-l sm:shadow-[0_0_80px_rgba(15,23,42,0.18)]",
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-black/15 sm:hidden dark:bg-white/20" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Wallet details</p>
              <h2 id="wallet-detail-title" className="mt-0.5 text-sm font-semibold">{userName}</h2>
            </div>
            <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08]">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Balance card */}
          <div className="border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Current balance</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">₹{formatBalance(balance)}</p>
              </div>
              <Button
                size="sm"
                className="rounded-xl"
                onClick={() => setAdjustOpen(true)}
              >
                Adjust balance
              </Button>
            </div>
          </div>

          {/* Transactions */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-3">
              <p className="text-xs font-medium text-muted-foreground">
                Transaction history {txData ? `(${txData.total})` : ""}
              </p>
            </div>

            {txLoading && (
              <div className="space-y-0 divide-y divide-black/[0.04] dark:divide-white/[0.05]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-2.5 w-36" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            )}

            {txData && txData.items.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Wallet className="h-7 w-7 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No transactions yet</p>
              </div>
            )}

            {txData && txData.items.map((tx) => {
              const meta = TX_TYPE_META[tx.transaction_type] ?? { label: tx.transaction_type, color: "", sign: "+" as const };
              const isCredit = meta.sign === "+";
              return (
                <div
                  key={tx.id}
                  className="flex items-start gap-3 border-b border-black/[0.04] px-5 py-3 last:border-0 dark:border-white/[0.05]"
                >
                  <div className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    isCredit ? "bg-emerald-100 dark:bg-emerald-950" : "bg-rose-100 dark:bg-rose-950",
                  )}>
                    {isCredit
                      ? <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      : <ArrowUpRight className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <TxTypeBadge type={tx.transaction_type} />
                        <p className="mt-1 truncate text-[12px] text-muted-foreground">{tx.description}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground/60">{formatDate(tx.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-sm font-semibold tabular-nums", isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                          {meta.sign}₹{formatBalance(tx.amount)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">→ ₹{formatBalance(tx.balance_after)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Tx Pagination */}
            {txData && totalTxPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3">
                <p className="text-xs text-muted-foreground">Page {txPage} of {totalTxPages}</p>
                <div className="flex gap-1">
                  <button type="button" disabled={txPage <= 1} onClick={() => setTxPage((p) => p - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/[0.08] text-muted-foreground disabled:opacity-40 hover:bg-black/[0.05] dark:border-white/[0.08]">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" disabled={txPage >= totalTxPages} onClick={() => setTxPage((p) => p + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/[0.08] text-muted-foreground disabled:opacity-40 hover:bg-black/[0.05] dark:border-white/[0.08]">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <AdjustDialog
        open={adjustOpen}
        userId={userId}
        userName={userName}
        onClose={() => setAdjustOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-wallet-txns", userId] });
          queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
          onAdjusted();
        }}
      />
    </>,
    document.body,
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

interface WalletEntry {
  user_id: string;
  full_name: string;
  email: string;
  roles: string[];
  balance: string;
  currency: string;
}

export default function AdminWalletPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sheetUser, setSheetUser] = useState<WalletEntry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [adjustUser, setAdjustUser] = useState<WalletEntry | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const { data: walletData, isLoading: walletsLoading } = useQuery({
    queryKey: ["admin-wallets", page],
    queryFn: () => adminListWallets(page, 20),
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users-all"],
    queryFn: () => listUsers(1, 200),
  });

  const isLoading = walletsLoading || usersLoading;

  const userMap = new Map<string, AuthUser>(
    (usersData?.items ?? []).map((u) => [u.user_id, u]),
  );

  const entries: WalletEntry[] = (walletData?.items ?? [])
    .map((w) => {
      const u = userMap.get(w.user_id);
      return {
        user_id: w.user_id,
        full_name: u?.full_name ?? w.user_id,
        email: u?.email ?? "—",
        roles: u?.roles ?? [],
        balance: w.balance,
        currency: w.currency,
      };
    })
    .filter((e) => {
      if (!debouncedSearch) return true;
      const q = debouncedSearch.toLowerCase();
      return e.full_name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
    });

  const totalPages = walletData ? Math.ceil(walletData.total / 20) : 1;

  const totalBalance = entries.reduce((sum, e) => sum + Number(e.balance), 0);
  const maxBalance = entries.reduce((max, e) => Math.max(max, Number(e.balance)), 0);

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-5 pb-10">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Wallet className="h-5 w-5 text-primary" />
              Wallet ops
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              View and manage wallet balances across the platform
            </p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56 rounded-xl pl-8 text-sm sm:w-64"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Total wallets", value: walletData ? String(walletData.total) : "—" },
            { label: "Page balance", value: walletData ? `₹${formatBalance(totalBalance)}` : "—" },
            { label: "Highest balance", value: walletData ? `₹${formatBalance(maxBalance)}` : "—" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04]"
            >
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white dark:border-white/10 dark:bg-white/[0.03]">
          {isLoading && (
            <div className="space-y-0 divide-y divide-black/[0.04] dark:divide-white/[0.06]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && entries.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Wallet className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">No wallets found</p>
              {debouncedSearch && (
                <p className="text-xs text-muted-foreground">Try a different search term</p>
              )}
            </div>
          )}

          {!isLoading && entries.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow className="border-black/[0.06] dark:border-white/[0.06]">
                  <TableHead className="pl-4">User</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden sm:table-cell">Role</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead className="pr-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow
                    key={entry.user_id}
                    className="border-black/[0.04] dark:border-white/[0.05]"
                  >
                    <TableCell className="pl-4 font-medium">{entry.full_name}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {entry.email}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {entry.roles.slice(0, 1).map((r) => (
                          <Badge key={r} variant="secondary" className="rounded-full text-[11px]">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold tabular-nums">
                        ₹{formatBalance(entry.balance)}
                      </span>
                    </TableCell>
                    <TableCell className="pr-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => { setSheetUser(entry); setSheetOpen(true); }}
                          className="rounded-lg border border-black/[0.08] px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-black/[0.05] dark:border-white/[0.10] dark:hover:bg-white/[0.06]"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAdjustUser(entry); setAdjustOpen(true); }}
                          className="rounded-lg border border-black/[0.08] px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-black/[0.05] dark:border-white/[0.10] dark:hover:bg-white/[0.06]"
                        >
                          Adjust
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-black/[0.06] px-4 py-3 dark:border-white/[0.06]">
              <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/[0.08] text-muted-foreground disabled:opacity-40 hover:bg-black/[0.05] dark:border-white/[0.08]"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/[0.08] text-muted-foreground disabled:opacity-40 hover:bg-black/[0.05] dark:border-white/[0.08]"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Wallet detail sheet */}
      {sheetUser && (
        <WalletDetailSheet
          open={sheetOpen}
          userId={sheetUser.user_id}
          userName={sheetUser.full_name}
          balance={sheetUser.balance}
          onClose={() => setSheetOpen(false)}
          onAdjusted={() => queryClient.invalidateQueries({ queryKey: ["admin-wallets"] })}
        />
      )}

      {/* Adjust dialog from table row */}
      {adjustUser && (
        <AdjustDialog
          open={adjustOpen}
          userId={adjustUser.user_id}
          userName={adjustUser.full_name}
          onClose={() => setAdjustOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
            queryClient.invalidateQueries({ queryKey: ["admin-wallet-txns", adjustUser.user_id] });
          }}
        />
      )}
    </>
  );
}
