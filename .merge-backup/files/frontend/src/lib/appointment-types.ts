import type { AppointmentStatus } from "@/lib/types";

export type JoinWindow = "upcoming" | "joinable" | "expired";

export interface RankedMarketplaceLawyer {
  id: string;
  slug?: string | null;
  user_id?: string;
  full_name: string;
  bar_council_id: string | null;
  practice_areas: string[];
  city: string;
  jurisdictions: string[];
  languages: string[];
  years_experience: number;
  rating: number;
  rating_count?: number;
  review_count?: number;
  hourly_rate?: number | null;
  hourly_rate_inr?: number | null;
  is_verified?: boolean;
  verified?: boolean;
  summary?: string;
  bio?: string;
  match_score: number;
  ai_recommended: boolean;
}

export interface AppointmentRecord {
  id: string;
  lawyer_id: string;
  lawyer_name: string;
  lawyer_slug?: string | null;
  citizen_user_id: string;
  lawyer_user_id: string;
  citizen_name: string;
  counterpart_name: string;
  my_role: "citizen" | "lawyer" | "admin" | string;
  livekit_room?: string | null;
  date: string;
  time_slot: string;
  scheduled_at: string | null;
  scheduled_end_at: string | null;
  matter_summary: string;
  status: AppointmentStatus;
  source: string;
  join_state: JoinWindow;
  seconds_until_start: number;
  seconds_until_end: number;
  opponent_present: boolean;
  pending_summon: boolean;
  created_at: string;
  metrics: Record<string, number>;
  priority?: "normal" | "urgent" | "emergency" | string;
  emergency_status?: "none" | "open" | "ack" | "resolved" | string;
  emergency_reason?: string;
  emergency_at?: string | null;
  emergency_ack_at?: string | null;
  emergency_resolved_at?: string | null;
  assigned_admin_user_id?: string | null;
  ops_note?: string;
  citizen_present?: boolean;
  lawyer_present?: boolean;
  last_summon_at?: string | null;
  prior_join?: boolean;
}

export interface JoinStateDto {
  appointment_id: string;
  join_state: JoinWindow;
  seconds_until_start: number;
  seconds_until_end: number;
  opponent_present: boolean;
  pending_summon: boolean;
  opponent_typing?: boolean;
  status: AppointmentStatus | string;
  scheduled_at: string | null;
  scheduled_end_at: string | null;
  priority?: "normal" | "urgent" | "emergency" | string;
  emergency_status?: "none" | "open" | "ack" | "resolved" | string;
  emergency_reason?: string;
  last_summon_at?: string | null;
  prior_join?: boolean;
}

export interface SummonAlertPayload extends JoinStateDto {
  target_user_id?: string;
  from_name?: string;
}

export interface AppointmentAttachment {
  id: string;
  consultation_id: string;
  sender_user_id: string;
  receiver_user_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  kind: "document" | "image" | "screenshot" | "voice" | string;
  url: string;
  created_at: string;
}

export interface AppointmentMessage {
  id: string;
  sender_user_id: string;
  sender_role: string;
  body: string;
  created_at: string | null;
  reactions: Record<string, string[]>;
  kind?: "text" | "attachment" | string;
  attachment_id?: string | null;
  attachment?: AppointmentAttachment | null;
  pending?: boolean;
}

export type RoomStreamEvent =
  | { type: "join"; payload: { user_id?: string } }
  | { type: "message"; payload: AppointmentMessage }
  | { type: "attachment"; payload: AppointmentMessage }
  | { type: "typing"; payload: { user_id: string; on: boolean } }
  | { type: "reaction"; payload: { messageId: string; reactions: Record<string, string[]> } }
  | { type: "emergency"; payload: AppointmentRecord }
  | { type: "ops_update"; payload: AppointmentRecord }
  | { type: "summon"; payload: SummonAlertPayload };

export type AdminOpsEvent =
  | { type: "join"; payload: Record<string, never> }
  | { type: string; appointment_id?: string; payload: AppointmentRecord | Record<string, unknown> };

export interface RoomTokenResponse {
  token: string | null;
  url: string | null;
  room: string;
  configured: boolean;
  mode: "livekit" | "polling" | string;
}
