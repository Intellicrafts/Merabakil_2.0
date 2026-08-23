# UI Performance Optimization — Validation Notes

Run these checks locally after `cd frontend && npm install`:

## Build & bundle

```bash
npm run build
npm run analyze   # opens bundle analyzer when ANALYZE=true
```

Compare First Load JS for `/dashboard`, `/courtroom`, `/mera-vakil`, `/lawyer-marketplace`.

## Static analysis

```bash
npm run typecheck
npm run lint
```

## E2E (stack must be running: `make up && make seed`)

```bash
npm run test:e2e
npm run test:e2e:mobile
```

## Changes applied

- Streaming chat: memoized `MessageBubble`, O(n) regenerate lookup, RAF-batched research tokens
- Polling: debounced lawyer search (300ms), isolated 1Hz clocks, SSE-only message sync in appointment room
- Code splitting: dynamic imports for courtroom panels, mera-vakil overlays, appointment room, landing demos
- PDF export: lazy-loaded `html2canvas` / `jspdf` in courtroom PDF builder
- Mobile: viewport metadata, reduced blur on ≤768px, throttled RAF on match animation and voice bot
- Loading UX: skeletons for mera-vakil hydration, courtroom init, marketplace appointments, appointment room connect

## Lighthouse (manual)

Chrome DevTools → Lighthouse → Mobile → `/dashboard` and `/mera-vakil`. Target Performance ≥ 70 on dashboard.
