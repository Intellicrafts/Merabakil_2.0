/** GA4 custom event names — object_action convention. */
export const AnalyticsEvents = {
  // Marketing
  LANDING_PAGE_VIEWED: "landing_page_viewed",
  MARKETING_CTA_CLICKED: "marketing_cta_clicked",
  FAQ_OPENED: "faq_opened",
  LEGAL_PAGE_VIEWED: "legal_page_viewed",

  // Saarthi question-first funnel (NEVER include question text)
  ASK_PAGE_VIEWED: "ask_page_viewed",
  QUESTION_SUBMITTED: "question_submitted",
  FIRST_ANSWER_SHOWN: "first_answer_shown",
  GUEST_LIMIT_REACHED: "guest_limit_reached",
  GUEST_SIGNUP_PROMPT_SHOWN: "guest_signup_prompt_shown",

  // Auth
  SIGNUP_STARTED: "signup_started",
  SIGNUP_COMPLETED: "signup_completed",
  LOGIN_STARTED: "login_started",
  LOGIN_COMPLETED: "login_completed",
  LOGOUT_COMPLETED: "logout_completed",
  PASSWORD_RESET_STARTED: "password_reset_started",
  PASSWORD_RESET_COMPLETED: "password_reset_completed",

  // Onboarding
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_COMPLETED: "onboarding_completed",

  // AI / Saarthi
  SAARTHI_MATTER_TYPE_SELECTED: "saarthi_matter_type_selected",
  SAARTHI_VOICE_MODE_ACTIVATED: "saarthi_voice_mode_activated",
  VOICE_SESSION_ENDED: "voice_session_ended",
  SAARTHI_DOCUMENT_ATTACHED: "saarthi_document_attached",

  // AI
  AI_CHAT_STARTED: "ai_chat_started",
  AI_MESSAGE_SENT: "ai_message_sent",
  AI_RESPONSE_RECEIVED: "ai_response_received",
  AI_SESSION_COMPLETED: "ai_session_completed",
  AI_RESPONSE_COPIED: "ai_response_copied",

  // Documents
  DOCUMENT_UPLOAD_STARTED: "document_upload_started",
  DOCUMENT_UPLOAD_COMPLETED: "document_upload_completed",
  DOCUMENT_ANALYSIS_STARTED: "document_analysis_started",
  DOCUMENT_ANALYSIS_COMPLETED: "document_analysis_completed",
  DOCUMENT_GENERATED: "document_generated",
  DOCUMENT_DOWNLOADED: "document_downloaded",

  // Lawyer discovery
  LAWYER_SEARCH_STARTED: "lawyer_search_started",
  LAWYER_SEARCH_COMPLETED: "lawyer_search_completed",
  LAWYER_FILTER_USED: "lawyer_filter_used",
  LAWYER_PROFILE_VIEWED: "lawyer_profile_viewed",
  APPOINTMENT_CTA_CLICKED: "appointment_cta_clicked",
  AI_MATCH_STARTED: "ai_match_started",
  AI_MATCH_COMPLETED: "ai_match_completed",
  AI_MATCH_LAWYER_SELECTED: "ai_match_lawyer_selected",

  // Appointment funnel
  BOOKING_ABANDONED: "booking_abandoned",
  APPOINTMENT_STARTED: "appointment_started",
  APPOINTMENT_SLOT_SELECTED: "appointment_slot_selected",
  APPOINTMENT_DETAILS_COMPLETED: "appointment_details_completed",
  APPOINTMENT_PAYMENT_STARTED: "appointment_payment_started",
  APPOINTMENT_BOOKED: "appointment_booked",
  APPOINTMENT_CANCELLED: "appointment_cancelled",

  // Consultation
  CONSULTATION_JOINED: "consultation_joined",
  CONSULTATION_COMPLETED: "consultation_completed",
  CONSULTATION_CANCELLED: "consultation_cancelled",
  CONSULTATION_ACTION_PERFORMED: "consultation_action_performed",
  CONSULTATION_DURATION_RECORDED: "consultation_duration_recorded",

  // Wallet / payment
  WALLET_BALANCE_VIEWED: "wallet_balance_viewed",
  WALLET_RECHARGE_CLICKED: "wallet_recharge_clicked",
  WALLET_WITHDRAW_CLICKED: "wallet_withdraw_clicked",

  // Profile
  PROFILE_PAGE_VIEWED: "profile_page_viewed",
  PROFILE_SAVED: "profile_saved",

  // Engagement
  FEATURE_DISCOVERED: "feature_discovered",
  DASHBOARD_VIEWED: "dashboard_viewed",
  ERROR_PAGE_VIEWED: "error_page_viewed",

  // Research console
  RESEARCH_QUERY_STARTED: "research_query_started",
  RESEARCH_QUERY_COMPLETED: "research_query_completed",
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];
