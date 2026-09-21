#!/usr/bin/env bash
# Provision Google Cloud Storage for MeraBakil.
#
# Design (org enforces Domain Restricted Sharing → NO public buckets allowed):
#   - merabakil-documents : legal documents + extracted text + ingested files   (PRIVATE)
#   - merabakil-public    : all profile photos / avatars (avatars/{user_id}.…)  (PRIVATE)
#   Browsers get objects via short-lived V4 SIGNED URLs minted by the backend.
#
# Auth: backend runs as the merabakil-storage service account attached to the
# GCE VM (Application Default Credentials, no key files). Keyless signed-URL
# signing uses IAM SignBlob, so the SA has serviceAccountTokenCreator on itself.
#
# Idempotent — safe to re-run.
set -euo pipefail

PROJECT="${PROJECT:-merabakil}"
REGION="${REGION:-asia-south1}"
PRIVATE_BUCKET="${PRIVATE_BUCKET:-merabakil-documents}"
PUBLIC_BUCKET="${PUBLIC_BUCKET:-merabakil-public}"   # "public" by role (avatars), still a private bucket served via signed URLs
SA_NAME="${SA_NAME:-merabakil-storage}"
SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"

echo "Project=${PROJECT} Region=${REGION}  Private=${PRIVATE_BUCKET}  Avatars=${PUBLIC_BUCKET}  SA=${SA_EMAIL}"

# 0. APIs.
gcloud services enable storage.googleapis.com iamcredentials.googleapis.com --project="${PROJECT}"

# 1. Buckets — BOTH private (uniform access, public-access-prevention enforced).
for B in "${PRIVATE_BUCKET}" "${PUBLIC_BUCKET}"; do
  if ! gcloud storage buckets describe "gs://${B}" --project="${PROJECT}" >/dev/null 2>&1; then
    gcloud storage buckets create "gs://${B}" --project="${PROJECT}" --location="${REGION}" \
      --uniform-bucket-level-access --public-access-prevention
  else
    gcloud storage buckets update "gs://${B}" --project="${PROJECT}" --public-access-prevention
  fi
done

# 2. Service account.
if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SA_NAME}" --project="${PROJECT}" \
    --display-name="MeraBakil object storage"
fi

# 3. Bucket IAM — SA can read/write/delete objects in both buckets.
gcloud storage buckets add-iam-policy-binding "gs://${PRIVATE_BUCKET}" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/storage.objectAdmin"
gcloud storage buckets add-iam-policy-binding "gs://${PUBLIC_BUCKET}" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/storage.objectAdmin"

# 4. Keyless signed-URL signing: SA may sign blobs as itself.
gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" --project="${PROJECT}" \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/iam.serviceAccountTokenCreator"

# 5. Swapping the VM SA replaces the default compute SA — keep the ops agent working.
gcloud projects add-iam-policy-binding "${PROJECT}" --condition=None \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/logging.logWriter"
gcloud projects add-iam-policy-binding "${PROJECT}" --condition=None \
  --member="serviceAccount:${SA_EMAIL}" --role="roles/monitoring.metricWriter"

echo
echo "GCP storage setup complete."
echo
echo "REMAINING — run in the code-deploy maintenance window (brief VM outage):"
echo "  gcloud compute instances stop  merabakil-vm --zone asia-south1-a"
echo "  gcloud compute instances set-service-account merabakil-vm --zone asia-south1-a \\"
echo "     --service-account=${SA_EMAIL} --scopes=cloud-platform"
echo "  gcloud compute instances start merabakil-vm --zone asia-south1-a"
echo
echo "App env: GCS_PROJECT=${PROJECT}  GCS_BUCKET=${PRIVATE_BUCKET}  GCS_PUBLIC_BUCKET=${PUBLIC_BUCKET}"
