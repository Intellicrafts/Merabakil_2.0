"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, Heart, ThumbsUp } from "lucide-react";

import "./room.css";

import { AttachmentPreview } from "@/components/appointment-room/attachment-preview";
import type { AppointmentMessage } from "@/lib/appointment-types";
import { cn } from "@/lib/utils";

const REACTIONS = [
  { key: "agree", label: "Agree", Icon: ThumbsUp },
  { key: "helpful", label: "Helpful", Icon: Heart },
  { key: "noted", label: "Noted", Icon: Check },
] as const;

const NEAR_BOTTOM_PX = 72;

interface ChatPaneProps {
  appointmentId: string;
  messages: AppointmentMessage[];
  userId: string;
  typing: boolean;
  counterpartName: string;
  onReact: (messageId: string, emoji: string) => void;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

function messageSnapshot(messages: AppointmentMessage[]) {
  const last = messages[messages.length - 1];
  return { count: messages.length, lastId: last?.id ?? "" };
}

export function ChatPane({
  appointmentId,
  messages,
  userId,
  typing,
  counterpartName,
  onReact,
}: ChatPaneProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const prevSnapshot = useRef(messageSnapshot([]));
  const prevTyping = useRef(false);
  const didInitialScroll = useRef(false);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const [unreadBelow, setUnreadBelow] = useState(0);

  const isNearBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const jumpToLatest = useCallback(() => {
    stickToBottom.current = true;
    setUnreadBelow(0);
    scrollToBottom("smooth");
  }, [scrollToBottom]);

  function onScroll() {
    const near = isNearBottom();
    stickToBottom.current = near;
    if (near) setUnreadBelow(0);
  }

  useLayoutEffect(() => {
    if (didInitialScroll.current || messages.length === 0) return;
    didInitialScroll.current = true;
    prevSnapshot.current = messageSnapshot(messages);
    scrollToBottom("instant");
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    const snap = messageSnapshot(messages);
    const prev = prevSnapshot.current;
    const messageAdded = snap.count > prev.count || (snap.lastId !== "" && snap.lastId !== prev.lastId);
    const typingStarted = typing && !prevTyping.current;
    prevTyping.current = typing;
    prevSnapshot.current = snap;

    if (!messageAdded && !typingStarted) return;

    const last = messages[messages.length - 1];
    const ownMessage = last?.sender_user_id === userId;

    if (ownMessage || stickToBottom.current) {
      requestAnimationFrame(() => {
        scrollToBottom(ownMessage || typingStarted ? "instant" : "smooth");
      });
      if (stickToBottom.current) setUnreadBelow(0);
      return;
    }

    if (messageAdded && last && last.sender_user_id !== userId) {
      setUnreadBelow((n) => n + 1);
    }
  }, [messages, typing, userId, scrollToBottom]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) scrollToBottom("instant");
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain py-2"
      >
        <div ref={contentRef} className="mx-auto w-full max-w-[680px] px-4">
          {messages.length === 0 && (
            <p className="mx-auto mt-16 max-w-xs text-center text-[12px] leading-relaxed text-muted-foreground">
              Messages stay with this appointment. Leave anytime — you can rejoin until the hour ends.
            </p>
          )}
          <ul className="flex flex-col gap-1">
            {messages.map((msg, index) => {
              const mine = msg.sender_user_id === userId;
              const isAdmin = msg.sender_role === "admin";
              const prev = messages[index - 1];
              const next = messages[index + 1];
              const grouped = Boolean(prev && prev.sender_user_id === msg.sender_user_id);
              const lastInGroup = !next || next.sender_user_id !== msg.sender_user_id;

              if (isAdmin) {
                return (
                  <li key={msg.id} className="mt-3 flex justify-center">
                    <div className="max-w-[92%] rounded-xl border border-slate-300/60 bg-slate-100/90 px-3.5 py-2 text-center text-[12.5px] leading-relaxed text-slate-800 dark:border-white/15 dark:bg-white/[0.06] dark:text-zinc-100">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ops notice</p>
                      <p className="mt-1 whitespace-pre-wrap">{msg.body}</p>
                      {msg.created_at ? (
                        <time className="mt-1 block text-[10px] tabular-nums text-muted-foreground">{formatTime(msg.created_at)}</time>
                      ) : null}
                    </div>
                  </li>
                );
              }

              return (
                <li
                  key={msg.id}
                  className={cn("flex", mine ? "justify-end" : "justify-start", grouped ? "mt-0.5" : "mt-2.5")}
                >
                  <div className={cn("flex w-[78%] max-w-[78%] flex-col", mine ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "px-3.5 py-2 text-[13.5px] leading-relaxed",
                        mine
                          ? "rounded-2xl rounded-br-md bg-gradient-to-br from-slate-800 to-slate-900 text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900"
                          : "rounded-2xl rounded-bl-md bg-stone-100/90 text-stone-800 dark:bg-white/[0.08] dark:text-zinc-100",
                        msg.pending && "opacity-70",
                      )}
                    >
                      {msg.attachment ? (
                        <AttachmentPreview
                          appointmentId={appointmentId}
                          attachment={msg.attachment}
                          mine={mine}
                          onOpenImage={(url, name) => setLightbox({ url, name })}
                        />
                      ) : null}
                      {msg.body &&
                      (!msg.attachment ||
                        (msg.body !== msg.attachment.filename &&
                          msg.attachment.kind !== "voice" &&
                          msg.body !== "Voice note")) ? (
                        <p className={cn("whitespace-pre-wrap", msg.attachment && "mt-1.5")}>{msg.body}</p>
                      ) : null}
                    </div>

                    <div className={cn("mt-1 flex items-center gap-0.5", mine ? "flex-row-reverse" : "flex-row")}>
                      {REACTIONS.map((item) => {
                        const holders = msg.reactions?.[item.key] ?? [];
                        const active = holders.includes(userId);
                        return (
                          <button
                            key={item.key}
                            type="button"
                            title={item.label}
                            onClick={() => onReact(msg.id, item.key)}
                            className={cn(
                              "apt-react-chip inline-flex h-6 items-center gap-0.5 rounded-full px-1.5 text-[10px] font-medium transition-transform hover:scale-110 active:scale-95",
                              active
                                ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                                : "text-muted-foreground hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10",
                            )}
                          >
                            <item.Icon
                              className={cn("h-3 w-3", item.key === "helpful" && active && "fill-current")}
                            />
                            {holders.length > 0 ? holders.length : null}
                            <span className="sr-only">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {lastInGroup && (
                      <time
                        className={cn(
                          "mt-0.5 px-1 text-[10px] tabular-nums text-muted-foreground",
                          mine && "text-right",
                        )}
                      >
                        {formatTime(msg.created_at)}
                        {msg.pending ? " · sending" : ""}
                      </time>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {typing && (
            <div className="mt-3 flex justify-start">
              <div className="rounded-2xl rounded-bl-md bg-stone-100/90 px-3.5 py-2.5 dark:bg-white/[0.08]">
                <p className="sr-only">{counterpartName} is typing</p>
                <span className="flex items-center gap-1">
                  <span className="apt-typing-dot h-1.5 w-1.5 rounded-full bg-stone-500" />
                  <span className="apt-typing-dot h-1.5 w-1.5 rounded-full bg-stone-500 [animation-delay:140ms]" />
                  <span className="apt-typing-dot h-1.5 w-1.5 rounded-full bg-stone-500 [animation-delay:280ms]" />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {unreadBelow > 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-4">
          <button
            type="button"
            onClick={jumpToLatest}
            className="pointer-events-auto inline-flex h-9 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/95 px-3.5 text-[12px] font-semibold text-slate-800 shadow-md backdrop-blur-sm transition-transform hover:scale-[1.02] active:scale-[0.98] dark:border-white/15 dark:bg-slate-900/95 dark:text-zinc-100"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            {unreadBelow === 1 ? "New message" : `${unreadBelow} new messages`}
          </button>
        </div>
      ) : null}

      {lightbox && (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.url} alt={lightbox.name} className="max-h-full max-w-full rounded-xl object-contain" />
        </button>
      )}
    </div>
  );
}
