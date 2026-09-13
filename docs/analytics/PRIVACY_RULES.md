# Analytics Privacy Rules — MeraBakil GA4

## Principles

1. **Consent first** — GA4 loads only after `legalos.consent.analytics === true`. Consent Mode v2 defaults deny all advertising/analytics storage until update.
2. **Client-side only** — No Measurement Protocol, no server-side GA hits.
3. **No PII** — Never send email, name, phone, passwords, tokens, or legal content.
4. **Hashed user ID** — `user_id` in GA4 is SHA-256 of internal UUID, set only when consent granted.
5. **Allowlist params** — Unknown keys are dropped in `sanitizeParams()`.

## Blocked parameter keys

See `frontend/src/lib/analytics/blocklist.ts`. Includes: `email`, `question`, `prompt`, `response`, `message`, `matter_summary`, `document_text`, `lawyer_name`, etc.

## DPDP alignment

- Analytics is optional; essential cookies/storage work without consent.
- Privacy Policy names Google Analytics 4.
- Consent version bump (`CONSENT_VERSION=2`) re-prompts users after GA4 disclosure update.
- Users may withdraw consent via browser storage clear; banner reappears on next visit if no valid consent record.

## GA4 property settings (admin)

- Disable Google signals and ad personalization (enforced in gtag config).
- Enable IP anonymization (`anonymize_ip: true`).
- Exclude internal office IPs in GA4 admin.
- Data retention: 14 months recommended for beta.

## Validation

Use GA4 **DebugView** with `NEXT_PUBLIC_GA_ENABLED=true` and a test Measurement ID. Confirm:

- No gtag script before consent
- Events appear only after "Accept all"
- No forbidden params in event payloads
