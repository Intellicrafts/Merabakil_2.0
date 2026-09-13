"""Redis Streams consumer — processes user domain events for wallet initialisation."""
from __future__ import annotations

import asyncio
import logging
import uuid
from decimal import Decimal

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

_STREAM = "legalos:events:user"
_GROUP = "billing-wallet-init"
_CONSUMER = "billing-1"
_DLQ = "legalos:events:user:dlq"
_MAX_RETRIES = 3
_BLOCK_MS = 2_000          # how long XREADGROUP waits for new messages
_STUCK_IDLE_MS = 300_000   # 5 min — reclaim messages stuck in the PEL


class UserEventConsumer:
    """
    Background task that reads user.registered events and creates wallets.

    Flow:
      1. On every iteration, read up to 10 new messages with XREADGROUP.
      2. Every 30 iterations (~60 s), scan the PEL for messages idle > 5 min
         and reclaim them so they are retried even if the previous attempt
         crashed mid-flight.
      3. After MAX_RETRIES unsuccessful deliveries, move the message to the DLQ
         stream and ACK it so it leaves the PEL.
      4. On success, ACK the message immediately.
      5. On transient failure, do NOT ACK — the message stays in the PEL and
         will be reclaimed on the next recovery pass.
    """

    def __init__(
        self,
        redis_url: str,
        welcome_credit: Decimal,
        session_manager,
    ) -> None:
        self._redis_url = redis_url
        self._welcome_credit = welcome_credit
        self._session_manager = session_manager
        self._task: asyncio.Task | None = None

    # ── Lifecycle ──────────────────────────────────────────────────────────── #

    async def start(self) -> None:
        self._task = asyncio.create_task(self._run(), name="user-event-consumer")
        logger.info("user_event_consumer_started stream=%s group=%s", _STREAM, _GROUP)

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("user_event_consumer_stopped")

    # ── Main loop ──────────────────────────────────────────────────────────── #

    async def _run(self) -> None:
        r = aioredis.from_url(self._redis_url, decode_responses=True)
        try:
            await self._ensure_group(r)
            iteration = 0
            while True:
                if iteration % 30 == 0:
                    await self._recover_pending(r)
                await self._read_new(r)
                iteration += 1
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("user_event_consumer_crashed — will not restart automatically")
        finally:
            await r.aclose()

    async def _ensure_group(self, r: aioredis.Redis) -> None:
        try:
            # id="0" → deliver all existing messages on first run; no messages
            # are lost if the service was down while users were registering.
            await r.xgroup_create(_STREAM, _GROUP, id="0", mkstream=True)
            logger.info("consumer_group_created group=%s", _GROUP)
        except Exception as exc:
            if "BUSYGROUP" not in str(exc):
                logger.warning("xgroup_create_warning: %s", exc)

    # ── New messages ───────────────────────────────────────────────────────── #

    async def _read_new(self, r: aioredis.Redis) -> None:
        try:
            results = await r.xreadgroup(
                _GROUP, _CONSUMER, {_STREAM: ">"}, count=10, block=_BLOCK_MS
            )
        except Exception as exc:
            logger.warning("xreadgroup_error: %s", exc)
            await asyncio.sleep(1)
            return

        if not results:
            return

        for _stream_name, messages in results:
            for msg_id, fields in messages:
                await self._handle(r, msg_id, fields)

    # ── Pending (stuck) recovery ───────────────────────────────────────────── #

    async def _recover_pending(self, r: aioredis.Redis) -> None:
        try:
            pending = await r.xpending_range(_STREAM, _GROUP, min="-", max="+", count=20)
        except Exception as exc:
            logger.warning("xpending_error: %s", exc)
            return

        for entry in pending:
            msg_id = entry.get("message_id") or entry.get("message-id", "")
            idle_ms = entry.get("time_since_delivered", 0)
            delivery_count = entry.get("times_delivered", 0)

            if idle_ms < _STUCK_IDLE_MS:
                continue

            if delivery_count > _MAX_RETRIES:
                await self._dead_letter(r, msg_id)
                continue

            try:
                claimed = await r.xclaim(_STREAM, _GROUP, _CONSUMER, _STUCK_IDLE_MS, [msg_id])
                for c_id, c_fields in claimed:
                    logger.info("reclaimed_pending msg_id=%s delivery=%d", c_id, delivery_count)
                    await self._handle(r, c_id, c_fields)
            except Exception as exc:
                logger.warning("xclaim_error msg_id=%s error=%s", msg_id, exc)

    async def _dead_letter(self, r: aioredis.Redis, msg_id: str) -> None:
        try:
            claimed = await r.xclaim(_STREAM, _GROUP, _CONSUMER, 0, [msg_id])
            for c_id, c_fields in claimed:
                await r.xadd(_DLQ, {**c_fields, "original_id": c_id, "reason": "max_retries"})
                await r.xack(_STREAM, _GROUP, c_id)
                logger.error("dlq_move msg_id=%s user_id=%s", c_id, c_fields.get("user_id"))
        except Exception as exc:
            logger.warning("dead_letter_error msg_id=%s error=%s", msg_id, exc)

    # ── Event handler ──────────────────────────────────────────────────────── #

    async def _handle(self, r: aioredis.Redis, msg_id: str, fields: dict) -> None:
        event_type = fields.get("event_type", "")

        if event_type != "user.registered":
            await r.xack(_STREAM, _GROUP, msg_id)
            return

        user_id_str = fields.get("user_id", "")
        try:
            user_id = uuid.UUID(user_id_str)
        except (ValueError, AttributeError):
            logger.error("invalid_user_id_in_event msg_id=%s value=%r", msg_id, user_id_str)
            await r.xack(_STREAM, _GROUP, msg_id)
            return

        try:
            await self._init_wallet(user_id)
            logger.info("wallet_init_ok user_id=%s", user_id_str)
            await r.xack(_STREAM, _GROUP, msg_id)
        except Exception as exc:
            # Don't ACK — stays in PEL, reclaimed on next recovery pass.
            logger.warning("wallet_init_failed user_id=%s error=%s (will retry)", user_id_str, exc)

    async def _init_wallet(self, user_id: uuid.UUID) -> None:
        from app.application.wallet_service import WalletService
        from app.infrastructure.repositories import SqlAlchemyWalletRepository

        async with self._session_manager.session() as session:
            repo = SqlAlchemyWalletRepository(session)
            service = WalletService(repo, welcome_credit=self._welcome_credit)
            await service.get_or_create(user_id)
            await session.commit()
