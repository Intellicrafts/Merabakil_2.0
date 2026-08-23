# MeraBakil — Deployment Guide (GCP)

Stack: GCE VM · Docker Compose · PostgreSQL · Redis · Nginx (HTTPS)

---

## Prerequisites

Before starting, have these ready:

| What | Where to get it |
|---|---|
| Google Cloud account with billing enabled | console.cloud.google.com |
| `gcloud` CLI installed locally | [Install guide](https://cloud.google.com/sdk/docs/install) |
| Qdrant Cloud cluster URL + API key | cloud.qdrant.io |
| Google AI Studio API key | aistudio.google.com |
| GCS bucket + HMAC keys | see step below |

---

## Part 1 — One-time GCP setup (run locally)

### 1.1 Create VM

```bash
gcloud config set project YOUR_PROJECT_ID

gcloud compute instances create merabakil-vm \
  --zone=asia-south1-a \
  --machine-type=e2-standard-2 \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=40GB \
  --boot-disk-type=pd-balanced \
  --tags=http-server,https-server
```

### 1.2 Reserve a static IP and attach it

```bash
gcloud compute addresses create merabakil-ip --region=asia-south1

STATIC_IP=$(gcloud compute addresses describe merabakil-ip \
  --region=asia-south1 --format='value(address)')

gcloud compute instances delete-access-config merabakil-vm \
  --zone=asia-south1-a --access-config-name="External NAT"

gcloud compute instances add-access-config merabakil-vm \
  --zone=asia-south1-a --address="$STATIC_IP"

echo "Static IP: $STATIC_IP"
```

### 1.3 Open firewall ports

```bash
gcloud compute firewall-rules create allow-http-https \
  --allow=tcp:80,tcp:443 \
  --target-tags=http-server,https-server \
  --source-ranges=0.0.0.0/0
```

### 1.4 Add your SSH key to the VM

```bash
# Generate a key pair (skip if you already have one)
ssh-keygen -t ed25519 -f ~/.ssh/merabakil_gce -C "merabakil-deploy"

# Add the public key to the VM
gcloud compute instances add-metadata merabakil-vm \
  --zone=asia-south1-a \
  --metadata="ssh-keys=ubuntu:$(cat ~/.ssh/merabakil_gce.pub)"
```

### 1.5 Create GCS bucket + HMAC keys

```bash
# Create bucket in Mumbai
gsutil mb -l asia-south1 gs://merabakil-documents

# Create service account
gcloud iam service-accounts create merabakil-app --display-name="MeraBakil App"

# Grant storage access
gsutil iam ch \
  serviceAccount:merabakil-app@YOUR_PROJECT_ID.iam.gserviceaccount.com:objectAdmin \
  gs://merabakil-documents

# Create HMAC keys — save the output (Access Key + Secret)
gsutil hmac create merabakil-app@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

---

## Part 2 — First deploy (SSH into the VM)

### 2.1 SSH into the VM

```bash
ssh -i ~/.ssh/merabakil_gce ubuntu@STATIC_IP
```

### 2.2 Bootstrap the VM (installs Docker, git, Certbot)

```bash
curl -fsSL https://raw.githubusercontent.com/Intellicrafts/Merabakil_2.0/main/scripts/setup-server.sh | sudo bash
```

**Log out and back in** after this so the `docker` group takes effect:

```bash
exit
ssh -i ~/.ssh/merabakil_gce ubuntu@STATIC_IP
```

### 2.3 Clone the repo

```bash
git clone https://github.com/Intellicrafts/Merabakil_2.0.git /opt/merabakil/repo
```

### 2.4 Place your `.env` file

**Option A — copy it directly into the repo (simplest):**

```bash
cp /opt/merabakil/repo/infrastructure/env.gcp.example \
   /opt/merabakil/repo/infrastructure/.env
nano /opt/merabakil/repo/infrastructure/.env
```

**Option B — keep it outside the repo and symlink:**

```bash
cp /opt/merabakil/repo/infrastructure/env.gcp.example /opt/merabakil/.env
nano /opt/merabakil/.env
ln -s /opt/merabakil/.env /opt/merabakil/repo/infrastructure/.env
```

Either way works. Fill in every `<CHANGE ME>` value:

**Required — generate fresh secrets:**
```bash
openssl rand -hex 32          # → JWT_SECRET_KEY
openssl rand -hex 64          # → FIELD_ENCRYPTION_KEY
openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24   # → POSTGRES_PASSWORD
```

**Required — from your services:**
| Variable | Where to get it |
|---|---|
| `QDRANT_API_KEY` | Qdrant Cloud dashboard |
| `LLM_API_KEY` / `EMBEDDING_API_KEY` | Google AI Studio (aistudio.google.com) |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | HMAC keys from step 1.5 |
| `MARKETPLACE_DATABASE_URL` | Replace `<POSTGRES_PASSWORD>` with the password you set above |

**Optional — leave empty to disable the feature:**
| Variable | Feature |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | "Sign in with Google" button |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Video/audio in appointment rooms |
| `TAVILY_API_KEY` | Web search in AI research (falls back to DuckDuckGo) |

### 2.5 Deploy

```bash
/opt/merabakil/repo/scripts/deploy.sh
```

This will:
- Generate a self-signed SSL certificate (enables voicebot + mic access)
- Build and start all 8 containers
- Seed the database (roles, permissions, admin user — runs automatically)

Wait ~3 minutes for all containers to become healthy.

### 2.6 Verify

```bash
# All 8 containers should show "healthy"
docker compose -f /opt/merabakil/repo/infrastructure/docker-compose.prod.yml ps

# Test the app
curl -sk https://localhost/svc/auth/health
# Expected: {"status":"ok","service":"auth-service"}
```

Open `https://STATIC_IP` in your browser. Accept the self-signed cert warning (click Advanced → Proceed). The app is live.

---

## Part 3 — Updating (re-deploy after code changes)

Just run the deploy script again:

```bash
/opt/merabakil/repo/scripts/deploy.sh
```

It pulls the latest code and restarts changed containers automatically.

---

## Part 4 — Connect your domain + proper SSL (optional)

Once you're ready to use `merabakil.in`:

### 4.1 Set up Cloud DNS

```bash
# Run locally
gcloud dns managed-zones create merabakil-zone \
  --dns-name=merabakil.in. \
  --description="MeraBakil production"

# Get the 4 nameserver records
gcloud dns managed-zones describe merabakil-zone --format='value(nameServers)'

# Add A records
gcloud dns record-sets create merabakil.in. \
  --zone=merabakil-zone --type=A --ttl=300 --rrdatas="$STATIC_IP"
gcloud dns record-sets create www.merabakil.in. \
  --zone=merabakil-zone --type=A --ttl=300 --rrdatas="$STATIC_IP"
```

Go to your domain registrar and update the nameservers to the 4 values from the command above (ns-cloud-e1 through e4.googledomains.com).

Wait for DNS to propagate (5 min – 48 hours).

### 4.2 Get a real SSL certificate (Let's Encrypt)

On the VM:

```bash
# Stop nginx so Certbot can bind port 80
docker compose -f /opt/merabakil/repo/infrastructure/docker-compose.prod.yml stop nginx

# Get certificate
sudo certbot certonly --standalone -d merabakil.in -d www.merabakil.in

# Restart stack with the production nginx config (uses Let's Encrypt cert)
docker compose \
  -f /opt/merabakil/repo/infrastructure/docker-compose.prod.yml \
  --env-file /opt/merabakil/repo/infrastructure/.env \
  up -d nginx
```

The production nginx config (`infrastructure/nginx/nginx.conf`) is already configured for Let's Encrypt at `/etc/letsencrypt`.

---

## Container reference

| Container | Role | Port (internal) |
|---|---|---|
| `postgres` | Database | 5432 |
| `redis` | Cache / sessions | 6379 |
| `auth` | Auth, users, cases, documents | 8000 |
| `search` | Legal search (Qdrant) | 8000 |
| `research` | AI research + voicebot WebSocket | 8000 |
| `marketplace` | Lawyer listings, appointments | 8000 |
| `frontend` | Next.js app | 3000 |
| `nginx` | HTTPS reverse proxy | 80, 443 |

## Useful commands

```bash
# View logs for a specific service
docker compose -f /opt/merabakil/repo/infrastructure/docker-compose.prod.yml logs -f research

# Restart a single service
docker compose -f /opt/merabakil/repo/infrastructure/docker-compose.prod.yml restart marketplace

# Open a database shell
docker compose -f /opt/merabakil/repo/infrastructure/docker-compose.prod.yml exec postgres psql -U legalos -d legalos

# Re-run seed (safe — idempotent)
docker compose -f /opt/merabakil/repo/infrastructure/docker-compose.prod.yml exec auth python -m app.seed
```
