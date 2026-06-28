from __future__ import annotations

from pydantic import BaseModel, Field

from app.application.use_cases import SearchMode
from legalos_common.rag.filters import SearchFilters
from legalos_common.rag.schemas import RetrievedSource


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    top_k: int = Field(default=10, ge=1, le=50)
    mode: SearchMode = SearchMode.HYBRID
    doc_type: str | None = None
    jurisdiction: str | None = None
    document_id: str | None = None
    document_ids: list[str] | None = None

    def filters(self) -> SearchFilters:
        return SearchFilters(
            doc_type=self.doc_type,
            jurisdiction=self.jurisdiction,
            document_id=self.document_id,
            document_ids=self.document_ids,
        )


class SearchResponse(BaseModel):
    query: str
    mode: SearchMode
    count: int
    results: list[RetrievedSource]
