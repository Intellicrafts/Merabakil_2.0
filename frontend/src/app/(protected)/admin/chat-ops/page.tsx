"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ChevronLeft, ChevronRight, MessageSquare, Search } from "lucide-react";

import { ChatConversationDetail } from "@/components/admin/chat-conversation-detail";
import { ChatOpsLayout, type ChatOpsTab } from "@/components/admin/chat-ops-layout";
import { ChatUserPanel } from "@/components/admin/chat-user-panel";
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
import {
  adminGetChatStats,
  adminListAllConversations,
  adminListChatUsers,
} from "@/lib/api";
import { CLARITY_MASK } from "@/lib/analytics/clarity-mask";
import type { AdminChatUserSummary, AdminConversationSummary } from "@/lib/types";

const PAGE_SIZE = 20;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function UserInitials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : name.slice(0, 2);
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-[12px] font-semibold text-white">
      {initials.toUpperCase()}
    </div>
  );
}

export default function AdminChatOpsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ChatOpsTab>("users");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AdminChatUserSummary | null>(null);
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(search.trim());
    setPage(1);
  };

  const statsQuery = useQuery({
    queryKey: ["admin-chat-stats"],
    queryFn: adminGetChatStats,
    refetchInterval: 30_000,
  });

  const usersQuery = useQuery({
    queryKey: ["admin-chat-users", page, debouncedSearch],
    queryFn: () => adminListChatUsers(page, PAGE_SIZE, debouncedSearch || undefined),
    enabled: tab === "users",
    retry: 2,
  });

  const conversationsQuery = useQuery({
    queryKey: ["admin-chat-conversations", page, debouncedSearch],
    queryFn: () => adminListAllConversations(page, PAGE_SIZE, { search: debouncedSearch || undefined }),
    enabled: tab === "conversations",
    retry: 2,
  });

  const activeQuery = tab === "users" ? usersQuery : conversationsQuery;
  const activePage = activeQuery.data;
  const isLoading = activeQuery.isLoading;
  const isError = activeQuery.isError;
  const errorMessage = activeQuery.error instanceof Error ? activeQuery.error.message : "Failed to load data";

  const stats = statsQuery.data ?? {
    usersWithChats: 0,
    totalConversations: 0,
    totalMessages: 0,
    messagesToday: 0,
  };

  const refreshAll = () => {
    void statsQuery.refetch();
    void activeQuery.refetch();
  };

  const openUserPanel = (user: AdminChatUserSummary) => {
    setSelectedUser(user);
    setUserPanelOpen(true);
  };

  const openConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setDetailOpen(true);
  };

  const handleUserConversationSelect = (conversationId: string) => {
    setUserPanelOpen(false);
    openConversation(conversationId);
  };

  const handleMutationRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-chat-stats"] });
    void usersQuery.refetch();
    void conversationsQuery.refetch();
  };

  return (
    <>
      <ChatOpsLayout
        tab={tab}
        onTabChange={(next) => { setTab(next); setPage(1); }}
        stats={stats}
        statsLoading={statsQuery.isLoading}
        onRefresh={refreshAll}
        refreshing={statsQuery.isFetching || activeQuery.isFetching}
      >
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "users" ? "Search by name or email…" : "Search conversations, users…"}
              className="rounded-xl border-black/[0.08] pl-9 dark:border-white/10"
            />
          </div>
          <Button type="submit" variant="secondary" className="rounded-xl">
            Search
          </Button>
        </form>

        {isError ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-950/30 dark:text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Could not load chat data</p>
              <p className="mt-0.5 text-rose-700/80 dark:text-rose-200/80">{errorMessage}</p>
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => activeQuery.refetch()}>
                Retry
              </Button>
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.02]">
          {tab === "users" ? (
            <UsersTable
              items={usersQuery.data?.items ?? []}
              isLoading={isLoading}
              onSelectUser={openUserPanel}
            />
          ) : (
            <ConversationsTable
              items={conversationsQuery.data?.items ?? []}
              isLoading={isLoading}
              onSelectConversation={openConversation}
            />
          )}
        </div>

        {activePage && activePage.pages > 1 ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Page {activePage.page} of {activePage.pages} · {activePage.total} total
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= activePage.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </ChatOpsLayout>

      <ChatUserPanel
        user={selectedUser}
        open={userPanelOpen}
        onClose={() => setUserPanelOpen(false)}
        onSelectConversation={handleUserConversationSelect}
      />

      <ChatConversationDetail
        conversationId={selectedConversationId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onDeleted={handleMutationRefresh}
      />
    </>
  );
}

function UsersTable({
  items,
  isLoading,
  onSelectUser,
}: {
  items: AdminChatUserSummary[];
  isLoading: boolean;
  onSelectUser: (user: AdminChatUserSummary) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
        <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No users with Saarthi conversations found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Roles</TableHead>
          <TableHead className="text-right">Conversations</TableHead>
          <TableHead className="text-right">Messages</TableHead>
          <TableHead>Last active</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((user) => (
          <TableRow
            key={user.userId}
            className="cursor-pointer transition hover:bg-violet-500/[0.04]"
            onClick={() => onSelectUser(user)}
          >
            <TableCell>
              <div className="flex items-center gap-3">
                <UserInitials name={user.fullName} />
                <div {...CLARITY_MASK}>
                  <p className="font-medium">{user.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {user.roles.slice(0, 2).map((role) => (
                  <Badge key={role} variant="secondary" className="text-[10px]">{role}</Badge>
                ))}
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">{user.conversationCount}</TableCell>
            <TableCell className="text-right tabular-nums">{user.totalMessages}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{formatDate(user.lastActivity)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ConversationsTable({
  items,
  isLoading,
  onSelectConversation,
}: {
  items: AdminConversationSummary[];
  isLoading: boolean;
  onSelectConversation: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
        <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No conversations found.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>User</TableHead>
          <TableHead className="text-right">Messages</TableHead>
          <TableHead>Jurisdiction</TableHead>
          <TableHead>Updated</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((conv) => (
          <TableRow
            key={conv.id}
            className="cursor-pointer transition hover:bg-violet-500/[0.04]"
            onClick={() => onSelectConversation(conv.id)}
          >
            <TableCell>
              <div className="flex items-center gap-2">
                <p className="font-medium">{conv.title}</p>
                {conv.pinned ? <Badge variant="outline" className="text-[10px]">Pinned</Badge> : null}
              </div>
            </TableCell>
            <TableCell {...CLARITY_MASK}>
              <p className="text-sm">{conv.userName ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{conv.userEmail ?? ""}</p>
            </TableCell>
            <TableCell className="text-right tabular-nums">{conv.messageCount}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{conv.jurisdiction ?? "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{formatDate(conv.updatedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
