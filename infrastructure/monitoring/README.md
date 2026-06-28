# Monitoring (Phase 1 baseline)

- `otel-collector-config.yaml` - OpenTelemetry Collector receiving OTLP traces/metrics
  from the services (enabled when `OTEL_SDK_DISABLED=false`) and exposing Prometheus
  metrics on `:8889`.
- `prometheus.yml` - scrape config for the collector and service `/metrics` endpoints.
- `grafana-dashboard.json` - starter dashboard (request rate, p95 latency, 5xx).

Services emit structured JSON logs (stdout) suitable for Loki/ELK ingestion and are
instrumented via `legalos_common.telemetry.setup_telemetry`.

## Phase 3 hardening backlog

- Per-service RED/USE dashboards, alerting rules, SLOs.
- Trace sampling + exemplars, log/trace correlation.
- Datastore exporters (Postgres, Qdrant, OpenSearch, Kafka, Neo4j).
