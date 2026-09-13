# Launch Performance Checklist

Run after `npm run build && npm run start`:

```bash
# Automated Lighthouse (requires Chrome)
chmod +x scripts/lighthouse-audit.sh
./scripts/lighthouse-audit.sh http://localhost:3000

# Link checker (server must be running)
npm run check:links
```

**Targets (mobile):**

| Metric | Target |
|--------|--------|
| LCP | < 2.5s |
| CLS | < 0.1 |
| Performance score | ≥ 85 |
| Accessibility score | ≥ 90 |
| SEO score | ≥ 90 |

**Production env:**

```
NEXT_PUBLIC_SITE_URL=https://merabakil.in
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=merabakil.in
NEXT_PUBLIC_PLAUSIBLE_ENABLED=true
```
