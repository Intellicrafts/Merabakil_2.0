# GA4 Admin Setup — MeraBakil

## 1. Create property

1. Go to [Google Analytics](https://analytics.google.com/) → Admin.
2. Create account **MeraBakil** (if needed).
3. Create GA4 property for **merabakil.in**.
4. Copy Measurement ID (`G-XXXXXXXXXX`).

## 2. Environment variables

In production `.env`:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GA_ENABLED=true
```

Keep `NEXT_PUBLIC_GA_ENABLED=false` in local/staging unless testing.

## 3. Recommended GA4 settings

| Setting | Value |
|---------|-------|
| Google signals | Off |
| Ads personalization | Off |
| Data retention | 14 months |
| Internal traffic filter | Add office/VPN IPs |

## 4. Custom dimensions (optional)

Register event parameters as custom dimensions if needed in reports:

- `page_type`, `account_type`, `signup_method`, `booking_source`, `cta_location`

## 5. UTM conventions

Use consistent campaign tags for launch channels:

```
?utm_source=twitter&utm_medium=social&utm_campaign=open_beta
?utm_source=linkedin&utm_medium=social&utm_campaign=advocate_outreach
```

UTM params are captured in session storage on first landing and attached to signup/login events.

## 6. DebugView verification

1. Install [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger) or use GA4 DebugView.
2. Click **Accept all** on the cookie banner (merabakil.in or localhost with env enabled).
3. Trigger: landing page → register → Saarthi message → lawyer book CTA.
4. Confirm events in DebugView within ~30 seconds.

## 7. Legal checklist

- [ ] Privacy Policy mentions GA4 (see `frontend/src/content/legal/privacy.md`)
- [ ] Cookie banner mentions GA4
- [ ] FAQ updated for analytics opt-in
- [ ] Consent version bumped after copy change
