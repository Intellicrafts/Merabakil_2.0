# GA4 Event Catalog — MeraBakil

Events using `object_action` naming. All payloads pass through `sanitizeParams()` — forbidden keys (PII, legal content) are stripped.

**Two sinks.** `track()` dispatches each event to GA4 *and* to Microsoft Clarity under the
same name, so the two tools cross-reference one-to-one. The gates differ by design:

- **GA4** fires only after an explicit "Accept all" (`readConsent()?.analytics === true`).
- **Clarity** follows the opt-out model — it fires unless the user has explicitly declined.

The allowlisted subset of each payload is also promoted to Clarity **custom tags**
(`CLARITY_TAG_KEYS`): `page_type`, `user_role`, `account_type`, `cta_location`, `cta_type`,
`booking_step`, `booking_status`, `consultation_mode`, `matter_category`,
`practice_area_category`, `signup_method`, `authentication_method`, `error_type`,
`feature_name`, and the three `utm_*` keys. See [CLARITY_SETUP.md](./CLARITY_SETUP.md).

## Marketing

| Event | Params | Trigger |
|-------|--------|---------|
| `landing_page_viewed` | `page_type`, UTM | `/` page view (consent granted) |
| `marketing_cta_clicked` | `cta_location`, `cta_type`, `destination` | Hero, nav, Saarthi spotlight CTAs |
| `faq_opened` | `page_type` | `/faq` page view |
| `legal_page_viewed` | `page_type`, `page_path` | `/privacy`, `/terms` |

## Auth & onboarding

| Event | Params | Trigger |
|-------|--------|---------|
| `signup_started` | `signup_method`, `account_type` | Register form submit |
| `signup_completed` | `signup_method`, `account_type`, UTM | Successful registration |
| `login_started` | `authentication_method` | Login form submit |
| `login_completed` | `authentication_method`, `account_type`, UTM | Successful login |
| `logout_completed` | — | Explicit sign out |
| `password_reset_started` | — | Forgot password submit |
| `password_reset_completed` | — | Reset password success |
| `onboarding_started` | `signup_method` | Google role picker load |
| `onboarding_completed` | `account_type` | Google onboarding complete |

## Saarthi AI

| Event | Params | Trigger |
|-------|--------|---------|
| `ai_chat_started` | `session_type`, `entry_point` | First message in conversation |
| `ai_message_sent` | `has_attachment`, `message_count_bucket`, `interaction_type` | User sends message |
| `ai_response_received` | `latency_bucket`, `has_citations`, `response_status` | Stream completes |
| `ai_session_completed` | `message_count_bucket`, `session_type` | New chat, switch chat, leave Saarthi |
| `ai_response_copied` | `interaction_type` | Copy answer toolbar |

## Documents

| Event | Params | Trigger |
|-------|--------|---------|
| `document_upload_started` | `file_type_category`, `file_size_bucket` | Upload begins |
| `document_upload_completed` | `processing_status` | Upload succeeds |
| `document_analysis_started` | `document_feature`, `entry_point` | Q&A submit on document detail |
| `document_analysis_completed` | `response_status`, `latency_bucket` | Q&A stream completes |

## Lawyer marketplace

| Event | Params | Trigger |
|-------|--------|---------|
| `lawyer_search_started` | `filter_type` | Search query changed |
| `lawyer_filter_used` | `filter_type`, `filter_applied`, `sort_type` | Filter/sort changed |
| `lawyer_profile_viewed` | `booking_source` | Profile opened |
| `appointment_cta_clicked` | `booking_source` | Book button clicked |

## Appointments

| Event | Params | Trigger |
|-------|--------|---------|
| `appointment_started` | `booking_source`, `consultation_type` | Booking dialog opens |
| `appointment_slot_selected` | `appointment_mode` | When step completed |
| `appointment_details_completed` | `booking_source` | Matter step completed |
| `appointment_payment_started` | `payment_type`, `price_bucket`, `booking_source` | Confirm booking submit |
| `appointment_booked` | `booking_source`, `appointment_mode`, `booking_status` | Booking confirmed |
| `appointment_cancelled` | `booking_status` | Cancel from appointments list/detail |
| `consultation_joined` | `consultation_mode` | Room token fetched |
| `consultation_completed` | `completion_status` | Leave consultation room |
| `consultation_cancelled` | `consultation_mode` | Cancel in-room call |

## Wallet

| Event | Params | Trigger |
|-------|--------|---------|
| `wallet_balance_viewed` | — | Wallet page load |
| `payment_started` | `payment_type`, `amount_bucket` | Top-up initiated |
| `payment_completed` | `payment_type`, `amount_bucket` | Top-up success |

## Engagement

| Event | Params | Trigger |
|-------|--------|---------|
| `feature_discovered` | `feature_name` | First visit to a major route per session |
| `dashboard_viewed` | — | Dashboard load |
| `error_page_viewed` | `error_type`, `page_path` | 404 page |

## Deferred (no routes yet)

Document in catalog only — do not instrument until features ship:

- `pricing_page_viewed`, `subscription_started`, `referral_shared`
- `blog_article_viewed`
