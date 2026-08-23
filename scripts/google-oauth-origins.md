# Google OAuth — Authorized JavaScript origins

GIS / One Tap uses **JavaScript origins only** (no redirect URIs).  
Use the **same Client ID** everywhere.

## Required origins (add ALL that apply)

| Origin | When |
|--------|------|
| `http://localhost:3000` | Local dev (`make native`) — **use this URL, not 127.0.0.1** |
| `http://127.0.0.1:3000` | Optional backup (app auto-redirects to localhost) |
| `https://merabakil.in` | Production |
| `https://www.merabakil.in` | Production if www is used |
| `https://YOUR-NAME.trycloudflare.com` | Public tunnel (`make public`) — add each new tunnel URL |

## Google Cloud Console steps

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. Open your **Web client** OAuth 2.0 Client ID
3. Under **Authorized JavaScript origins**, add every origin from the table above
4. **OAuth consent screen** → add **Test users** (required while app is in *Testing* mode)
5. Leave **Authorized redirect URIs** empty for GIS credential flow

## Env vars

```bash
# Root .env (auth service)
GOOGLE_OAUTH_CLIENT_ID=your-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-secret

# frontend/.env.local
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
NEXT_PUBLIC_AUTH_API_URL=/svc/auth
# ... other /svc/* URLs (see .env.local.example)
```

## Fix: Error 400 origin_mismatch

Google compares the browser origin **exactly** (scheme + host + port).

- Open **`http://localhost:3000/login`** — not `127.0.0.1` (middleware redirects automatically)
- For **`make public`**: copy the `https://….trycloudflare.com` URL from the terminal and add it to JavaScript origins
- For **production**: ensure `https://merabakil.in` (and `www` if used) are listed

## Production build

```bash
cp frontend/.env.production.example frontend/.env.production.local
npm run build && npm start
```

Ensure the auth service on the server also has `GOOGLE_OAUTH_CLIENT_ID` set.
