"""Tools available to courtroom role agents (called only when an agent chooses them)."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

from app.application.courtroom_agents.blackboard import AuthorityItem, HearingBlackboard
from app.infrastructure.search_retriever import HttpSearchRetriever
from legalos_common.clients.web_search import search_web_text
from legalos_common.rag.filters import SearchFilters

ToolHandler = Callable[[HearingBlackboard, dict[str, Any]], Awaitable[dict[str, Any]]]

MAX_SOURCES_PER_SEARCH = 4


def tool_specs_for_role(role: str, *, allow_web: bool) -> list[dict[str, str]]:
    common = [
        {
            "name": "search_corpus",
            "description": "Search Indian legal corpus / intake docs for authorities relevant to a query.",
        },
        {
            "name": "address_agenda",
            "description": "Mark agenda point ids you are arguing (raised/contested).",
        },
        {
            "name": "cite_source",
            "description": "Cite a previously retrieved authority by id onto the blackboard.",
        },
    ]
    if allow_web and role in {"petitioner", "respondent"}:
        common.insert(
            1,
            {
                "name": "search_web",
                "description": "Optional public web search for Indian law when corpus is thin.",
            },
        )
    if role in {"petitioner", "respondent", "judge"}:
        common.append(
            {
                "name": "mark_exhibit",
                "description": "Update exhibit status: marked | admitted | rejected.",
            }
        )
    if role == "respondent":
        common.append(
            {
                "name": "raise_objection",
                "description": "Raise an Indian Evidence Act / pleadings objection type.",
            }
        )
    if role == "judge":
        common.extend(
            [
                {
                    "name": "frame_issues",
                    "description": "Formally frame issues for consideration from the agenda.",
                },
                {
                    "name": "pronounce_verdict",
                    "description": "Signal that this utterance is the oral operative order.",
                },
            ]
        )
    return common


class ToolBelt:
    def __init__(
        self,
        retriever: HttpSearchRetriever,
        *,
        user_token: str | None,
    ) -> None:
        self._retriever = retriever
        self._user_token = user_token
        self.trace: list[dict[str, Any]] = []

    async def run(
        self,
        name: str,
        board: HearingBlackboard,
        args: dict[str, Any],
        *,
        role: str,
        allow_web: bool,
    ) -> dict[str, Any]:
        allowed = {t["name"] for t in tool_specs_for_role(role, allow_web=allow_web)}
        if name not in allowed:
            result = {"ok": False, "error": f"Tool '{name}' not available to {role}"}
            self.trace.append({"tool": name, "args": args, "result": result})
            return result

        handlers: dict[str, ToolHandler] = {
            "search_corpus": self._search_corpus,
            "search_web": self._search_web,
            "address_agenda": self._address_agenda,
            "cite_source": self._cite_source,
            "mark_exhibit": self._mark_exhibit,
            "raise_objection": self._raise_objection,
            "frame_issues": self._frame_issues,
            "pronounce_verdict": self._pronounce_verdict,
        }
        handler = handlers.get(name)
        if not handler:
            result = {"ok": False, "error": f"Unknown tool {name}"}
        else:
            result = await handler(board, args)
        self.trace.append({"tool": name, "args": args, "result": result})
        return result

    async def _search_corpus(
        self, board: HearingBlackboard, args: dict[str, Any]
    ) -> dict[str, Any]:
        query = str(args.get("query") or board.matter_title)[:400]
        tasks = []
        if board.document_ids:
            tasks.append(
                self._retriever.retrieve(
                    query,
                    top_k=MAX_SOURCES_PER_SEARCH,
                    filters=SearchFilters(document_ids=board.document_ids),
                    user_token=self._user_token,
                )
            )
        tasks.append(
            self._retriever.retrieve(
                query,
                top_k=MAX_SOURCES_PER_SEARCH,
                filters=SearchFilters(jurisdiction=board.jurisdiction)
                if board.jurisdiction
                else None,
                user_token=self._user_token,
            )
        )
        batches = await asyncio.gather(*tasks)
        seen: set[str] = set()
        packed: list[dict[str, Any]] = []
        for batch in batches:
            for src in batch:
                if src.chunk_id in seen:
                    continue
                seen.add(src.chunk_id)
                kind = "document" if src.document_id in set(board.document_ids) else "corpus"
                sid = f"c{len(board.authorities) + len(packed) + 1}"
                auth = AuthorityItem(
                    id=sid,
                    title=src.title or src.citation or f"Authority {sid}",
                    citation=src.citation or src.section or "",
                    snippet=(src.content or "")[:320],
                    source_kind=kind,
                    document_id=src.document_id,
                    verified=True,
                )
                board.upsert_authority(auth)
                packed.append(auth.model_dump())
                if len(packed) >= MAX_SOURCES_PER_SEARCH:
                    break
            if len(packed) >= MAX_SOURCES_PER_SEARCH:
                break
        return {"ok": True, "sources": packed}

    async def _search_web(
        self, board: HearingBlackboard, args: dict[str, Any]
    ) -> dict[str, Any]:
        query = str(args.get("query") or board.matter_title)[:400]
        try:
            hits = await search_web_text(f"{query} India law", max_results=3)
        except Exception:
            hits = []
        packed: list[dict[str, Any]] = []
        for i, w in enumerate(hits[:3], start=1):
            sid = f"w{len(board.authorities) + i}"
            auth = AuthorityItem(
                id=sid,
                title=w.title,
                citation=w.url,
                snippet=(w.snippet or "")[:320],
                source_kind="web",
                url=w.url,
                verified=True,
            )
            board.upsert_authority(auth)
            packed.append(auth.model_dump())
        return {"ok": True, "sources": packed}

    async def _address_agenda(
        self, board: HearingBlackboard, args: dict[str, Any]
    ) -> dict[str, Any]:
        ids = [str(x) for x in (args.get("point_ids") or args.get("pointIds") or [])]
        speaker = str(args.get("speaker") or board.last_speaker or "petitioner")
        board.apply_agenda_status(ids, speaker)
        return {"ok": True, "point_ids": ids}

    async def _cite_source(
        self, board: HearingBlackboard, args: dict[str, Any]
    ) -> dict[str, Any]:
        sid = str(args.get("source_id") or args.get("sourceId") or "")
        found = next((a for a in board.authorities if a.id == sid), None)
        if not found:
            return {"ok": False, "error": f"Unknown source_id {sid}"}
        return {
            "ok": True,
            "source": found.model_dump(),
            "note": "Cite this source in your utterance; it is verified on the blackboard.",
        }

    async def _mark_exhibit(
        self, board: HearingBlackboard, args: dict[str, Any]
    ) -> dict[str, Any]:
        eid = str(args.get("exhibit_id") or args.get("exhibitId") or "")
        status = str(args.get("status") or "marked")
        if status not in {"pending", "marked", "admitted", "rejected"}:
            return {"ok": False, "error": "Invalid status"}
        updated = board.apply_exhibit_status(eid, status)
        if not updated:
            return {"ok": False, "error": f"Unknown exhibit {eid}"}
        return {"ok": True, "exhibit": updated.model_dump()}

    async def _raise_objection(
        self, board: HearingBlackboard, args: dict[str, Any]
    ) -> dict[str, Any]:
        otype = str(args.get("type") or "relevance")
        return {
            "ok": True,
            "objection": {
                "type": otype,
                "note": "State the objection briefly in your utterance for the Bench.",
            },
        }

    async def _frame_issues(
        self, board: HearingBlackboard, args: dict[str, Any]
    ) -> dict[str, Any]:
        board.issues_framed = True
        labels = [a.label for a in board.agenda[:5]]
        return {"ok": True, "issues": labels, "note": "Frame these issues in your utterance."}

    async def _pronounce_verdict(
        self, board: HearingBlackboard, args: dict[str, Any]
    ) -> dict[str, Any]:
        board.verdict_ready = True
        return {
            "ok": True,
            "note": "Your next/final utterance must be the oral operative order.",
        }
