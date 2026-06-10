#!/usr/bin/env python3
"""Ingest proprietary templates from corpus/templates into pgvector.

Usage:
    # Dry run — shows what would be ingested, no DB writes
    python scripts/ingest/ingest_corpus.py --corpus-dir corpus/templates --dry-run

    # Live run — embeds and upserts into local or AWS Aurora
    python scripts/ingest/ingest_corpus.py --corpus-dir corpus/templates

Environment:
    DATABASE_URL  — PostgreSQL connection string
    AWS_REGION    — for Bedrock embeddings (default us-east-1)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

import frontmatter
import psycopg
from pgvector.psycopg import register_vector

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100
EMBEDDING_DIM = 1024  # Titan Embeddings v2


# ── Chunking ──────────────────────────────────────────────────────────────────

def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Section-aware chunking: prefer splits on markdown headings."""
    sections = re.split(r"(?=^#{1,3} )", text, flags=re.MULTILINE)
    chunks: list[str] = []
    buffer = ""

    for section in sections:
        if len(buffer) + len(section) <= size:
            buffer = (buffer + "\n\n" + section).strip()
            continue
        if buffer:
            chunks.append(buffer)
        buffer = section.strip()

    if buffer:
        chunks.append(buffer)

    # Subdivide oversize sections with sliding window
    final: list[str] = []
    for chunk in chunks:
        if len(chunk) <= size:
            final.append(chunk)
            continue
        start = 0
        while start < len(chunk):
            final.append(chunk[start: start + size])
            start += size - overlap

    return [c for c in final if c.strip()]


# ── Embedding ─────────────────────────────────────────────────────────────────

def embed(texts: list[str], bedrock_client) -> list[list[float]]:
    results = []
    for text in texts:
        vec = bedrock_client.embed(text)
        results.append(vec)
    return results


# ── DB helpers ────────────────────────────────────────────────────────────────

def upsert_document(conn, *, s3_key: str, meta: dict, chunk_count: int) -> str:
    """Insert or update a corpus_documents row, return its id."""
    row = conn.execute(
        """
        INSERT INTO corpus_documents
          (s3_key, doc_type, section, industry, tier_gate, version, chunk_count, ingested_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, now())
        ON CONFLICT (s3_key) DO UPDATE SET
          doc_type = EXCLUDED.doc_type,
          section  = EXCLUDED.section,
          industry = EXCLUDED.industry,
          tier_gate = EXCLUDED.tier_gate,
          version  = EXCLUDED.version,
          chunk_count = EXCLUDED.chunk_count,
          ingested_at = now(),
          is_active = true
        RETURNING id
        """,
        (
            s3_key,
            meta.get("doc_type", "template"),
            meta.get("section", "general"),
            meta.get("industry", "general"),
            meta.get("tier_gate", "starter"),
            meta.get("version", "v1"),
            chunk_count,
        ),
    ).fetchone()
    conn.execute(
        "DELETE FROM corpus_chunks WHERE document_id = %s",
        (row[0],),
    )
    return str(row[0])


def insert_chunks(conn, *, document_id: str, chunks: list[str], embeddings: list[list[float]]) -> None:
    for i, (chunk, vec) in enumerate(zip(chunks, embeddings)):
        conn.execute(
            """
            INSERT INTO corpus_chunks (document_id, chunk_index, content, metadata_json, embedding)
            VALUES (%s, %s, %s, %s::jsonb, %s)
            """,
            (document_id, i, chunk, json.dumps({"chunk_index": i}), vec),
        )


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest corpus templates into pgvector")
    parser.add_argument("--corpus-dir", type=Path, default=Path("corpus/templates"))
    parser.add_argument("--dry-run", action="store_true", help="Parse + chunk but skip DB/embed")
    parser.add_argument("--file", type=Path, help="Ingest a single file only")
    args = parser.parse_args()

    files = sorted([args.file] if args.file else args.corpus_dir.rglob("*.md"))
    if not files:
        print(f"No markdown files found in {args.corpus_dir}")
        sys.exit(1)

    if not args.dry_run:
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            print("ERROR: DATABASE_URL not set. Use --dry-run or set the env var.")
            sys.exit(1)

        from build_block.bedrock.client import BedrockClient
        bedrock = BedrockClient()

    total_chunks = 0
    for path in files:
        post = frontmatter.load(path)
        meta = dict(post.metadata)
        body: str = post.content

        chunks = chunk_text(body)
        total_chunks += len(chunks)

        doc_id_hint = hashlib.sha256(str(path).encode()).hexdigest()[:12]
        s3_key = f"templates/{path.relative_to(args.corpus_dir).as_posix()}"

        print(f"\n{path.name}")
        print(f"  s3_key={s3_key}  section={meta.get('section')}  industry={meta.get('industry')}  chunks={len(chunks)}")

        if args.dry_run:
            for i, c in enumerate(chunks):
                print(f"  [{i}] {c[:80].replace(chr(10), ' ')}…")
            continue

        print("  Embedding…", end="", flush=True)
        embeddings = embed(chunks, bedrock)
        print(" done")

        with psycopg.connect(database_url) as conn:
            register_vector(conn)
            doc_id = upsert_document(conn, s3_key=s3_key, meta=meta, chunk_count=len(chunks))
            insert_chunks(conn, document_id=doc_id, chunks=chunks, embeddings=embeddings)
            conn.commit()
            print(f"  Upserted doc_id={doc_id}")

    print(f"\n{'DRY RUN — ' if args.dry_run else ''}Total: {len(files)} files, {total_chunks} chunks")


if __name__ == "__main__":
    main()
