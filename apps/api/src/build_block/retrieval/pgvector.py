import json

import psycopg
from pgvector.psycopg import register_vector

from build_block.retrieval.base import RetrievalFilter, RetrievedChunk, RetrievalService


class PgVectorRetrievalService(RetrievalService):
    def __init__(self, database_url: str, embed_fn):
        self.database_url = database_url
        self.embed_fn = embed_fn

    def retrieve(
        self,
        query: str,
        *,
        top_k: int = 5,
        filters: RetrievalFilter | None = None,
    ) -> list[RetrievedChunk]:
        embedding = self.embed_fn(query)
        filters = filters or RetrievalFilter()

        conditions = ["cd.is_active = true"]
        params: list = [embedding, top_k]

        if filters.section:
            conditions.append("cd.section = %s")
            params.append(filters.section)
        if filters.industry:
            conditions.append("(cd.industry = %s OR cd.industry = 'general')")
            params.append(filters.industry)
        if filters.doc_type:
            conditions.append("cd.doc_type = %s")
            params.append(filters.doc_type)
        if filters.tier_gate:
            conditions.append("cd.tier_gate IN ('free', %s)")
            params.append(filters.tier_gate)

        where = " AND ".join(conditions)
        sql = f"""
            SELECT cc.id, cc.content, cc.metadata_json,
                   1 - (cc.embedding <=> %s::vector) AS score
            FROM corpus_chunks cc
            JOIN corpus_documents cd ON cd.id = cc.document_id
            WHERE {where}
            ORDER BY cc.embedding <=> %s::vector
            LIMIT %s
        """
        params = [embedding, *params[:-1], embedding, top_k]

        with psycopg.connect(self.database_url) as conn:
            register_vector(conn)
            rows = conn.execute(sql, params).fetchall()

        return [
            RetrievedChunk(
                chunk_id=str(row[0]),
                content=row[1],
                score=float(row[3]),
                metadata=row[2] if isinstance(row[2], dict) else json.loads(row[2]),
            )
            for row in rows
        ]
