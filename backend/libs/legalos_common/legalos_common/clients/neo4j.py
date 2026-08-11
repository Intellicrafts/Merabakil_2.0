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

    async def fetch_knowledge_graph(self, *, limit: int = 200) -> dict[str, Any]:
        """Return Document/Reference nodes and CITES edges for visualization."""
        rows = await self.run(
            """
            MATCH (d:Document)
            OPTIONAL MATCH (d)-[r:CITES]->(ref:Reference)
            WITH d, collect(DISTINCT ref) AS refs
            RETURN d, refs
            LIMIT $limit
            """,
            limit=limit,
        )

        nodes: dict[str, dict[str, Any]] = {}
        edges: list[dict[str, Any]] = []

        for row in rows:
            doc = row.get("d") or {}
            doc_id = str(doc.get("id") or "")
            if not doc_id:
                continue
            nodes[f"doc:{doc_id}"] = {
                "id": f"doc:{doc_id}",
                "label": doc.get("title") or doc_id,
                "type": "Document",
                "doc_type": doc.get("doc_type"),
                "jurisdiction": doc.get("jurisdiction"),
                "document_id": doc_id,
            }
            for ref in row.get("refs") or []:
                if not ref:
                    continue
                key = str(ref.get("key") or "")
                if not key:
                    continue
                ref_id = f"ref:{key}"
                nodes[ref_id] = {
                    "id": ref_id,
                    "label": key if len(key) <= 80 else f"{key[:77]}…",
                    "type": "Reference",
                    "key": key,
                }
                edges.append(
                    {
                        "id": f"cites:{doc_id}:{key}",
                        "source": f"doc:{doc_id}",
                        "target": ref_id,
                        "type": "CITES",
                    }
                )

        # Also include orphan Reference nodes (cited but rare)
        orphan_refs = await self.run(
            """
            MATCH (ref:Reference)
            WHERE NOT (()-[:CITES]->(ref))
            RETURN ref
            LIMIT 50
            """
        )
        for row in orphan_refs:
            ref = row.get("ref") or {}
            key = str(ref.get("key") or "")
            if not key:
                continue
            ref_id = f"ref:{key}"
            if ref_id not in nodes:
                nodes[ref_id] = {
                    "id": ref_id,
                    "label": key if len(key) <= 80 else f"{key[:77]}…",
                    "type": "Reference",
                    "key": key,
                }

        return {
            "nodes": list(nodes.values()),
            "edges": edges,
            "stats": {
                "documents": sum(1 for n in nodes.values() if n["type"] == "Document"),
                "references": sum(1 for n in nodes.values() if n["type"] == "Reference"),
                "citations": len(edges),
            },
        }
