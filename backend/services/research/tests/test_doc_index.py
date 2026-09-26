"""Temporary per-user document index: user uploads never touch the knowledge base."""

from __future__ import annotations

import asyncio
import re

import pytest

from app.infrastructure.doc_index import PROMPT_BUDGET_CHARS, SMALL_DOC_CHARS, DocumentContext
from tests.conftest import FakeDocumentTexts, FakeEmbedder, FakeRedis, parse_sse

OWNER, TOKEN = "user-1", "token-user-1"


def _long_contract() -> str:
    filler = [
        f"Clause {i}. The parties agree to maintain the premises in good order and to pay "
        f"all municipal charges on time, as further described in schedule {i}."
        for i in range(1, 400)
    ]
    filler.insert(
        380,
        "Clause 381. The landlord shall refund the security deposit within 45 days of the "
        "tenant vacating, after deducting unpaid rent only.",
    )
    return "\n".join(filler)


def _setup(**docs):
    redis, embedder, texts = FakeRedis(), FakeEmbedder(), FakeDocumentTexts()
    for doc_id, (title, text) in docs.items():
        texts.add(doc_id, owner_token=TOKEN, title=title, text=text)
    return redis, embedder, texts, DocumentContext(redis, embedder, texts, ttl=7200)


def test_short_document_is_given_whole_without_embedding() -> None:
    redis, embedder, _, ctx = _setup(d1=("notice.pdf", "Legal notice: pay Rs 50,000 within 15 days."))
    out = asyncio.run(ctx.context_for(owner=OWNER, document_ids=["d1"], query="deadline?", user_token=TOKEN))
    assert "pay Rs 50,000 within 15 days" in out and "notice.pdf" in out
    assert embedder.calls == 0


def test_long_document_surfaces_the_relevant_passage_within_budget() -> None:
    text = _long_contract()
    assert len(text) > SMALL_DOC_CHARS
    redis, embedder, _, ctx = _setup(d1=("rent-agreement.pdf", text))
    out = asyncio.run(
        ctx.context_for(
            owner=OWNER, document_ids=["d1"], query="When must the landlord refund my security deposit?",
            user_token=TOKEN,
        )
    )
    assert "refund the security deposit within 45 days" in out  # deep in the file
    assert "[Opening]" in out and "Clause 1." in out
    assert len(out) <= PROMPT_BUDGET_CHARS + 600
    assert not re.search(r"\[KB-\d+\]", out)  # user passages never get legal-source markers


def test_index_is_reused_until_it_expires() -> None:
    redis, embedder, _, ctx = _setup(d1=("rent-agreement.pdf", _long_contract()))
    asyncio.run(ctx.context_for(owner=OWNER, document_ids=["d1"], query="deposit", user_token=TOKEN))
    after_first = embedder.calls
    asyncio.run(ctx.context_for(owner=OWNER, document_ids=["d1"], query="rent", user_token=TOKEN))
    assert embedder.calls == after_first + 1  # only the new question is embedded


def test_another_user_cannot_read_or_reuse_the_index() -> None:
    redis, _, _, ctx = _setup(d1=("rent-agreement.pdf", _long_contract()))
    asyncio.run(ctx.context_for(owner=OWNER, document_ids=["d1"], query="deposit", user_token=TOKEN))
    other = asyncio.run(ctx.context_for(owner="user-2", document_ids=["d1"], query="deposit", user_token="token-user-2"))
    assert other == ""
    assert all(key.startswith("research:docidx:user-1:") for key in redis.kv)


def test_drop_and_drop_all_remove_the_index() -> None:
    redis, _, _, ctx = _setup(d1=("a.pdf", _long_contract()), d2=("b.pdf", "short file"))
    asyncio.run(ctx.context_for(owner=OWNER, document_ids=["d1", "d2"], query="deposit", user_token=TOKEN))
    assert len(redis.kv) == 2
    asyncio.run(ctx.drop(OWNER, ["d1"]))
    assert list(redis.kv) == ["research:docidx:user-1:d2"]
    asyncio.run(ctx.drop_all(OWNER))
    assert redis.kv == {}


def test_embedding_outage_falls_back_to_the_opening_and_caches_nothing() -> None:
    class BrokenEmbedder(FakeEmbedder):
        async def embed(self, texts):
            raise RuntimeError("provider down")

    redis, texts = FakeRedis(), FakeDocumentTexts()
    texts.add("d1", owner_token=TOKEN, title="big.pdf", text=_long_contract())
    ctx = DocumentContext(redis, BrokenEmbedder(), texts, ttl=7200)
    out = asyncio.run(ctx.context_for(owner=OWNER, document_ids=["d1"], query="deposit", user_token=TOKEN))
    assert "Clause 1." in out and len(out) <= PROMPT_BUDGET_CHARS + 300
    assert redis.kv == {}


# ── Through the chat endpoint ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_chat_uses_the_temporary_index_and_keeps_kb_search_law_only(client, env, access_token) -> None:
    env.texts.add("doc-9", owner_token=access_token, title="rent-agreement.pdf", text=_long_contract())
    resp = await client.post(
        "/api/v1/research/stream",
        json={"query": "When must the landlord refund my security deposit?", "document_ids": ["doc-9"],
              "document_id": "doc-9"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert parse_sse(resp.text)[-1][0] == "done"
    state = env.orchestrator.states[-1]
    assert "refund the security deposit within 45 days" in state.session_document_text
    assert state.search_filters.document_id is None and not state.search_filters.document_ids


@pytest.mark.asyncio
async def test_detach_and_forget_drop_the_index(client, env, access_token) -> None:
    env.texts.add("doc-9", owner_token=access_token, title="rent-agreement.pdf", text=_long_contract())
    headers = {"Authorization": f"Bearer {access_token}"}
    await client.post("/api/v1/research/sessions/s1/documents", json={"document_id": "doc-9"}, headers=headers)
    for _ in range(20):  # warm-up build runs in the background
        await asyncio.sleep(0)
        if any(k.startswith("research:docidx:") for k in env.redis.kv):
            break
    assert any(k.startswith("research:docidx:user-1:doc-9") for k in env.redis.kv)
    resp = await client.delete("/api/v1/research/sessions/s1", headers=headers)
    assert resp.status_code == 204
    assert not any(k.startswith("research:docidx:") for k in env.redis.kv)


@pytest.mark.asyncio
async def test_cannot_attach_someone_elses_document(client, env, access_token) -> None:
    env.texts.add("doc-x", owner_token="someone-else", title="private.pdf", text="secret")
    resp = await client.post(
        "/api/v1/research/sessions/s1/documents", json={"document_id": "doc-x"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 404
