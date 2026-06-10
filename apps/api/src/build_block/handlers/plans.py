"""Lambda handler: GET /plans — list the current user's plans.

Returns a paginated list with metadata (no full content) for the plans
history page. Full content is served via GET /jobs/{jobId} after generation.
"""

from __future__ import annotations

import json
from typing import Any

from build_block.auth.cognito import extract_bearer, verify_token
from build_block.db import get_or_create_user
from build_block.db.pool import get_conn


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    try:
        headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
        token = extract_bearer(headers.get("authorization"))
        claims = verify_token(token)
        user = get_or_create_user(claims["sub"], claims.get("email", ""))

        params = event.get("queryStringParameters") or {}
        limit = min(int(params.get("limit", 20)), 100)
        offset = int(params.get("offset", 0))

        with get_conn() as conn:
            rows = conn.execute(
                """
                SELECT p.id, p.title, p.is_preview, p.version,
                       p.created_at, p.updated_at,
                       j.status, j.industry
                FROM plans p
                LEFT JOIN generation_jobs j ON j.plan_id = p.id
                WHERE p.user_id = %s
                ORDER BY p.created_at DESC
                LIMIT %s OFFSET %s
                """,
                (str(user.id), limit, offset),
            ).fetchall()

            total = conn.execute(
                "SELECT COUNT(*) FROM plans WHERE user_id = %s",
                (str(user.id),),
            ).fetchone()[0]

        plans = [
            {
                "plan_id": str(r[0]),
                "title": r[1],
                "is_preview": r[2],
                "version": r[3],
                "created_at": str(r[4]),
                "updated_at": str(r[5]),
                "status": r[6] or "completed",
                "industry": r[7] or "general",
            }
            for r in rows
        ]

        return _ok({"plans": plans, "total": total, "limit": limit, "offset": offset})

    except ValueError as exc:
        return _err(401, str(exc))
    except Exception as exc:
        return _err(500, str(exc))


def _ok(body: dict) -> dict:
    return {"statusCode": 200, "headers": _h(), "body": json.dumps(body, default=str)}

def _err(status: int, msg: str) -> dict:
    return {"statusCode": status, "headers": _h(), "body": json.dumps({"error": msg})}

def _h() -> dict:
    return {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
