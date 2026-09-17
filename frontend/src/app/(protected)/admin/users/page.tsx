"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Search,
  Shield,
  Users,
  UserX,
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
  adminGetUserWallet,
  adminUpdateUser,
  listUsers,
} from "@/lib/api";
import type { AuthUser, WalletBalance } from "@/lib/types";
import { cn } from "@/lib/utils";

type TabId = "all" | "citizen" | "advocate" | "admin";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "citizen", label: "Citizens" },
  { id: "advocate", label: "Advocates" },
  { id: "admin", label: "Admins" },
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function UserInitials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : name.slice(0, 2);
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[13px] font-semibold text-white dark:bg-slate-200 dark:text-slate-900">
      {initials.toUpperCase()}
    </div>
  );
}

// ── Adjust Wallet Dialog ─────────────────────────────────────────────────────

interface AdjustWalletDialogProps {
  open: boolean;
  userId: string;
  userName: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AdjustWalletDialog({
  open,
  userId,
  userName,
  onClose,
  onSuccess,
}: AdjustWalletDialogProps) {
  const [type, setType] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      adminAdjustWallet(userId, { amount: Number(amount), type, reason }),
    onSuccess: () => {
      toast({ title: `Wallet ${type === "credit" ? "credited" : "debited"} successfully` });
      setAmount("");
      setReason("");
      setType("credit");
      onSuccess();
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: "Failed to adjust wallet", description: e.message, variant: "destructive" });
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
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Adjust wallet</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{userName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
          >
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
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="adj-amount">
              Amount (₹)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <Input
                id="adj-amount"
                type="number"
                min={1}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="adj-reason">
              Reason
            </label>
            <textarea
              id="adj-reason"
              rows={3}
              placeholder="Reason for this adjustment…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex gap-2 border-t border-black/[0.06] bg-black/[0.02] px-5 py-4 dark:border-white/[0.08] dark:bg-white/[0.02]">
          <Button variant="ghost" className="flex-1 rounded-xl" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className={cn(
              "flex-1 rounded-xl",
              type === "credit"
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-rose-600 text-white hover:bg-rose-700",
            )}
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

// ── User Detail Sheet ────────────────────────────────────────────────────────

interface UserDetailSheetProps {
  user: AuthUser | null;
  open: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
}

function UserDetailSheet({ user, open, onClose, onUserUpdated }: UserDetailSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const { data: wallet, isLoading: walletLoading } = useQuery<WalletBalance>({
    queryKey: ["admin-user-wallet", user?.user_id],
    queryFn: () => adminGetUserWallet(user!.user_id),
    enabled: open && !!user,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: () =>
      adminUpdateUser(user!.user_id, { is_active: !user!.is_active }),
    onSuccess: () => {
      toast({ title: user?.is_active ? "User deactivated" : "User activated" });
      onUserUpdated();
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => {
      toast({ title: "Failed to update user", description: e.message, variant: "destructive" });
    },
  });

  if (!mounted || !open || !user) return null;

  const isActive = user.is_active !== false;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-stretch sm:justify-end">
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          aria-label="Close"
          onClick={onClose}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-detail-title"
          className={cn(
            "relative z-[81] flex w-full flex-col bg-white",
            "max-h-[92vh] rounded-t-[1.6rem] border border-black/[0.08] shadow-[0_-12px_60px_rgba(15,23,42,0.18)]",
            "dark:border-white/10 dark:bg-[hsl(220_14%_9%)]",
            "sm:h-full sm:max-h-none sm:max-w-[480px] sm:rounded-none sm:border-l sm:shadow-[0_0_80px_rgba(15,23,42,0.18)]",
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-black/15 sm:hidden dark:bg-white/20" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
            <p className="text-xs font-semibold text-muted-foreground">User details</p>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Profile */}
            <div className="px-5 py-5">
              <div className="flex items-start gap-4">
                <UserInitials name={user.full_name} />
                <div className="min-w-0 flex-1">
                  <h2 id="user-detail-title" className="text-lg font-semibold tracking-tight">
                    {user.full_name}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">{user.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Joined {formatDate(user.created_at)}
                  </p>
                </div>
              </div>

              {/* Status */}
              <div className="mt-5 flex items-center justify-between rounded-xl border border-black/[0.06] bg-black/[0.02] px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Account status</p>
                  <p className={cn("mt-0.5 text-sm font-semibold", isActive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                    {isActive ? "Active" : "Inactive"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs"
                  disabled={toggleActiveMutation.isPending}
                  onClick={() => toggleActiveMutation.mutate()}
                >
                  {isActive ? "Deactivate" : "Activate"}
                </Button>
              </div>

              {/* Roles */}
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Roles</p>
                <div className="flex flex-wrap gap-1.5">
                  {user.roles.map((role) => (
                    <Badge key={role} variant="secondary" className="rounded-full">
                      {role}
                    </Badge>
                  ))}
                  {user.roles.length === 0 && (
                    <span className="text-xs text-muted-foreground">No roles assigned</span>
                  )}
                </div>
              </div>

              {/* Permissions */}
              {user.permissions.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Permissions</p>
                  <div className="flex flex-wrap gap-1">
                    {user.permissions.map((p) => (
                      <span
                        key={p}
                        className="rounded-full border border-black/[0.06] bg-black/[0.03] px-2 py-0.5 text-[10px] text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Wallet */}
            <div className="border-t border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Wallet balance</p>
                <button
                  type="button"
                  onClick={() => setAdjustOpen(true)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                >
                  <Wallet className="h-3 w-3" />
                  Adjust
                </button>
              </div>
              {walletLoading ? (
                <Skeleton className="mt-2 h-7 w-28" />
              ) : wallet ? (
                <p className="mt-1.5 text-xl font-semibold tabular-nums">
                  ₹{Number(wallet.balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              ) : (
                <p className="mt-1.5 text-sm text-muted-foreground">No wallet yet</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      <AdjustWalletDialog
        open={adjustOpen}
        userId={user.user_id}
        userName={user.full_name}
        onClose={() => setAdjustOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-user-wallet", user.user_id] });
        }}
      />
    </>,
    document.body,
  );
}

// ── Row Actions Menu ─────────────────────────────────────────────────────────

function RowActionsMenu({
  user,
  onViewDetails,
  onToggleActive,
}: {
  user: AuthUser;
  onViewDetails: () => void;
  onToggleActive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = user.is_active !== false;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-10 min-w-[160px] overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-[0_8px_30px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-zinc-900">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-black/[0.05] dark:hover:bg-white/[0.05]"
            onClick={() => { setOpen(false); onViewDetails(); }}
          >
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            View details
          </button>
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm",
              isActive
                ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40",
            )}
            onClick={() => { setOpen(false); onToggleActive(); }}
          >
            <UserX className="h-3.5 w-3.5" />
            {isActive ? "Deactivate" : "Activate"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [tab, setTab] = useState<TabId>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [tab, debouncedSearch, statusFilter]);

  const queryOpts = {
    search: debouncedSearch || undefined,
    is_active: statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined,
    role: tab !== "all" ? tab : undefined,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin-users", tab, debouncedSearch, statusFilter, page],
    queryFn: () => listUsers(page, 20, queryOpts),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (user: AuthUser) =>
      adminUpdateUser(user.user_id, { is_active: !(user.is_active !== false) }),
    onSuccess: (_result, user) => {
      const wasActive = user.is_active !== false;
      toast({ title: wasActive ? "User deactivated" : "User activated" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => {
      toast({ title: "Failed to update user", description: e.message, variant: "destructive" });
    },
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-5 pb-24 md:pb-10">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Users className="h-5 w-5 text-primary" />
              User management
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Platform accounts, roles, and access control
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-56 rounded-xl pl-8 text-sm sm:w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="h-9 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Desktop tabs */}
        <div className="hidden items-center gap-1 md:flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-sm font-medium transition",
                tab === t.id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.06]",
              )}
            >
              {t.label}
            </button>
          ))}
          {data && (
            <span className="ml-2 text-xs text-muted-foreground">
              {data.total} user{data.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white dark:border-white/10 dark:bg-white/[0.03]">
          {isLoading && (
            <div className="space-y-0 divide-y divide-black/[0.04] dark:divide-white/[0.06]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Shield className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">Failed to load users</p>
              <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
            </div>
          )}

          {data && data.items.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium">No users found</p>
              {(debouncedSearch || statusFilter) && (
                <p className="text-xs text-muted-foreground">Try adjusting your search or filters</p>
              )}
            </div>
          )}

          {data && data.items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow className="border-black/[0.06] dark:border-white/[0.06]">
                  <TableHead className="pl-4">User</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Joined</TableHead>
                  <TableHead className="w-10 pr-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((user) => {
                  const isActive = user.is_active !== false;
                  return (
                    <TableRow
                      key={user.user_id}
                      className="cursor-pointer border-black/[0.04] transition-colors hover:bg-black/[0.02] dark:border-white/[0.05] dark:hover:bg-white/[0.03]"
                      onClick={() => { setSelectedUser(user); setSheetOpen(true); }}
                    >
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2.5">
                          <UserInitials name={user.full_name} />
                          <span className="font-medium">{user.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.slice(0, 2).map((r) => (
                            <Badge key={r} variant="secondary" className="rounded-full text-[11px]">
                              {r}
                            </Badge>
                          ))}
                          {user.roles.length > 2 && (
                            <Badge variant="outline" className="rounded-full text-[11px]">
                              +{user.roles.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                            isActive
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
                          )}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {formatDate(user.created_at)}
                      </TableCell>
                      <TableCell
                        className="pr-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RowActionsMenu
                          user={user}
                          onViewDetails={() => { setSelectedUser(user); setSheetOpen(true); }}
                          onToggleActive={() => toggleActiveMutation.mutate(user)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {data && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-black/[0.06] px-4 py-3 dark:border-white/[0.06]">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/[0.08] text-muted-foreground disabled:opacity-40 hover:bg-black/[0.05] dark:border-white/[0.08] dark:hover:bg-white/[0.05]"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/[0.08] text-muted-foreground disabled:opacity-40 hover:bg-black/[0.05] dark:border-white/[0.08] dark:hover:bg-white/[0.05]"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom tab nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] bg-background/95 backdrop-blur-md md:hidden dark:border-white/10">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex min-w-[4rem] flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-medium",
                tab === t.id ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Users className="h-5 w-5" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* User detail sheet */}
      <UserDetailSheet
        user={selectedUser}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onUserUpdated={() => queryClient.invalidateQueries({ queryKey: ["admin-users"] })}
      />
    </>
  );
}
