"""Build store-specific filters from SearchFilters."""

from __future__ import annotations

from typing import Any

from qdrant_client.http import models as qm

from legalos_common.rag.filters import SearchFilters


def build_qdrant_filter(filters: SearchFilters | None) -> qm.Filter | None:
    if filters is None or filters.is_empty():
        return None
    must: list[Any] = []
    if filters.doc_type:
        must.append(qm.FieldCondition(key="doc_type", match=qm.MatchValue(value=filters.doc_type)))
    if filters.jurisdiction:
        must.append(
            qm.FieldCondition(key="jurisdiction", match=qm.MatchValue(value=filters.jurisdiction))
        )
    doc_ids: list[str] = []
    if filters.document_id:
        doc_ids.append(filters.document_id)
    if filters.document_ids:
        doc_ids.extend(filters.document_ids)
    if doc_ids:
        must.append(
            qm.FieldCondition(key="document_id", match=qm.MatchAny(any=doc_ids))
        )
    return qm.Filter(must=must) if must else None


def build_opensearch_clauses(filters: SearchFilters | None) -> list[dict[str, Any]]:
    if filters is None or filters.is_empty():
        return []
    clauses: list[dict[str, Any]] = []
    if filters.doc_type:
        clauses.append({"term": {"doc_type": filters.doc_type}})
    if filters.jurisdiction:
        clauses.append({"term": {"jurisdiction": filters.jurisdiction}})
    doc_ids: list[str] = []
    if filters.document_id:
        doc_ids.append(filters.document_id)
    if filters.document_ids:
        doc_ids.extend(filters.document_ids)
    if doc_ids:
        clauses.append({"terms": {"document_id": doc_ids}})
    return clauses
