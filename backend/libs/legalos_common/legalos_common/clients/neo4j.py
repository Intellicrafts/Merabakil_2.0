"""Neo4j knowledge-graph client wrapper."""

from __future__ import annotations

from typing import Any

from neo4j import AsyncGraphDatabase

from legalos_common.logging import get_logger

logger = get_logger(__name__)


class Neo4jClient:
    def __init__(self, uri: str, user: str, password: str) -> None:
        self._driver = AsyncGraphDatabase.driver(uri, auth=(user, password))

    async def close(self) -> None:
        await self._driver.close()

    async def run(self, query: str, **params: Any) -> list[dict[str, Any]]:
        async with self._driver.session() as session:
            result = await session.run(query, **params)
            return [record.data() async for record in result]

    async def upsert_document(
        self,
        *,
        document_id: str,
        title: str,
        doc_type: str,
        jurisdiction: str | None,
    ) -> None:
        await self.run(
            """
            MERGE (d:Document {id: $document_id})
            SET d.title = $title,
                d.doc_type = $doc_type,
                d.jurisdiction = $jurisdiction
            """,
            document_id=document_id,
            title=title,
            doc_type=doc_type,
            jurisdiction=jurisdiction,
        )

    async def link_citation(self, *, from_doc: str, to_reference: str) -> None:
        await self.run(
            """
            MERGE (a:Document {id: $from_doc})
            MERGE (b:Reference {key: $to_reference})
            MERGE (a)-[:CITES]->(b)
            """,
            from_doc=from_doc,
            to_reference=to_reference,
        )
