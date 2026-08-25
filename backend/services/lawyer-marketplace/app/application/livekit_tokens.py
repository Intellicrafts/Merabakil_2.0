"""Mint short-lived LiveKit room tokens. Fail open when Cloud is not configured."""

from __future__ import annotations

import os
import logging

logger = logging.getLogger(__name__)


def livekit_configured() -> bool:
    return bool(os.getenv("LIVEKIT_URL") and os.getenv("LIVEKIT_API_KEY") and os.getenv("LIVEKIT_API_SECRET"))


def mint_room_token(*, room: str, identity: str, name: str, role: str) -> tuple[str, str] | None:
    url = os.getenv("LIVEKIT_URL", "").strip()
    key = os.getenv("LIVEKIT_API_KEY", "").strip()
    secret = os.getenv("LIVEKIT_API_SECRET", "").strip()
    if not (url and key and secret):
        return None
    try:
        from livekit.api import AccessToken, VideoGrants

        token = (
            AccessToken(key, secret)
            .with_identity(identity)
            .with_name(name)
            .with_metadata(role)
            .with_grants(
                VideoGrants(
                    room_join=True,
                    room=room,
                    can_publish=True,
                    can_subscribe=True,
                    can_publish_data=True,
                )
            )
        )
        return token.to_jwt(), url
    except Exception as exc:
        logger.warning("livekit_sdk_unavailable error=%s — falling back to JWT", exc)
        try:
            from app.application.appointments import mint_livekit_token

            minted = mint_livekit_token(room=room, identity=identity, name=name, role=role)
            return minted["token"], minted["url"]
        except Exception as fallback_exc:
            logger.warning("livekit_token_failed error=%s", fallback_exc)
            return None


def _http_livekit_url(url: str) -> str:
    if url.startswith("wss://"):
        return "https://" + url[6:]
    if url.startswith("ws://"):
        return "http://" + url[5:]
    return url


async def remove_room_participant(*, room: str, identity: str) -> bool:
    """Best-effort LiveKit kick. No-op when Cloud is not configured."""
    if not livekit_configured():
        return False
    url = _http_livekit_url(os.getenv("LIVEKIT_URL", "").strip())
    key = os.getenv("LIVEKIT_API_KEY", "").strip()
    secret = os.getenv("LIVEKIT_API_SECRET", "").strip()
    try:
        from livekit.api import LiveKitAPI, RemoveParticipantRequest

        lk = LiveKitAPI(url, key, secret)
        try:
            await lk.room.remove_participant(RemoveParticipantRequest(room=room, identity=identity))
            return True
        finally:
            aclose = getattr(lk, "aclose", None)
            if callable(aclose):
                await aclose()
    except Exception as exc:
        logger.warning("livekit_remove_participant_failed room=%s identity=%s error=%s", room, identity, exc)
        return False
    return False
