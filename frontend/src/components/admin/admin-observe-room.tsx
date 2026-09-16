"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Circle,
  Clock,
  Eye,
  LayoutDashboard,
  MessageSquare,
  Mic,
  Phone,
  Radio,
  RefreshCw,
  Send,
  Siren,
  UserPlus,
  Users,
  Video,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";

import { AdminTranscriptPane } from "@/components/admin/admin-transcript-pane";
import { formatClock } from "@/components/admin/admin-ops-utils";
import { SessionDiagnostics } from "@/components/admin/session-diagnostics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useAppointmentRoomEvents } from "@/hooks/use-appointment-room-events";
import {
  adminAckEmergency,
  adminForceSummon,
  adminGetAppointment,
  adminObserveToken,
  adminResolveEmergency,
  adminSessionHealth,
  adminSystemMessage,
} from "@/lib/api";
import type { AppointmentMessage } from "@/lib/appointment-types";
import { disconnectLiveKitRoom, initLiveKitClient } from "@/lib/livekit-room";
import { cn } from "@/lib/utils";

interface AdminObserveRoomProps {
  appointmentId: string;
}

interface RemoteVideo {
  id: string;
  stream: MediaStream;
  label: string;
}

function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        online ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-muted-foreground/40",
      )}
    />
  );
}

