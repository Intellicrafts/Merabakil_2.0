# GA4 Admin Setup — MeraBakil

## 1. Create property

1. Go to [Google Analytics](https://analytics.google.com/) → Admin.
2. Create account **MeraBakil** (if needed).
3. Create GA4 property for **merabakil.in**.
4. Copy Measurement ID (`G-XXXXXXXXXX`).

## 2. Environment variables

In production `.env` (repo root, used by Docker Compose):

```bash
NEXT_PUBLIC_SITE_URL=https://merabakil.in
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GA_ENABLED=true
```

Keep `NEXT_PUBLIC_GA_ENABLED=false` in local dev unless testing analytics.

**Important:** Next.js bakes `NEXT_PUBLIC_*` at **frontend build time**. After changing these vars you must **rebuild** the frontend image:

```bash
docker compose -f infrastructure/docker-compose.prod.yml build frontend --no-cache
docker compose -f infrastructure/docker-compose.prod.yml up -d frontend
```

## 3. Local development

### Native frontend (`make dev-frontend`)

Set in repo root `.env` (already loaded by Next.js dev server):

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GA_ENABLED=true
```

Restart `npm run dev` after changing env vars.

### Docker local stack

```bash
make up          # starts postgres, auth, frontend, etc.
make migrate     # applies Alembic migrations (includes user_consents table)
make seed        # optional: seed roles + admin user
```

Ensure `.env` has GA vars before `make up` so the frontend image builds with analytics enabled.

## 4. Database migrations

Consent audit trail requires migration `0014_user_consents`:

```bash
make migrate
# or manually:
docker compose -f infrastructure/docker-compose.yml exec auth alembic upgrade head
```

## 5. How consent + tag loading works

- **gtag.js loads** when `NEXT_PUBLIC_GA_ENABLED=true` (Google can detect the tag).
- **Consent Mode v2** defaults to `analytics_storage: denied` until the user clicks **Accept all**.
- **Custom events** only fire after consent (`track()` checks `legalos.consent`).
- Do **not** paste the manual GTM snippet into `layout.tsx` — it bypasses consent.

## 6. Recommended GA4 settings

| Setting | Value |
|---------|-------|
| Google signals | Off |
| Ads personalization | Off |
| Data retention | 14 months |
| Internal traffic filter | Add office/VPN IPs |

## 7. Custom dimensions (optional)

Register event parameters as custom dimensions if needed in reports:

- `page_type`, `account_type`, `signup_method`, `booking_source`, `cta_location`

## 8. UTM conventions

```
?utm_source=twitter&utm_medium=social&utm_campaign=open_beta
?utm_source=linkedin&utm_medium=social&utm_campaign=advocate_outreach
```

## 9. DebugView verification

1. Deploy with GA env vars set and rebuild frontend.
2. Open site in incognito → click **Accept all**.
3. DevTools → Network → filter `gtag` → confirm `G-XXXXXXXXXX` loads.
4. GA4 → Admin → **DebugView** — walk signup → Saarthi → marketplace booking funnel.

Google's "Test your website" in Tag Manager may still show "not detected" if the crawler does not accept cookies; **DebugView** is the reliable check.

## 10. Legal checklist

- [x] Privacy Policy mentions GA4 (`frontend/src/content/legal/privacy.md`)
- [x] Cookie banner + Cookie settings link
- [x] FAQ updated for analytics opt-in
- [x] Consent version `2` in `frontend/src/lib/consent.ts`
