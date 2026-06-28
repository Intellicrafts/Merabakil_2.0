"""Shared search/research filter model."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SearchFilters(BaseModel):
    doc_type: str | None = None
    jurisdiction: str | None = None
    document_id: str | None = None
    document_ids: list[str] | None = None

    def is_empty(self) -> bool:
        return not any([self.doc_type, self.jurisdiction, self.document_id, self.document_ids])

    def to_search_payload(self) -> dict:
        payload: dict = {}
        if self.doc_type:
            payload["doc_type"] = self.doc_type
        if self.jurisdiction:
            payload["jurisdiction"] = self.jurisdiction
        if self.document_id:
            payload["document_id"] = self.document_id
        if self.document_ids:
            payload["document_ids"] = self.document_ids
        return payload

    def to_term_filters(self) -> dict[str, str]:
        """Simple term filters for stores that only support single-value equality."""
        out: dict[str, str] = {}
        if self.doc_type:
            out["doc_type"] = self.doc_type
        if self.jurisdiction:
            out["jurisdiction"] = self.jurisdiction
        if self.document_id and not self.document_ids:
            out["document_id"] = self.document_id
        return out

    @classmethod
    def from_dict(cls, data: dict | None) -> SearchFilters:
        if not data:
            return cls()
        return cls(
            doc_type=data.get("doc_type"),
            jurisdiction=data.get("jurisdiction"),
            document_id=data.get("document_id"),
            document_ids=data.get("document_ids"),
        )
