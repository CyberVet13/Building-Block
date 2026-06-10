"""GET /admin/jobs  — recent and failed jobs with debug detail."""

from __future__ import annotations

import json
from typing import Any

from build_block.auth.admin import require_admin
from build_block.db.pool import get_conn


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    try:
        require_admin(event)

        params = event.get("queryStringParameters") or {}
        status_filter = params.get("status")   # "failed" | "completed" | None (all)
        limit = min(int(params.get("limit", 50)), 200)
        job_id = params.get("job_id")           # detail view for a single job

        with get_conn() as conn:
            if job_id:
                return _job_detail(conn, job_id)

            where = "WHERE 1=1"
            args: list = []
            if status_filter:
                where += " AND j.status = %s"
                args.append(status_filter)

            rows = conn.execute(
                f"""
                SELECT j.id, j.user_id, u.email, j.status, j.stage,
                       j.is_preview, j.error_message,
                       j.created_at, j.completed_at,
                       j.input_json->>'industry' AS industry
                FROM generation_jobs j
                JOIN users u ON u.id = j.user_id
                {where}
                ORDER BY j.created_at DESC
                LIMIT %s
                """,
                [*args, limit],
            ).fetchall()

        jobs = [
            {
                "job_id": str(r[0]),
                "user_id": str(r[1]),
                "email": r[2],
                "status": r[3],
                "stage": r[4],
                "is_preview": r[5],
                "error_message": r[6],
                "created_at": str(r[7]),
                "completed_at": str(r[8]) if r[8] else None,
                "industry": r[9],
            }
            for r in rows
        ]

        return _ok({"jobs": jobs, "count": len(jobs)})

    except PermissionError as exc:
        return _err(403, str(exc))
    except ValueError as exc:
        return _err(401, str(exc))
    except Exception as exc:
        return _err(500, str(exc))


def _job_detail(conn, job_id: str) -> dict:
    row = conn.execute(
        """
        SELECT j.id, j.user_id, u.email, j.status, j.stage,
               j.is_preview, j.error_message, j.input_json,
               j.created_at, j.completed_at
        FROM generation_jobs j
        JOIN users u ON u.id = j.user_id
        WHERE j.id = %s
        """,
        (job_id,),
    ).fetchone()

    if not row:
        return _err(404, "Job not found")

    # Fetch usage ledger for token breakdown
    usage = conn.execute(
        "SELECT tokens_by_stage, estimated_cost_usd FROM usage_ledger WHERE job_id = %s",
        (job_id,),
    ).fetchone()

    return _ok({
        "job_id": str(row[0]),
        "user_id": str(row[1]),
        "email": row[2],
        "status": row[3],
        "stage": row[4],
        "is_preview": row[5],
        "error_message": row[6],
        "input": row[7],
        "created_at": str(row[8]),
        "completed_at": str(row[9]) if row[9] else None,
        "tokens_by_stage": usage[0] if usage else {},
        "estimated_cost_usd": float(usage[1]) if usage and usage[1] else None,
    })


def _ok(body: dict) -> dict:
    return {"statusCode": 200, "headers": _h(), "body": json.dumps(body, default=str)}

def _err(status: int, msg: str) -> dict:
    return {"statusCode": status, "headers": _h(), "body": json.dumps({"error": msg})}

def _h() -> dict:
    return {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
