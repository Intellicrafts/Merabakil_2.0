# Email Deliverability — MeraBakil

This guide covers Google Workspace SMTP setup and DNS authentication so OTP,
password-reset, and appointment emails land in the **Primary** inbox instead of Spam.

## 1. Google Workspace sender mailbox

Create a dedicated mailbox (recommended):

- `notifications@merabakil.in` — transactional mail (OTP, appointments)
- Or use `noreply@merabakil.in` as an alias on that mailbox

Enable 2FA on the account, then create an **App Password**:

1. Google Account → Security → 2-Step Verification → App passwords
2. Generate a password for "Mail" on "Other (Custom name)" → `MeraBakil SMTP`

## 2. Environment variables

Set these in `.env` (auth service and lawyer-marketplace both send email):

```env
SMTP_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=notifications@merabakil.in
SMTP_PASSWORD=<16-char Google App Password>
SMTP_FROM_EMAIL=notifications@merabakil.in
SMTP_FROM_NAME=MeraBakil
SMTP_REPLY_TO=admin@merabakil.in
FRONTEND_URL=https://merabakil.in
EMAIL_ASSET_BASE_URL=https://merabakil.in
```

Email template images (logo mark and icons) are bundled inside `legalos_common/email/assets/` and embedded inline in HTML, so they render reliably without depending on frontend static hosting.

To regenerate source PNGs after brand changes:

```bash
cd frontend && npm run email:generate
cp frontend/public/brand/mark-light.png backend/libs/legalos_common/legalos_common/email/assets/
cp frontend/public/email/icons/*.png backend/libs/legalos_common/legalos_common/email/assets/icons/
```

**Critical:** `SMTP_FROM_EMAIL` must match the authenticated Workspace mailbox
(or an approved send-as alias). Using `noreply@merabakil.in` in From while
authenticating as a personal Gmail address will cause spam placement or silent failures.

## 3. DNS records (domain registrar)

Add/update these for `merabakil.in`:

### SPF (TXT on root domain)

```
v=spf1 include:_spf.google.com ~all
```

### DKIM

1. Google Admin Console → Apps → Google Workspace → Gmail → Authenticate email
2. Generate DKIM key for `merabakil.in`
3. Add the TXT record Google provides at the specified host (e.g. `google._domainkey`)

### DMARC (TXT on `_dmarc.merabakil.in`)

```
v=DMARC1; p=quarantine; rua=mailto:dmarc@merabakil.in; pct=100; adkim=s; aspf=s
```

Start with `p=none` for monitoring if needed, then move to `quarantine` or `reject`.

## 4. Verify configuration

### Quick SMTP test

```bash
.venv/bin/python backend/scripts/test_smtp.py you@gmail.com
```

### Gmail "Show original"

Send a test OTP from register/login, open the message in Gmail → **Show original**:

- `SPF: PASS`
- `DKIM: PASS`
- `DMARC: PASS`

### mail-tester.com (optional)

Send the test script output to the address mail-tester provides. Target score ≥ 9/10.

## 5. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| No email at all | `SMTP_ENABLED=false` or empty credentials | Set env vars, restart auth service |
| API says "Unable to send verification email" | SMTP auth failure or network | Check App Password, port 587, firewall |
| Lands in Spam | SPF/DKIM/DMARC missing or From mismatch | Complete DNS setup; align From with Username |
| OTP not received in production | SMTP not configured or blocked | Set production SMTP env vars and verify DNS |

## 6. Email types sent by MeraBakil

| Email | Service | Trigger |
|-------|---------|---------|
| Email verification OTP | auth | Register step 1 |
| Login OTP | auth | Login with email code |
| Password reset | auth | Forgot password |
| Welcome | auth | After registration |
| Booking / appointment lifecycle | lawyer-marketplace | Consultation events |

All use branded HTML templates from `legalos_common/email/`.
