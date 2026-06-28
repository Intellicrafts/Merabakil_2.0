"""Search HTTP routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.schemas import SearchRequest, SearchResponse
from app.infrastructure.container import get_container
from legalos_common.rag.guardrails import sanitize_user_input
from legalos_common.security.rbac import CurrentUser, Permission, require_permissions

router = APIRouter(prefix="/api/v1/search", tags=["search"])


@router.post(
    "",
    response_model=SearchResponse,
    summary="Vector / keyword / hybrid search over the legal knowledge base",
)
async def search(
    body: SearchRequest,
    _: CurrentUser = Depends(require_permissions(Permission.SEARCH_READ.value)),
) -> SearchResponse:
    container = get_container()
    query = sanitize_user_input(body.query)
    filters = None if body.filters().is_empty() else body.filters()
    results = None
    if container.cache:
        results = await container.cache.get(query, body.mode.value, body.top_k, filters)
    if results is None:
        results = await container.use_case.search(
            query,
            top_k=body.top_k,
            mode=body.mode,
            filters=filters,
        )
        if container.cache:
            await container.cache.set(query, body.mode.value, body.top_k, filters, results)
    return SearchResponse(query=query, mode=body.mode, count=len(results), results=results)
