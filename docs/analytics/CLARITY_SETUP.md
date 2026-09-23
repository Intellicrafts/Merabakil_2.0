# Microsoft Clarity — Setup & Admin

Session replay, heatmaps, rage/dead-click detection. Runs alongside GA4 as a second sink
behind the same `track()` dispatcher, so every instrumented event appears in both tools
under the same name.

- **Project ID:** `ymwz3ie02u`
- **Dashboard:** https://clarity.microsoft.com/

---

## 1. Environment variables

`NEXT_PUBLIC_*` is **baked into the bundle at build time**. Changing the project ID
requires a frontend image rebuild, not just a container restart.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | Clarity project id. Empty ⇒ tag never loads. |
| `NEXT_PUBLIC_CLARITY_ENABLED` | `"true"` to load the tag. Anything else ⇒ hard off. |

Both must be present in **five** places or the tag ships dead:

1. `/.env` (and `/.env.example`)
2. `frontend/.env.local` (and `frontend/.env.local.example`) — dev
3. `infrastructure/docker/frontend.Dockerfile` — `ARG`/`ENV` pair **before** `RUN npm run build`
4. `infrastructure/docker-compose.prod.yml` — `build.args`
5. `infrastructure/docker-compose.yml` — `build.args`

---

## 2. Required dashboard configuration

These are **not** in code and must be set once by a project admin.

### Cookie consent — must be ON
**Settings → Cookie consent → require consent.**
Without this, Clarity ignores the `consentv2` signal the app sends and sets cookies
regardless of the user's banner choice. This is the single most important setting.

### Masking mode — Balanced
**Settings → Masking → Balanced** (the default). Masks numbers and email addresses
site-wide. Do **not** switch to Relaxed: free text would then be uploaded verbatim, and
this app renders privileged legal content.

Masking characters in playback: digits `▫`, letters `▪`, explicit mask `•`.

### Mask by element — backstop selectors
Code-level `data-clarity-mask` (see §4) is authoritative, but these selectors are a
second net that applies without a rebuild and covers anything the code pass misses.
**Settings → Masking → Mask by element**, all set to *Mask*:

```
.mv-user-bubble
.mv-assistant-surface
.mv-stream-plain
.mv-stream-complete
.mv-voice-overlay
.mv-doc-preview-insight
.mv-doc-preview
.mp-profile-field
.apt-room-header
```

> Masking changes affect new recordings only and can take up to an hour. They are never
> applied retroactively.

### Other
- **IP masking:** on.
- Clarity must not be used on sites targeting under-18s (Microsoft policy).

---

## 3. Consent model

Opt-out, mirroring GA4's posture for India (DPDP Act, not GDPR):

| User state | Behaviour |
|---|---|
| Undecided (banner not answered) | Tag loads. `consentv2` sent with `analytics_Storage: "denied"` → Clarity runs **cookieless**, one id per page view. Recording still happens. |
| "Accept all" | `consentv2` with `analytics_Storage: "granted"` → cookies set, sessions stitched across pages. |
| "Necessary only" | `consentv2` denied **and** `clarity("consent", false)` → existing cookies erased, tracking halts until consent is granted again. |

Both `ad_Storage` and `analytics_Storage` follow the single banner choice, matching
`updateConsentMode()` in `consent-bridge.ts` — MeraBakil runs Google Ads, so "Accept
all" must grant advertising signals too. If those signals are ever split apart in the
gtag mapping, split them in `clarityConsent()` as well.

Wiring: [`microsoft-clarity.tsx`](../../frontend/src/components/analytics/microsoft-clarity.tsx)
listens for the `legalos:consent-changed` window event from
[`consent.ts`](../../frontend/src/lib/consent.ts).

`CONSENT_VERSION` was bumped to **3** when Clarity was added, which re-prompts every
existing user. Bump it again for any future materially new disclosure.

---

## 4. Masking in code

`CLARITY_MASK` from [`clarity-mask.ts`](../../frontend/src/lib/analytics/clarity-mask.ts)
spreads `data-clarity-mask="true"` onto an element. The node and **all its descendants**
are never uploaded, and this overrides any dashboard setting.

