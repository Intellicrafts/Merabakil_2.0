import { AnalyticsEvents } from "@/lib/analytics/events";
import { bucketCount, track } from "@/lib/analytics/track";
import type { ChatConversation } from "@/lib/conversations";

/** End an active Saarthi session when the user leaves or starts a new chat. */
export function trackAiSessionCompleted(conv: ChatConversation | null | undefined): void {
  if (!conv) return;
  const hasUserMessage = conv.messages.some((m) => m.role === "user");
  if (!hasUserMessage) return;
  track(AnalyticsEvents.AI_SESSION_COMPLETED, {
    message_count_bucket: bucketCount(conv.messages.length),
    session_type: "saarthi",
  });
}
