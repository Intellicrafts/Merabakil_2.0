"""Mint short-lived LiveKit room tokens. Fail open when Cloud is not configured."""

from __future__ import annotations

import json
import os
import logging

logger = logging.getLogger(__name__)


def livekit_configured() -> bool:
    return bool(os.getenv("LIVEKIT_URL") and os.getenv("LIVEKIT_API_KEY") and os.getenv("LIVEKIT_API_SECRET"))


def _video_grants(*, room: str, publish: bool, subscribe: bool, data: bool):
    from livekit.api import VideoGrants

    return VideoGrants(
        room_join=True,
        room=room,
        can_publish=publish,
        can_subscribe=subscribe,
        can_publish_data=data,
    )


def mint_room_token(*, room: str, identity: str, name: str, role: str) -> tuple[str, str] | None:
    url = os.getenv("LIVEKIT_URL", "").strip()
    key = os.getenv("LIVEKIT_API_KEY", "").strip()
    secret = os.getenv("LIVEKIT_API_SECRET", "").strip()
    if not (url and key and secret):
        return None
    try:
        from livekit.api import AccessToken

        token = (
            AccessToken(key, secret)
            .with_identity(identity)
            .with_name(name)
            .with_metadata(role)
            .with_grants(_video_grants(room=room, publish=True, subscribe=True, data=True))
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


def mint_observe_token(*, room: str, identity: str, name: str) -> tuple[str, str] | None:
    """Subscribe-only token for admin observers — no publish or data channels."""
    url = os.getenv("LIVEKIT_URL", "").strip()
    key = os.getenv("LIVEKIT_API_KEY", "").strip()
    secret = os.getenv("LIVEKIT_API_SECRET", "").strip()
    if not (url and key and secret):
        return None
    try:
        from livekit.api import AccessToken

        token = (
            AccessToken(key, secret)
            .with_identity(identity)
            .with_name(name)
            .with_metadata("admin")
            .with_grants(_video_grants(room=room, publish=False, subscribe=True, data=False))
        )
        return token.to_jwt(), url
    except Exception as exc:
        logger.warning("livekit_observe_token_failed error=%s", exc)
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


async def list_room_participants(*, room: str) -> list[dict]:
    """Return LiveKit participants for a room. Empty when unconfigured or on error."""
    if not livekit_configured():
        return []
    url = _http_livekit_url(os.getenv("LIVEKIT_URL", "").strip())
    key = os.getenv("LIVEKIT_API_KEY", "").strip()
    secret = os.getenv("LIVEKIT_API_SECRET", "").strip()
    try:
        from livekit.api import LiveKitAPI, ListParticipantsRequest

        lk = LiveKitAPI(url, key, secret)
        try:
            resp = await lk.room.list_participants(ListParticipantsRequest(room=room))
            out: list[dict] = []
            for p in resp.participants:
                role = ""
                if p.metadata:
                    try:
                        meta = json.loads(p.metadata) if p.metadata.startswith("{") else p.metadata
                        role = meta if isinstance(meta, str) else meta.get("role", "")
                    except Exception:
                        role = p.metadata
                out.append(
                    {
                        "identity": p.identity,
                        "name": p.name or "",
                        "role": role or "",
                        "state": str(getattr(p, "state", "")),
                    }
                )
            return out
        finally:
            aclose = getattr(lk, "aclose", None)
            if callable(aclose):
                await aclose()
    except Exception as exc:
        logger.warning("livekit_list_participants_failed room=%s error=%s", room, exc)
        return []
