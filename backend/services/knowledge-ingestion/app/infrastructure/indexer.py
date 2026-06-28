"""Multi-store indexer: Qdrant (vectors), OpenSearch (BM25), Neo4j (graph)."""

from __future__ import annotations

import uuid

from qdrant_client.http import models as qm

from app.application.ports import IndexChunk
from legalos_common.clients import Neo4jClient, OpenSearchClient, QdrantVectorClient
from legalos_common.logging import get_logger

logger = get_logger(__name__)


class MultiStoreIndexer:
    def __init__(
        self,
        *,
        qdrant: QdrantVectorClient,
        opensearch: OpenSearchClient,
        neo4j: Neo4jClient,
    ) -> None:
        self._qdrant = qdrant
        self._opensearch = opensearch
        self._neo4j = neo4j

    async def index_chunks(self, chunks: list[IndexChunk]) -> None:
        if not chunks:
            return

        points = [
            qm.PointStruct(
                id=str(uuid.uuid5(uuid.NAMESPACE_URL, c.chunk_id)),
                vector=c.embedding,
                payload={
                    "chunk_id": c.chunk_id,
                    "document_id": c.document_id,
                    "title": c.title,
                    "doc_type": c.doc_type,
                    "jurisdiction": c.jurisdiction,
                    "citation": c.citation,
                    "section": c.section,
                    "content": c.content,
                    **c.metadata,
                },
            )
            for c in chunks
        ]
        os_docs = [
            {
                "chunk_id": c.chunk_id,
                "document_id": c.document_id,
                "title": c.title or "",
                "content": c.content,
                "doc_type": c.doc_type or "",
                "jurisdiction": c.jurisdiction or "",
                "citation": c.citation or "",
                "section": c.section or "",
            }
            for c in chunks
        ]
        import asyncio

        await asyncio.gather(
            self._qdrant.upsert(points),
            self._opensearch.bulk_index(os_docs),
        )
        logger.info("chunks_indexed", count=len(chunks), document_id=chunks[0].document_id)

    async def register_document(
        self, *, document_id: str, title: str, doc_type: str, jurisdiction: str | None
    ) -> None:
        await self._neo4j.upsert_document(
            document_id=document_id, title=title, doc_type=doc_type, jurisdiction=jurisdiction
        )

    async def link_citations(self, *, document_id: str, citations: list[str]) -> None:
        for citation in citations:
            await self._neo4j.link_citation(from_doc=document_id, to_reference=citation)
