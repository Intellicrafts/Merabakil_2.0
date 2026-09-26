"""Per-run registry of everything the tools surfaced (sources, lawyers, bookings).

Citation markers ([KB-n], [WEB-n]) are assigned here, synchronously, so two tool
calls in the same step can never hand out the same number, and a source seen
twice keeps its first number. The graph state only carries the ``run_id``.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Any


@dataclass
class SourceRegistry:
    kb: list[Any] = field(default_factory=list)
    web: list[Any] = field(default_factory=list)
    lawyers: list[dict] = field(default_factory=list)
    appointment: dict | None = None
    _kb_keys: dict[str, int] = field(default_factory=dict)
    _web_keys: dict[str, int] = field(default_factory=dict)
    _lawyer_ids: set[str] = field(default_factory=set)

    def add_kb(self, source: Any) -> int:
        key = getattr(source, "chunk_id", "") or hashlib.sha1(
            (getattr(source, "content", "") or "").encode()
        ).hexdigest()
        if key not in self._kb_keys:
            self.kb.append(source)
            self._kb_keys[key] = len(self.kb)
        return self._kb_keys[key]

    def add_web(self, result: Any) -> int:
        key = getattr(result, "url", "") or getattr(result, "title", "")
        if key not in self._web_keys:
            self.web.append(result)
            self._web_keys[key] = len(self.web)
        return self._web_keys[key]

    def add_lawyers(self, lawyers: list[dict]) -> None:
        for lawyer in lawyers:
            lid = str(lawyer.get("id", ""))
            if lid and lid not in self._lawyer_ids:
                self._lawyer_ids.add(lid)
                self.lawyers.append(lawyer)


_REGISTRIES: dict[str, SourceRegistry] = {}


def open_registry(run_id: str) -> SourceRegistry:
    registry = SourceRegistry()
    _REGISTRIES[run_id] = registry
    return registry


def get_registry(state: dict | None) -> SourceRegistry:
    run_id = (state or {}).get("run_id") or ""
    registry = _REGISTRIES.get(run_id)
    if registry is None:  # tool invoked outside a managed run (tests, direct calls)
        registry = open_registry(run_id)
    return registry


def close_registry(run_id: str) -> None:
    _REGISTRIES.pop(run_id, None)
