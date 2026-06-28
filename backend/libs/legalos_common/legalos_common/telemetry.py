"""OpenTelemetry bootstrap. No-op when OTEL_SDK_DISABLED is true."""

from __future__ import annotations

from fastapi import FastAPI

from legalos_common.config import CommonSettings
from legalos_common.logging import get_logger

logger = get_logger(__name__)


def setup_telemetry(app: FastAPI, settings: CommonSettings) -> None:
    if settings.otel_sdk_disabled:
        logger.info("otel_disabled", service=settings.service_name)
        return
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.sdk.resources import SERVICE_NAME, Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor

        provider = TracerProvider(
            resource=Resource.create({SERVICE_NAME: settings.service_name})
        )
        provider.add_span_processor(
            BatchSpanProcessor(
                OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint, insecure=True)
            )
        )
        trace.set_tracer_provider(provider)
        FastAPIInstrumentor.instrument_app(app)
        logger.info("otel_enabled", endpoint=settings.otel_exporter_otlp_endpoint)
    except Exception:
        logger.exception("otel_setup_failed")
