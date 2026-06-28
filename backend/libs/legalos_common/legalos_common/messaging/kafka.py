"""Thin async Kafka producer/consumer wrappers around aiokafka."""

from __future__ import annotations

from collections.abc import AsyncIterator, Awaitable, Callable

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

from legalos_common.logging import get_logger
from legalos_common.messaging.events import EventEnvelope

logger = get_logger(__name__)


class KafkaEventProducer:
    def __init__(self, bootstrap_servers: str) -> None:
        self._bootstrap_servers = bootstrap_servers
        self._producer: AIOKafkaProducer | None = None

    async def start(self) -> None:
        if self._producer is None:
            self._producer = AIOKafkaProducer(bootstrap_servers=self._bootstrap_servers)
            await self._producer.start()
            logger.info("kafka_producer_started", servers=self._bootstrap_servers)

    async def stop(self) -> None:
        if self._producer is not None:
            await self._producer.stop()
            self._producer = None

    async def publish(self, topic: str, envelope: EventEnvelope, *, key: str | None = None) -> None:
        if self._producer is None:
            raise RuntimeError("Producer not started")
        await self._producer.send_and_wait(
            topic,
            value=envelope.to_json(),
            key=key.encode("utf-8") if key else None,
        )
        logger.info("event_published", topic=topic, event_type=envelope.event_type)


class KafkaEventConsumer:
    def __init__(self, bootstrap_servers: str, group_id: str, *topics: str) -> None:
        self._bootstrap_servers = bootstrap_servers
        self._group_id = group_id
        self._topics = topics
        self._consumer: AIOKafkaConsumer | None = None

    async def start(self) -> None:
        self._consumer = AIOKafkaConsumer(
            *self._topics,
            bootstrap_servers=self._bootstrap_servers,
            group_id=self._group_id,
            enable_auto_commit=False,
            auto_offset_reset="earliest",
        )
        await self._consumer.start()
        logger.info("kafka_consumer_started", group=self._group_id, topics=self._topics)

    async def stop(self) -> None:
        if self._consumer is not None:
            await self._consumer.stop()
            self._consumer = None

    async def messages(self) -> AsyncIterator[bytes]:
        if self._consumer is None:
            raise RuntimeError("Consumer not started")
        async for msg in self._consumer:
            yield msg.value
            await self._consumer.commit()

    async def run(self, handler: Callable[[bytes], Awaitable[None]]) -> None:
        async for value in self.messages():
            try:
                await handler(value)
            except Exception:
                logger.exception("event_handler_failed")
