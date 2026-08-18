"""Indexer: Qdrant children (dense+sparse named vectors) + parents (dummy 1-dim), Neo4j graph."""

from __future__ import annotations

import asyncio
import uuid

from qdrant_client.http import models as qm

from app.application.ports import IndexChunk, IndexChildChunk, IndexParentChunk
from legalos_common.clients import Neo4jClient, QdrantVectorClient
from legalos_common.logging import get_logger
from legalos_common.search.sparse_encoder import SparseEncoder

logger = get_logger(__name__)

_NS = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


def _pid(key: str) -> str:
    return str(uuid.uuid5(_NS, key))


class MultiStoreIndexer:
    def __init__(
        self,
        *,
        qdrant: QdrantVectorClient,
        sparse: SparseEncoder,
        neo4j: Neo4jClient,
    ) -> None:
        self._qdrant = qdrant
        self._sparse = sparse
        self._neo4j = neo4j

    # ------------------------------------------------------------------
    # Parent-child ingestion (primary path for raw document ingestion)
    # ------------------------------------------------------------------

    async def index_parent_children(
        self,
        parents: list[IndexParentChunk],
        children: list[IndexChildChunk],
    ) -> None:
        """Store parents (dummy vector) and children (dense+sparse) to Qdrant."""
        if not parents and not children:
            return

        parent_points = [
            qm.PointStruct(
                id=_pid(p.parent_id),
                vector={"dense": [0.0]},
                payload={
                    "parent_id": p.parent_id,
                    "document_id": p.document_id,
                    "title": p.title,
                    "doc_type": p.doc_type,
                    "jurisdiction": p.jurisdiction,
                    "citation": p.citation,
                    "section": p.section,
                    "content": p.content,
                    **p.metadata,
                },
            )
            for p in parents
        ]

        sparse_vecs = await self._sparse.encode_many(
            [c.text_for_embedding for c in children]
        )
        child_points = [
            qm.PointStruct(
                id=_pid(c.child_id),
                vector={"dense": c.embedding, "sparse": sparse_vec},
                payload={
                    "child_id": c.child_id,
                    "parent_id": c.parent_id,
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
            for c, sparse_vec in zip(children, sparse_vecs)
        ]

        await asyncio.gather(
            self._qdrant.upsert_parents(parent_points),
            self._qdrant.upsert(child_points),
        )
        logger.info(
            "parent_children_indexed",
            parents=len(parents),
            children=len(children),
            document_id=parents[0].document_id if parents else "?",
        )

    # ------------------------------------------------------------------
    # Flat ingestion (structured / pre-chunked documents)
    # ------------------------------------------------------------------

    async def index_chunks(self, chunks: list[IndexChunk]) -> None:
        """Flat chunk ingestion — each chunk stored as a child with a synthetic parent."""
        if not chunks:
            return

        sparse_vecs = await self._sparse.encode_many([c.content for c in chunks])
        points = [
            qm.PointStruct(
                id=_pid(c.chunk_id),
                vector={"dense": c.embedding, "sparse": sparse_vec},
                payload={
                    "child_id": c.chunk_id,
                    "parent_id": c.chunk_id,  # self-parent for flat chunks
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
            for c, sparse_vec in zip(chunks, sparse_vecs)
        ]
        await self._qdrant.upsert(points)
        logger.info("chunks_indexed", count=len(chunks), document_id=chunks[0].document_id)

    # ------------------------------------------------------------------
    # Knowledge graph
    # ------------------------------------------------------------------

    async def register_document(
        self, *, document_id: str, title: str, doc_type: str, jurisdiction: str | None
    ) -> None:
        await self._neo4j.upsert_document(
            document_id=document_id, title=title, doc_type=doc_type, jurisdiction=jurisdiction
        )

    async def link_citations(self, *, document_id: str, citations: list[str]) -> None:
        for citation in citations:
            await self._neo4j.link_citation(from_doc=document_id, to_reference=citation)

    # ------------------------------------------------------------------
    # Purge
    # ------------------------------------------------------------------

    async def purge_document(self, document_id: str) -> None:
        await asyncio.gather(
            self._qdrant.delete_by_document_id(document_id),
            self._qdrant.delete_parents_by_document_id(document_id),
        )
        logger.info("document_purged_from_indexes", document_id=document_id)
