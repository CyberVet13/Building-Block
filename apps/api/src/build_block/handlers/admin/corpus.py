"""GET /admin/corpus  |  POST /admin/corpus/{id}/deactivate  |  POST /admin/corpus/reingest"""

from __future__ import annotations

import json
from typing import Any

from build_block.auth.admin import require_admin
from build_block.db.pool import get_conn


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    try:
        require_admin(event)

        method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
        path: str = event.get("rawPath", "/admin/corpus")

        if method == "POST":
            parts = path.strip("/").split("/")
            action = parts[-1]
            doc_id = parts[-2] if action in ("deactivate", "activate") else None
            return _handle_post(action, doc_id, event.get("body") or "{}")

        # GET — list all corpus documents
        with get_conn() as conn:
            docs = conn.execute(
                """
                SELECT id, s3_key, doc_type, section, industry,
                       tier_gate, version, is_active, chunk_count, ingested_at, created_at
                FROM corpus_documents
                ORDER BY section, industry, created_at DESC
                """
            ).fetchall()

            total_chunks = conn.execute(
                "SELECT COUNT(*) FROM corpus_chunks"
            ).fetchone()[0]

        documents = [
            {
                "doc_id": str(r[0]),
                "s3_key": r[1],
                "doc_type": r[2],
                "section": r[3],
                "industry": r[4],
                "tier_gate": r[5],
                "version": r[6],
                "is_active": r[7],
                "chunk_count": r[8],
                "ingested_at": str(r[9]) if r[9] else None,
                "created_at": str(r[10]),
            }
            for r in docs
        ]

        return _ok({
            "documents": documents,
            "total_documents": len(documents),
            "total_chunks": total_chunks,
            "active_documents": sum(1 for d in documents if d["is_active"]),
        })

    except PermissionError as exc:
        return _err(403, str(exc))
    except ValueError as exc:
        return _err(401, str(exc))
    except Exception as exc:
        return _err(500, str(exc))


def _handle_post(action: str, doc_id: str | None, body_str: str) -> dict:
    if action in ("deactivate", "activate") and doc_id:
        with get_conn() as conn:
            conn.execute(
                "UPDATE corpus_documents SET is_active = %s WHERE id = %s",
                (action == "activate", doc_id),
            )
            conn.commit()
        return _ok({"message": f"Document {doc_id} {action}d"})

    if action == "reingest":
        # Trigger a re-ingest by returning the S3 keys to process.
        # In production wire this to an SQS queue or invoke the ingest Lambda.
        body = json.loads(body_str)
        doc_ids = body.get("doc_ids", [])
        return _ok({
            "message": f"Re-ingest queued for {len(doc_ids)} documents",
            "doc_ids": doc_ids,
            "note": "Wire to ingest Lambda or SQS in production",
        })

    return _err(400, f"Unknown action: {action}")


def _ok(body: dict) -> dict:
    return {"statusCode": 200, "headers": _h(), "body": json.dumps(body, default=str)}

def _err(status: int, msg: str) -> dict:
    return {"statusCode": status, "headers": _h(), "body": json.dumps({"error": msg})}

def _h() -> dict:
    return {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