```tsx
import { CLARITY_MASK } from "@/lib/analytics/clarity-mask";

<div {...CLARITY_MASK} className="mv-user-bubble">{message.content}</div>
```

Find every masked surface with `grep -rn CLARITY_MASK frontend/src`.

**Rule:** any new component that renders content a user typed, uploaded, or that names a
real person gets `CLARITY_MASK`. Chrome, navigation, buttons and marketing copy stay
unmasked — those are what the heatmaps are for.

Currently masked: AI chat bubbles and composer, conversation titles, voice-mode
transcript, document previews/passages/answers/library, drafted documents, case briefs
and case tables, wallet balance and transactions, OTP inputs, the verified-email echoes
(register **and** the `/ask` inline auth sheet), profile fields, the app-shell user menu,
consultation chat and counterparty names, appointment-list counterparty names, admin
user/wallet tables and live transcripts, notifications, research panels, and dashboard
recent-activity.

Deliberately unmasked: public lawyer marketplace listings (lawyer names are public
business data), marketing pages, legal guides and the `/ask` landing copy.

**Already handled by Clarity itself — no attribute needed:** every `<input>`,
`<textarea>` and `<select>` is masked in all modes and cannot be unmasked. That covers
the chat composer, the dashboard ask bar, the bar-council enrolment field and all
password fields.

---

## 5. Custom events and tags

Every event in [`events.ts`](../../frontend/src/lib/analytics/events.ts) is forwarded to
Clarity verbatim by `track()`, so GA4 and Clarity cross-reference one-to-one. See
[EVENT_CATALOG.md](./EVENT_CATALOG.md).

**Custom tags** (session filter dimensions) are a deliberately small allowlist —
`CLARITY_TAG_KEYS` in [`clarity.ts`](../../frontend/src/lib/analytics/clarity.ts):

`page_type`, `user_role`, `account_type`, `cta_location`, `cta_type`, `booking_step`,
`booking_status`, `consultation_mode`, `matter_category`, `practice_area_category`,
`signup_method`, `authentication_method`, `error_type`, `feature_name`, `utm_source`,
`utm_medium`, `utm_campaign`.

Values are already scrubbed by `sanitizeParams()` before they reach Clarity. Keep the
list small — every key added becomes a dropdown entry in the Filters UI.

**Identify:** `clarity("identify", <sha256 of user_id>, undefined, <pathname>, <role>)`,
re-sent on every route change. The friendly name is the **role**, never a name or email —
friendly names are stored and displayed in plaintext on the dashboard.

**Upgrade:** `CLARITY_UPGRADE_EVENTS` marks high-value sessions for retention under
Clarity's 100k recordings/project/day sampling: `appointment_started`,
`appointment_payment_started`, `appointment_booked`, `booking_abandoned`,
`error_page_viewed`.

---

## 6. Verification

Local, with `NEXT_PUBLIC_CLARITY_*` set in `frontend/.env.local` and `npm run dev`:

```js
typeof window.clarity === "function"                    // true
document.querySelectorAll('[data-clarity-mask]').length // > 0 on /mera-vakil, /wallet, /login
```

Network tab filtered to `clarity.ms`: `tag/ymwz3ie02u` returns 200 and collector beacons fire.

Consent: clear `localStorage["legalos.consent"]` → banner appears → "Accept all" sets
`_clck`/`_clsk` cookies; "Necessary only" erases them.

Dashboard (2–10 min lag): **Settings → Setup** shows "receiving data"; open a recording
and confirm chat, wallet figures and OTP fields render as `•`/`▪`/`▫`.

Production build — prove the build arg reached the image:

```bash
docker compose -f infrastructure/docker-compose.prod.yml build frontend
grep -r ymwz3ie02u frontend/.next/static | head
```

### Known post-deploy check

`next.config.mjs` sets `X-Frame-Options: DENY`. If heatmaps fail to render on the live
domain, that header is the likely cause. The fix is a **targeted**
`Content-Security-Policy: frame-ancestors` allowing `clarity.microsoft.com`, not
weakening the global header.

Appointment, case and document UUIDs appear in Clarity's captured URLs. They are opaque
identifiers, not PII; filter by the `page_type` tag rather than raw URL.
