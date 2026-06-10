"""Lambda handler: GET /jobs/{jobId}

Returns current job status and, when completed, the plan content.
The frontend polls this endpoint until status == 'completed' | 'failed'.
"""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from build_block.auth.cognito import extract_bearer, verify_token
from build_block.config import settings
from build_block.db import get_or_create_user, get_job
from build_block.db.pool import get_conn
from build_block.demo import DEMO_JOB, DEMO_JOB_ID


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    # Demo mode
    if settings.demo_mode:
        return _response(200, DEMO_JOB)

    try:
        headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
        token = extract_bearer(headers.get("authorization"))
        claims = verify_token(token)
        cognito_sub: str = claims["sub"]
        email: str = claims.get("email", "")

        path_params = event.get("pathParameters") or {}
        job_id_str = path_params.get("jobId", "")

        try:
            job_id = UUID(job_id_str)
        except ValueError:
            return _response(400, {"error": "Invalid job ID"})

        user = get_or_create_user(cognito_sub, email)
        job = get_job(job_id, user.id)

        if not job:
            return _response(404, {"error": "Job not found"})

        body: dict[str, Any] = {
            "job_id": str(job.id),
            "status": job.status,
            "stage": job.stage,
            "is_preview": job.is_preview,
        }

        if job.status == "completed":
            plan = _load_plan(job_id)
            if plan:
                body["plan"] = plan

        return _response(200, body)

    except ValueError as exc:
        return _response(401, {"error": str(exc)})
    except Exception as exc:
        return _response(500, {"error": "Internal error", "detail": str(exc)})


def _load_plan(job_id: UUID) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT p.id, p.title, p.content_json, p.is_preview
            FROM plans p
            JOIN generation_jobs j ON j.plan_id = p.id
            WHERE j.id = %s
            """,
            (str(job_id),),
        ).fetchone()
    if not row:
        return None
    return {
        "plan_id": str(row[0]),
        "title": row[1],
        "content": row[2],
        "is_preview": row[3],
    }


def _response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }
