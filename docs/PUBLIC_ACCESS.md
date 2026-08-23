# Access Legal OS from anywhere (global / mobile)

Your stack runs several services (frontend `:3000`, auth `:8001`, marketplace `:8010`, etc.). A phone on mobile data **cannot** use `localhost:8001` — that points at the phone itself, not your PC.

The supported approach is:

1. **One public HTTPS URL** (Cloudflare Tunnel — no router port forwarding)
2. **Same-origin API proxy** (`/svc/*` via Next.js) so login, marketplace, SSE, and rooms work on any device

## Quick start (recommended)

**One command** — backends + frontend + tunnel:

```bash
make public
```

You'll get a URL like `https://something.trycloudflare.com`. Open it on any device; register, login, marketplace, and research all work through the same URL.

**Local-only dev** (no tunnel):

```bash
make native
```

**Already running `make native`?** Add tunnel in a second terminal:

```bash
make public-tunnel
```

Restore local URLs:

```bash
make public-restore
```

## Why register failed on trycloudflare.com

The Cloudflare URL only exposes **port 3000**. Auth runs on `:8001` locally — remote browsers cannot reach `localhost:8001`.

Fix: the app now routes API calls through **same-origin proxy** paths:

| Service | Proxy path | Local port |
|---------|------------|------------|
| Auth | `/svc/auth` | 8001 |
| Search | `/svc/search` | 8003 |
| Research | `/svc/research` | 8004 |
| Marketplace | `/svc/marketplace` | 8010 |

When you open a `*.trycloudflare.com` URL, the browser automatically uses `/svc/*` (no manual env edit needed).

## Stable URL (same link every time)

Quick tunnels (`trycloudflare.com`) change on each restart. For a **fixed domain**:

1. Add your domain to [Cloudflare](https://dash.cloudflare.com)
2. Follow [Create a local tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/)
3. Use `scripts/cloudflared.config.example.yml` as a template
4. Run `make public` or `make native`, then `cloudflared tunnel --config scripts/cloudflared.config.yml run`

## How it works

| Piece | Role |
|-------|------|
| `frontend/next.config.mjs` | Proxies `/svc/auth` → `:8001`, `/svc/marketplace` → `:8010`, etc. |
| `frontend/.env.public.example` | Sets `NEXT_PUBLIC_*_API_URL=/svc/...` for the browser |
| `scripts/expose_public.sh` | Applies env, restarts Next.js on `0.0.0.0:3000`, runs `cloudflared` |

Only **port 3000** is exposed to the internet. Backend ports stay on your machine.

## Other methods (comparison)

| Method | Pros | Cons |
|--------|------|------|
| **Cloudflare Tunnel** (`make public`) | Free HTTPS, no router config, works behind NAT | URL changes each run (unless you add a named Cloudflare tunnel + domain) |
| **Router port forwarding** | Fixed IP/port if you have static IP | Must forward many ports OR still need a reverse proxy; no HTTPS unless you add certs; security risk |
| **ngrok** | Very easy | Free tier has session limits; multiple tunnels needed without proxy |
| **Tailscale** | Private mesh VPN | Peers need Tailscale; “Funnel” for public access is extra setup |

For this multi-service app, **Cloudflare Tunnel + Next.js proxy** is the most reliable option without Docker/nginx.

## Permanent domain (optional)

For a stable URL (e.g. `legalos.yourdomain.com`):

1. Add your domain to [Cloudflare](https://dash.cloudflare.com)
2. Create a [named tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-local-tunnel/)
3. Point DNS `CNAME` to the tunnel
4. Route traffic to `http://localhost:3000`

Keep using the `/svc/*` proxy env from `frontend/.env.public.example`.

## Troubleshooting

- **Blank page / API errors on phone** — Run `make public` (not raw port-forward of 3000 alone). Confirm `frontend/.env.local` uses `/svc/...` URLs.
- **Tunnel URL never appears** — Check `data/.public-tunnel.log`; install `cloudflared` manually if download failed.
- **502 on first visit** — Wait for Next.js compile (~10–30s after tunnel starts).
- **LiveKit video** — Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` in root `.env` (LiveKit Cloud). See [scripts/livekit-setup.md](../scripts/livekit-setup.md). Same cloud URL works locally and through the tunnel; no frontend env vars needed.

## Security notes

- Change default passwords before sharing widely (`ChangeMe!2026`).
- Quick tunnels get a random public URL — treat it like a temporary demo link.
- For production, use a named tunnel, strong secrets, and rate limiting.
