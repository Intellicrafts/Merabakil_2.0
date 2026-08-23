# LiveKit setup — consultation room audio/video

Appointment-room calls use **LiveKit Cloud** for WebRTC. Chat works without LiveKit; audio/video requires three backend env vars.

## 1. LiveKit Cloud credentials

1. Create a project at [LiveKit Cloud](https://cloud.livekit.io).
2. **Do not** deploy a LiveKit Agent — that is for AI bots, not citizen↔lawyer calls.
3. From **Settings → Keys**, copy:
   - WebSocket URL → `LIVEKIT_URL` (e.g. `wss://your-project.livekit.cloud`)
   - API Key → `LIVEKIT_API_KEY`
   - API Secret → `LIVEKIT_API_SECRET`

## 2. Configure backend (local + production)

Add to **gitignored** root `.env` (never commit real secrets):

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxx
```

Production: set the same three values in your secret store (see `infrastructure/k8s/secret.example.yaml`).

Restart the **marketplace service** (port 8010):

```bash
make native          # local dev
make public          # public tunnel
# production: restart marketplace container/process
```

No frontend env vars or rebuild are required for LiveKit.

## 3. Verify

```bash
bash scripts/verify_livekit.sh
```

Or manually:

1. `curl -fsS http://127.0.0.1:8010/health`
2. Book an appointment, join `/appointments/{id}/room`
3. DevTools → `POST /svc/marketplace/api/v1/appointments/{id}/room-token`
4. Expect: `"configured": true`, `"mode": "livekit"`, non-null `url` and `token`

## 4. Manual E2E checklist

### LiveKit connect

| Step | Action |
|------|--------|
| 1 | Login as **citizen** (`citizen@legalos.in`) and **advocate** (`advocate@legalos.in`) in two browsers |
| 2 | Book/join appointment → open `/appointments/{id}/room` during the scheduled window |
| 3 | Confirm room header shows **Calls available** |
| 4 | Both users click **Call** → allow mic + camera |
| 5 | Confirm remote video/audio in the call stage |
| 6 | Test mute and camera-off (audio-only) |
| 7 | Repeat on public tunnel URL and `https://merabakil.in` (HTTPS required for camera/mic outside localhost) |

### Call notifications (ring / accept / decline)

| Step | Action |
|------|--------|
| 1 | Citizen in room → **Video call** → advocate sees **incoming overlay + ringtone** within ~1s (no reload) |
| 2 | Advocate **Accept** → both enter in-call dock; remote media connects |
| 3 | Citizen **Audio call** → advocate accepts → mic only (no camera until accepted) |
| 4 | Advocate **Decline** → citizen sees “Call declined” toast; both return to idle |
| 5 | Citizen **Cancel** during outgoing ring → advocate overlay dismisses |
| 6 | No answer for 45s → caller sees “No answer” toast |
| 7 | Advocate **not in room** (dashboard) → global incoming banner via inbox SSE; Accept navigates to room |
| 8 | **End** from in-call dock → tracks stop; `call_ended` clears UI for both |
| 9 | With SSE disconnected, join-state poll still shows `pending_incoming_call` overlay |

Automated UI coverage: `frontend/e2e/consultation-call.spec.ts` (mocked marketplace + LiveKit).

## Environments

| Environment | API path | LiveKit |
|-------------|----------|---------|
| Local | `/svc/marketplace` → `:8010` | Same cloud `wss://...` |
| Public tunnel | Same proxy via HTTPS tunnel | Same cloud URL |
| Production | Same on `merabakil.in` | Same cloud URL + server secrets |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "LiveKit is not configured" on Call | Add `LIVEKIT_*` to `.env`, restart marketplace |
| `configured: false` in room-token | Marketplace not restarted or env vars empty |
| Token OK but no connect | Check firewall; confirm `wss://` URL reachable from browser |
| Mic/camera blocked | Use HTTPS (production/tunnel); allow permissions in browser |
| Chat works, call does not | LiveKit issue only — chat uses SSE/polling, not LiveKit |

## Security

- Rotate API secrets if exposed (LiveKit Cloud → Settings → Keys).
- Do not commit `.env` or paste secrets into tracked files.
