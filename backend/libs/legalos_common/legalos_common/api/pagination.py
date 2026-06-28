"""Cursor-free offset pagination helpers."""

from __future__ import annotations

from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel

ItemT = TypeVar("ItemT")


class PageParams(BaseModel):
    page: int = 1
    size: int = 20

    @classmethod
    def as_query(
        cls,
        page: int = Query(1, ge=1, description="1-indexed page number"),
        size: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
    ) -> PageParams:
        return cls(page=page, size=size)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size


class Page(BaseModel, Generic[ItemT]):
    items: list[ItemT]
    page: int
    size: int
    total: int
    pages: int


def paginate(items: list[ItemT], total: int, params: PageParams) -> Page[ItemT]:
    pages = (total + params.size - 1) // params.size if params.size else 0
    return Page(items=items, page=params.page, size=params.size, total=total, pages=pages)
