# Analytics Privacy Rules — MeraBakil (GA4 + Microsoft Clarity)

## Principles

1. **Consent first** — GA4 loads only after `legalos.consent.analytics === true`. Consent Mode v2 defaults deny all advertising/analytics storage until update.
2. **Client-side only** — No Measurement Protocol, no server-side GA hits.
3. **No PII** — Never send email, name, phone, passwords, tokens, or legal content.
4. **Hashed user ID** — `user_id` in GA4 is SHA-256 of internal UUID, set only when consent granted.
5. **Allowlist params** — Unknown keys are dropped in `sanitizeParams()`. The same sanitized
   payload feeds Clarity custom tags, so tags inherit the allowlist.
6. **Mask the DOM** — Clarity records the DOM. Any component rendering content a user typed,
   uploaded, or that names a real person **must** carry `CLARITY_MASK`
   (`frontend/src/lib/analytics/clarity-mask.ts`). Masked subtrees are never sent over the
   wire. Inputs, textareas and selects are masked by Clarity itself in all modes.
7. **Role, not identity** — Clarity's friendly name is displayed in plaintext on the
   dashboard, so it carries the user's role only. The custom id is the SHA-256 hash.

## Blocked parameter keys

See `frontend/src/lib/analytics/blocklist.ts`. Includes: `email`, `question`, `prompt`, `response`, `message`, `matter_summary`, `document_text`, `lawyer_name`, etc.

## DPDP alignment

- Analytics is optional; essential cookies/storage work without consent.
- Privacy Policy names Google Analytics 4 **and** Microsoft Clarity.
- Consent version bump (`CONSENT_VERSION=3`) re-prompts users after the Microsoft Clarity disclosure.
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

## Microsoft Clarity

Full admin and masking reference: [CLARITY_SETUP.md](./CLARITY_SETUP.md).

- Opt-out model: the tag loads for undecided visitors but runs **cookieless** until consent.
- "Necessary only" sends `consentv2` denied and calls `clarity("consent", false)`, which
  erases Clarity's cookies.
- `ad_Storage` is always denied.
- Masking mode stays on **Balanced**; never Relaxed.
- Clarity's project setting **Settings → Cookie consent** must be ON, or the `consentv2`
  signal is ignored and cookies are set regardless of the banner choice.
