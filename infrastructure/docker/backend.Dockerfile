# Generic build for any AI Legal OS Python microservice.
# Build context MUST be the repository root.
#   docker build -f infrastructure/docker/backend.Dockerfile \
#     --build-arg SERVICE_PATH=services/auth --build-arg INSTALL_ORCHESTRATOR=false \
#     -t legalos-auth .
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Minimal system deps; optional OCR tooling is included for the ingestion image.
ARG WITH_OCR=false
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && if [ "$WITH_OCR" = "true" ]; then apt-get install -y --no-install-recommends tesseract-ocr poppler-utils; fi \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Shared library (installs the bulk of transitive deps).
COPY backend/libs/legalos_common /app/libs/legalos_common
RUN pip install ./libs/legalos_common

# 2. Orchestrator (only needed by the research service).
ARG INSTALL_ORCHESTRATOR=false
COPY backend/orchestrator /app/orchestrator
RUN if [ "$INSTALL_ORCHESTRATOR" = "true" ]; then pip install ./orchestrator; fi

# 3. The target service. pip sees legalos-common/orchestrator already satisfied.
ARG SERVICE_PATH
COPY backend/${SERVICE_PATH} /app/service
COPY data/corpus_registry.yaml /app/data/corpus_registry.yaml
RUN pip install ./service

COPY backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

WORKDIR /app/service
ENV PORT=8000
EXPOSE 8000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
