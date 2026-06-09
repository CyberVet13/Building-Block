from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class RetrievalFilter:
    section: str | None = None
    industry: str | None = None
    doc_type: str | None = None
    tier_gate: str | None = None


@dataclass
class RetrievedChunk:
    chunk_id: str
    content: str
    score: float
    metadata: dict


class RetrievalService(ABC):
    """Abstract retrieval layer — swap pgvector for OpenSearch later."""

    @abstractmethod
    def retrieve(
        self,
        query: str,
        *,
        top_k: int = 5,
        filters: RetrievalFilter | None = None,
    ) -> list[RetrievedChunk]:
        raise NotImplementedError
