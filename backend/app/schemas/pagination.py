from pydantic import BaseModel, Field
from typing import Generic, TypeVar, List, Optional

T = TypeVar('T')


class PaginationParams(BaseModel):
    page: int = Field(1, ge=1, description="Número de página (comenzando en 1)")
    limit: int = Field(20, ge=1, le=100, description="Registros por página (máx 100)")


class PaginatedResponse(BaseModel, Generic[T]):
    data: List[T]
    page: int
    limit: int
    total: int
    pages: int
    has_next: bool
    has_prev: bool

    @classmethod
    def create(cls, data: List[T], page: int, limit: int, total: int):
        pages = (total + limit - 1) // limit
        return cls(
            data=data,
            page=page,
            limit=limit,
            total=total,
            pages=pages,
            has_next=page < pages,
            has_prev=page > 1,
        )
