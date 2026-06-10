from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from build_block.db.pool import get_conn


@dataclass
class JobRow:
    id: UUID
    user_id: UUID
    status: str
    is_preview: bool
    stage: str | None


def reserve_job(user_id: UUID, input_json: dict, is_preview: bool) -> JobRow:
    """Insert a job in 'reserved' status before starting Step Functions."""
    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO generation_jobs (user_id, input_json, is_preview, status, started_at)
            VALUES (%s, %s::jsonb, %s, 'reserved', %s)
            RETURNING id, user_id, status, is_preview, NULL::text
            """,
            (str(user_id), __import__("json").dumps(input_json), is_preview,
             datetime.now(timezone.utc)),
        ).fetchone()
        conn.commit()
        return JobRow(*row)


def update_job_status(job_id: UUID, status: str, stage: str | None = None,
                      error_message: str | None = None) -> None:
    with get_conn() as conn:
        if status in ("completed", "failed"):
            conn.execute(
                """
                UPDATE generation_jobs
                SET status = %s, stage = %s, error_message = %s,
                    completed_at = %s
                WHERE id = %s
                """,
                (status, stage, error_message,
                 datetime.now(timezone.utc), str(job_id)),
            )
        else:
            conn.execute(
                "UPDATE generation_jobs SET status = %s, stage = %s WHERE id = %s",
                (status, stage, str(job_id)),
            )
        conn.commit()


def get_job(job_id: UUID, user_id: UUID) -> JobRow | None:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, user_id, status, is_preview, stage
            FROM generation_jobs
            WHERE id = %s AND user_id = %s
            """,
            (str(job_id), str(user_id)),
        ).fetchone()
        return JobRow(*row) if row else None
