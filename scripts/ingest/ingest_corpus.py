#!/usr/bin/env python3
"""Ingest proprietary templates from corpus/templates into pgvector.

Usage:
    python scripts/ingest/ingest_corpus.py --corpus-dir corpus/templates --dry-run
    python scripts/ingest/ingest_corpus.py --corpus-dir corpus/templates
"""

from __future__ import annotations

import argparse
import hashlib
import re
from pathlib import Path

import frontmatter


CHUNK_SIZE = 800
CHUNK_OVERLAP = 100


def parse_frontmatter(path: Path) -> tuple[dict, str]:
    post = frontmatter.load(path)
    return dict(post.metadata), post.content


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Section-aware chunking: prefer splits on markdown headings."""
    sections = re.split(r"(?=^#{1,3} )", text, flags=re.MULTILINE)
    chunks: list[str] = []
    buffer = ""

    for section in sections:
        if len(buffer) + len(section) <= size:
            buffer = (buffer + section).strip()
            continue
        if buffer:
            chunks.append(buffer)
        buffer = section.strip()

    if buffer:
        chunks.append(buffer)

    # Fall back to fixed windows for oversized sections
    final: list[str] = []
    for chunk in chunks:
        if len(chunk) <= size:
            final.append(chunk)
            continue
        start = 0
        while start < len(chunk):
            final.append(chunk[start : start + size])
            start += size - overlap

    return final


def document_id_for(path: Path, corpus_dir: Path) -> str:
    rel = path.relative_to(corpus_dir).as_posix()
    return hashlib.sha256(rel.encode()).hexdigest()[:16]


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest corpus templates")
    parser.add_argument("--corpus-dir", type=Path, default=Path("corpus/templates"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    files = sorted(args.corpus_dir.rglob("*.md"))
    if not files:
        print(f"No markdown files found in {args.corpus_dir}")
        return

    total_chunks = 0
    for path in files:
        meta, body = parse_frontmatter(path)
        chunks = chunk_text(body)
        total_chunks += len(chunks)
        doc_id = document_id_for(path, args.corpus_dir)
        print(f"{path.name}: {len(chunks)} chunks | section={meta.get('section')} | id={doc_id}")

        if args.dry_run:
            continue

        # TODO: upload to S3, embed via Bedrock, upsert corpus_documents + corpus_chunks
        print("  (skipped DB write — wire Bedrock + Postgres in implementation phase)")

    print(f"\nTotal: {len(files)} documents, {total_chunks} chunks")
    if args.dry_run:
        print("Dry run complete. No data written.")


if __name__ == "__main__":
    main()
