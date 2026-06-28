from __future__ import annotations

import json
import re
from typing import Any

from legalos_common.clients.llm import ChatMessage, LLMClient

_JSON_BLOCK_RE = re.compile(r"\{[\s\S]*\}")


async def complete_json(
    llm: LLMClient,
    *,
    system: str,
    user: str,
    fallback: dict[str, Any],
    temperature: float = 0.1,
) -> dict[str, Any]:
    raw = await llm.complete(
        [ChatMessage(role="system", content=system), ChatMessage(role="user", content=user)],
        temperature=temperature,
    )
    match = _JSON_BLOCK_RE.search(raw)
    if not match:
        return fallback
    try:
        parsed = json.loads(match.group())
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    return fallback
