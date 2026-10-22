/**
 * Saarthi question funnel — one implementation for guests and members.
 *
 *   question_submitted + ai_message_sent (+ ai_chat_started on a chat's first
 *   message) fire only once the server has ACCEPTED the question. A question
 *   that never gets that far fires question_blocked with the reason instead.
 *
 * Only enums and buckets are sent — never the question text.
 */
import { AnalyticsEvents, bucketCount, track } from "@/lib/analytics";
import { ChatStreamError, GuestLimitError } from "@/lib/api";

export type QuestionSource =
  | "typed"
  | "chip"
  | "example"
  | "suggestion"
  | "retry"
  | "edit_resend"
  | "autosend";

export type BlockReason = "guest_limit" | "wallet_empty" | "rate_limit" | "bot_check" | "error";

export function lengthBucket(length: number): string {
  if (length < 50) return "short";
  if (length < 200) return "medium";
  if (length < 600) return "long";
  return "very_long";
}

export function trackQuestionSent(p: {
  isGuest: boolean;
  source: QuestionSource;
  lang: string;
  questionLength: number;
  /** 1-based number of this user message in the chat. */
  messageNumber: number;
  entryPoint: "guest" | "composer";
  hasAttachment?: boolean;
  /** Topic of a tapped example question (e.g. "fraud"). */
  exampleTopic?: string;
}): void {
  track(AnalyticsEvents.QUESTION_SUBMITTED, {
    source: p.source,
    lang: p.lang,
    length_bucket: lengthBucket(p.questionLength),
    is_guest: p.isGuest,
    ...(p.exampleTopic ? { example_topic: p.exampleTopic } : {}),
  });
  if (p.messageNumber === 1) {
    track(AnalyticsEvents.AI_CHAT_STARTED, { session_type: "saarthi", entry_point: p.entryPoint, is_guest: p.isGuest });
  }
  track(AnalyticsEvents.AI_MESSAGE_SENT, {
    has_attachment: Boolean(p.hasAttachment),
    message_count_bucket: bucketCount(p.messageNumber),
    interaction_type: p.source === "retry" || p.source === "edit_resend" ? p.source : "send",
    is_guest: p.isGuest,
  });
}

/** Why a question never reached the model. */
export function blockReasonFor(err: unknown, isGuest: boolean): { reason: BlockReason; errorCode?: string } {
  if (err instanceof GuestLimitError) return { reason: "guest_limit" };
  if (err instanceof ChatStreamError) {
    if (err.code === "insufficient_balance") return { reason: "wallet_empty" };
    if (err.code === "rate_limited") return { reason: isGuest ? "guest_limit" : "rate_limit" };
    return { reason: "error", errorCode: err.code };
  }
  return { reason: "error", errorCode: "unknown" };
}

export function trackQuestionBlocked(p: {
  isGuest: boolean;
  reason: BlockReason;
  source: QuestionSource;
  errorCode?: string;
}): void {
  track(AnalyticsEvents.QUESTION_BLOCKED, {
    reason: p.reason,
    is_guest: p.isGuest,
    source: p.source,
    ...(p.errorCode ? { error_code: p.errorCode } : {}),
  });
}