function PartyPresenceCard({
  role,
  name,
  present,
  livekitConnected,
  moderationStatus,
}: {
  role: string;
  name: string;
  present: boolean;
  livekitConnected: boolean;
  moderationStatus?: string;
}) {
  const blocked = moderationStatus === "kicked" || moderationStatus === "suspended";
  return (
    <div className="rounded-xl border border-black/[0.06] bg-gradient-to-br from-background to-muted/30 p-3 dark:border-white/10">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{role}</p>
          <p className="truncate text-sm font-medium">{name}</p>
        </div>
        <PresenceDot online={present && !blocked} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px] font-normal">
          {present ? "In session" : "Away"}
        </Badge>
        <Badge variant="outline" className="rounded-md px-1.5 py-0 text-[10px] font-normal">
          {livekitConnected ? "Media linked" : "No media"}
        </Badge>
        {blocked ? (
          <Badge variant="destructive" className="rounded-md px-1.5 py-0 text-[10px] font-normal capitalize">
            {moderationStatus}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

export function AdminObserveRoom({ appointmentId }: AdminObserveRoomProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const roomRef = useRef<{ disconnect: () => Promise<void> } | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const sysInputRef = useRef<HTMLTextAreaElement>(null);
  const [connected, setConnected] = useState(false);
  const [remoteVideos, setRemoteVideos] = useState<RemoteVideo[]>([]);
  const [messages, setMessages] = useState<AppointmentMessage[]>([]);
  const [sysMsg, setSysMsg] = useState("");
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"session" | "transcript">("transcript");

  const detailQuery = useQuery({
    queryKey: ["admin-appointment", appointmentId],
    queryFn: () => adminGetAppointment(appointmentId),
    refetchInterval: 3000,
  });

  const healthQuery = useQuery({
    queryKey: ["admin-session-health", appointmentId],
    queryFn: () => adminSessionHealth(appointmentId),
    refetchInterval: 3000,
  });

  const apt = detailQuery.data?.appointment;
  const health = healthQuery.data;

  useEffect(() => {
    if (detailQuery.data?.messages) setMessages(detailQuery.data.messages);
  }, [detailQuery.data?.messages]);

  const attachAudio = useCallback((trackSid: string, mediaStreamTrack: MediaStreamTrack) => {
    let el = audioElementsRef.current.get(trackSid);
    if (!el) {
      el = document.createElement("audio");
      el.autoplay = true;
      el.style.display = "none";
      document.body.appendChild(el);
      audioElementsRef.current.set(trackSid, el);
    }
    el.srcObject = new MediaStream([mediaStreamTrack]);
    void el.play().catch(() => setAudioBlocked(true));
  }, []);

  const detachAudio = useCallback((trackSid: string) => {
    const el = audioElementsRef.current.get(trackSid);
    if (el) {
      el.pause();
      el.srcObject = null;
      el.remove();
      audioElementsRef.current.delete(trackSid);
    }
  }, []);

  useEffect(() => {
    initLiveKitClient();
  }, []);

  const connectObserve = useCallback(async () => {
    try {
      const tokenRes = await adminObserveToken(appointmentId);
      if (!tokenRes.configured || !tokenRes.token || !tokenRes.url) {
        setConnected(false);
        return;
      }
      const lk = await import("livekit-client");
      const room = new lk.Room({ dynacast: true, disconnectOnPageLeave: false });
      roomRef.current = room;
      const videoMap = new Map<string, RemoteVideo>();

      room.on(lk.RoomEvent.Disconnected, () => {
        if (roomRef.current === room) roomRef.current = null;
        setConnected(false);
        setRemoteVideos([]);
        for (const sid of [...audioElementsRef.current.keys()]) detachAudio(sid);
      });

      room.on(lk.RoomEvent.TrackSubscribed, (track: unknown, _pub: unknown, participant: unknown) => {
        const t = track as Record<string, unknown>;
        const p = participant as { identity?: string; name?: string };
        const sid = String(t.sid ?? `${p.identity}-${t.kind}`);
        const label = p.name || p.identity || "Participant";

        if (t.kind === lk.Track.Kind.Audio) {
          const mst = t.mediaStreamTrack as MediaStreamTrack | undefined;
          if (mst) attachAudio(sid, mst);
          return;
        }

        if (t.kind !== lk.Track.Kind.Video) return;
        const mst =
          (t.mediaStreamTrack as MediaStreamTrack | undefined) ??
          ((t.mediaStream as MediaStream | undefined)?.getVideoTracks()[0]);
        if (!mst) return;
        videoMap.set(sid, { id: sid, stream: new MediaStream([mst]), label });
        setRemoteVideos([...videoMap.values()]);
      });

      room.on(lk.RoomEvent.TrackUnsubscribed, (track: unknown, _pub: unknown, participant: unknown) => {
        const t = track as Record<string, unknown>;
        const p = participant as { identity?: string };
        const sid = String(t.sid ?? `${p.identity}-${t.kind}`);
        if (t.kind === lk.Track.Kind.Audio) {
          detachAudio(sid);
          return;
        }
        if (t.kind === lk.Track.Kind.Video) {
          videoMap.delete(sid);
          setRemoteVideos([...videoMap.values()]);
        }
      });

      await room.connect(tokenRes.url, tokenRes.token);
      setConnected(true);
    } catch {
      setConnected(false);
      toast({
        title: "Observe connect failed",
        description: "Showing transcript-only mode. You can still monitor messages and session health.",
        variant: "destructive",
      });
    }
  }, [appointmentId, attachAudio, detachAudio, toast]);

  useEffect(() => {
    void connectObserve();
    return () => {
      const room = roomRef.current;
      roomRef.current = null;
      void disconnectLiveKitRoom(room);
      for (const sid of [...audioElementsRef.current.keys()]) detachAudio(sid);
    };
  }, [connectObserve, detachAudio]);

  useAppointmentRoomEvents(appointmentId, (event) => {
    if (event.type === "message" && event.payload) {
      const msg = event.payload as AppointmentMessage;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    }
    if (event.type === "ops_update") {
      void queryClient.invalidateQueries({ queryKey: ["admin-appointment", appointmentId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-session-health", appointmentId] });
    }
  });

  const summonMut = useMutation({
    mutationFn: () => adminForceSummon(appointmentId),
    onSuccess: () => toast({ title: "Summon sent to both parties" }),
  });

  const sysMut = useMutation({
    mutationFn: (body: string) => adminSystemMessage(appointmentId, body),
    onSuccess: () => {
      toast({ title: "System message delivered" });
      setSysMsg("");
      void queryClient.invalidateQueries({ queryKey: ["admin-appointment", appointmentId] });
    },
    onError: (err: Error) =>
      toast({ title: "Message failed", description: err.message, variant: "destructive" }),
  });

  const ackMut = useMutation({
    mutationFn: () => adminAckEmergency(appointmentId),
    onSuccess: () => {
      toast({ title: "SOS acknowledged" });
      void queryClient.invalidateQueries({ queryKey: ["admin-appointment", appointmentId] });
    },
  });

  const resolveMut = useMutation({
    mutationFn: () => adminResolveEmergency(appointmentId),
    onSuccess: () => {
      toast({ title: "SOS resolved" });
      void queryClient.invalidateQueries({ queryKey: ["admin-appointment", appointmentId] });
    },
  });

  function unlockAudio() {
    for (const el of audioElementsRef.current.values()) {
      void el.play().catch(() => undefined);
    }
    setAudioBlocked(false);
  }

  function sendSystemMessage() {
    const body = sysMsg.trim();
    if (!body || sysMut.isPending) return;
    sysMut.mutate(body);
  }

  function handleSysKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendSystemMessage();
    }
  }

  if (detailQuery.isLoading) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-8 w-48 rounded-lg" />
        </div>
        <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-full min-h-[200px] rounded-2xl" />
          <Skeleton className="h-full min-h-[200px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!apt) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center px-4">
        <p className="text-muted-foreground">Appointment not found.</p>
        <Button className="mt-4 rounded-xl" onClick={() => router.push("/admin/appointments")}>
          Back to operations
        </Button>
      </div>
    );
  }

  const showSos = apt.emergency_status === "open" || apt.emergency_status === "ack";
  const callActive = health?.call?.active;
  const liveMode = connected ? "livekit" : health?.livekit.mode ?? "polling";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-black/[0.06] bg-background/95 backdrop-blur-md dark:border-white/10">
        <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <Link
            href={`/admin/appointments/${appointmentId}`}
            className="shrink-0 rounded-xl p-2 transition hover:bg-muted"
            aria-label="Back to command center"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                <Eye className="h-3 w-3" />
                Observe
              </span>
              <Badge
                variant={connected ? "default" : "secondary"}
                className="h-5 rounded-md px-1.5 text-[10px] capitalize"
              >
                {connected ? (
                  <span className="flex items-center gap-1">
                    <Wifi className="h-3 w-3" />
                    Live media
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <WifiOff className="h-3 w-3" />
                    {liveMode}
                  </span>
                )}
              </Badge>
              {callActive ? (
                <Badge variant="outline" className="h-5 rounded-md px-1.5 text-[10px]">
                  <Phone className="mr-0.5 h-3 w-3" />
                  Call active
                </Badge>
              ) : null}
              <Badge variant="outline" className="hidden h-5 rounded-md px-1.5 text-[10px] sm:inline-flex">
                <Clock className="mr-0.5 h-3 w-3" />
                Ends {formatClock(apt.scheduled_end_at)}
              </Badge>
            </div>
            <p className="truncate text-sm font-semibold sm:text-base">
              {apt.citizen_name}
              <span className="mx-1.5 font-normal text-muted-foreground">↔</span>
              {apt.lawyer_name}
            </p>
          </div>

          <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
            <Button asChild size="sm" variant="outline" className="h-8 rounded-lg text-xs">
              <Link href={`/admin/appointments/${appointmentId}`}>
                <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
                Command
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-xs"
              disabled={summonMut.isPending}
              onClick={() => summonMut.mutate()}
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Summon
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile panel switch */}
      <div className="flex shrink-0 gap-1 border-b border-black/[0.06] p-2 lg:hidden dark:border-white/10">
        <button
          type="button"
          onClick={() => setMobilePanel("transcript")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition",
            mobilePanel === "transcript" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground",
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Transcript
        </button>
        <button
          type="button"
          onClick={() => setMobilePanel("session")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition",
            mobilePanel === "session" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground",
          )}
        >
          <Video className="h-3.5 w-3.5" />
          Session
        </button>
      </div>

      {/* Body — two columns on lg; mobile shows one panel at a time */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        {/* Left: media + session intel */}
        <section
          className={cn(
            "flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain p-3 sm:p-4 lg:max-h-full",
            mobilePanel !== "session" && "hidden lg:flex",
          )}
        >
          {audioBlocked ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-50/90 px-3 py-2.5 text-xs dark:bg-amber-950/25">
              <span className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-100">
                <Volume2 className="h-4 w-4 shrink-0" />
                Browser blocked audio — tap to listen in
              </span>
              <Button size="sm" className="h-8 rounded-lg" onClick={unlockAudio}>
                Enable audio
              </Button>
            </div>
          ) : null}

          {showSos ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-50 to-orange-50/80 px-3 py-2.5 dark:from-amber-950/40 dark:to-orange-950/20">
              <Siren className="h-4 w-4 shrink-0 animate-pulse text-amber-600" />
              <span className="min-w-0 flex-1 text-xs font-medium sm:text-sm">
                {apt.emergency_reason || "Active SOS on this session"}
              </span>
              {apt.emergency_status === "open" ? (
                <Button size="sm" className="h-8 rounded-lg" disabled={ackMut.isPending} onClick={() => ackMut.mutate()}>
                  Acknowledge
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg"
                disabled={resolveMut.isPending}
                onClick={() => resolveMut.mutate()}
              >
                Resolve
              </Button>
            </div>
          ) : null}

          {/* Presence cards */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <PartyPresenceCard
              role="Citizen"
              name={apt.citizen_name}
              present={health?.citizen.present ?? false}
              livekitConnected={health?.citizen.livekit_connected ?? false}
              moderationStatus={health?.citizen.moderation.status}
            />
            <PartyPresenceCard
              role="Counsel"
              name={apt.lawyer_name}
              present={health?.lawyer.present ?? false}
              livekitConnected={health?.lawyer.livekit_connected ?? false}
              moderationStatus={health?.lawyer.moderation.status}
            />
          </div>

          {/* Video feeds */}
          {remoteVideos.length > 0 ? (
            <div className={cn("grid gap-2", remoteVideos.length > 1 ? "sm:grid-cols-2" : "grid-cols-1")}>
              {remoteVideos.map((item) => (
                <div
                  key={item.id}
                  className="group relative aspect-video overflow-hidden rounded-xl border border-black/[0.08] bg-black shadow-sm dark:border-white/10"
                >
                  <video
                    autoPlay
                    playsInline
                    ref={(el) => {
                      if (el) el.srcObject = item.stream;
                    }}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                    <Video className="h-3.5 w-3.5 text-white/90" />
                    <span className="truncate text-xs font-medium text-white">{item.label}</span>
                    <Circle className="ml-auto h-2 w-2 fill-emerald-400 text-emerald-400" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-black/[0.08] bg-muted/15 px-4 py-10 text-center dark:border-white/10">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
                <Radio className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">
                {connected ? "Waiting for participant video" : "Transcript & presence mode"}
              </p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                {connected
                  ? "Audio may still be available. Video appears when parties enable their cameras."
                  : "LiveKit media unavailable — monitoring messages, presence, and session health."}
              </p>
              {health ? (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <Badge variant="outline" className="rounded-md text-[10px]">
                    <Users className="mr-1 h-3 w-3" />
                    {health.livekit.participant_count} in room
                  </Badge>
                  <Badge variant="outline" className="rounded-md text-[10px]">
                    <Mic className="mr-1 h-3 w-3" />
                    Subscribe-only
                  </Badge>
                </div>
              ) : null}
            </div>
          )}

          <SessionDiagnostics
            health={health}
            loading={healthQuery.isFetching}
            onRefresh={() => void healthQuery.refetch()}
            onSummon={() => summonMut.mutate()}
          />

          {/* Mobile quick actions */}
          <div className="flex flex-wrap gap-2 lg:hidden">
            <Button asChild size="sm" variant="outline" className="h-9 flex-1 rounded-xl sm:flex-none">
              <Link href={`/admin/appointments/${appointmentId}`}>
                <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
                Command center
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 flex-1 rounded-xl sm:flex-none"
              disabled={summonMut.isPending}
              onClick={() => summonMut.mutate()}
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Summon parties
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 rounded-xl"
              onClick={() => void healthQuery.refetch()}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", healthQuery.isFetching && "animate-spin")} />
            </Button>
          </div>
        </section>

        {/* Right: transcript + composer (always in viewport) */}
        <aside
          className={cn(
            "flex min-h-0 flex-col border-t border-black/[0.06] dark:border-white/10 lg:border-l lg:border-t-0",
            mobilePanel !== "transcript" && "hidden lg:flex",
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
            <AdminTranscriptPane appointment={apt} messages={messages} className="min-h-[180px] lg:min-h-0" />
          </div>

          {/* System message composer — flows in layout, never clipped off-screen */}
          <div className="shrink-0 border-t border-black/[0.06] bg-muted/20 p-3 dark:border-white/10 sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                Admin system message
              </p>
              <span className="hidden text-[10px] text-muted-foreground sm:inline">Enter to send · Shift+Enter for new line</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Textarea
                ref={sysInputRef}
                value={sysMsg}
                onChange={(e) => setSysMsg(e.target.value)}
                onKeyDown={handleSysKeyDown}
                placeholder="Broadcast a notice visible to both parties…"
                rows={2}
                className="min-h-[44px] max-h-[120px] flex-1 resize-none rounded-xl border-black/[0.08] bg-background text-sm dark:border-white/10"
              />
              <Button
                className="h-10 shrink-0 rounded-xl px-4 sm:h-auto sm:self-stretch"
                disabled={sysMut.isPending || !sysMsg.trim()}
                onClick={sendSystemMessage}
              >
                {sysMut.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="mr-1.5 h-4 w-4 sm:mr-0 sm:lg:mr-1.5" />
                    <span className="sm:hidden lg:inline">Send</span>
                  </>
                )}
              </Button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              Observe-only — you subscribe to media but do not publish mic or camera.
            </p>
          </div>

          {/* Desktop sidebar links */}
          <div className="hidden shrink-0 border-t border-black/[0.06] p-3 dark:border-white/10 lg:block">
            <div className="grid grid-cols-2 gap-1.5">
              <Button asChild size="sm" variant="ghost" className="h-8 justify-start rounded-lg text-xs">
                <Link href={`/admin/appointments/${appointmentId}#duration-control`}>
                  <Clock className="mr-1.5 h-3.5 w-3.5" />
                  Duration
                </Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 justify-start rounded-lg text-xs"
                onClick={() => void healthQuery.refetch()}
              >
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", healthQuery.isFetching && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
