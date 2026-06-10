"""Lambda handler: finalize a completed generation job.

Called by Step Functions after all section writers complete.
Assembles the plan document, persists to DB + S3, records usage ledger.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import boto3

from build_block.db import update_job_status
from build_block.db.pool import get_conn


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    job_id = event["job_id"]
    user_id = event["user_id"]
    is_preview = event.get("is_preview", False)
    sections: dict[str, str] = event.get("sections", {})
    tokens_by_stage: dict[str, int] = event.get("tokens_by_stage", {})

    plan_id = _persist_plan(
        user_id=UUID(user_id),
        job_id=UUID(job_id),
        sections=sections,
        is_preview=is_preview,
        tokens_by_stage=tokens_by_stage,
    )

    # Upload to S3
    _upload_to_s3(
        plan_id=str(plan_id),
        user_id=user_id,
        sections=sections,
        is_preview=is_preview,
    )

    update_job_status(UUID(job_id), status="completed")

    return {"job_id": job_id, "plan_id": str(plan_id), "status": "completed"}


def _persist_plan(
    user_id: UUID,
    job_id: UUID,
    sections: dict[str, str],
    is_preview: bool,
    tokens_by_stage: dict[str, int],
) -> UUID:
    with get_conn() as conn:
        row = conn.execute(
            """
            INSERT INTO plans (user_id, title, content_json, is_preview)
            VALUES (%s, %s, %s::jsonb, %s)
            RETURNING id
            """,
            (
                str(user_id),
                sections.get("title", "Business Plan"),
                json.dumps({"sections": sections}),
                is_preview,
            ),
        ).fetchone()
        plan_id = row[0]

        conn.execute(
            """
            UPDATE generation_jobs SET plan_id = %s WHERE id = %s
            """,
            (str(plan_id), str(job_id)),
        )

        total_tokens = sum(tokens_by_stage.values())
        estimated_cost = total_tokens * 0.000003  # rough Sonnet rate per token

        conn.execute(
            """
            INSERT INTO usage_ledger
              (user_id, job_id, plan_id, billed_as_plan, tokens_by_stage, estimated_cost_usd)
            VALUES (%s, %s, %s, %s, %s::jsonb, %s)
            """,
            (
                str(user_id),
                str(job_id),
                str(plan_id),
                not is_preview,
                json.dumps(tokens_by_stage),
                estimated_cost,
            ),
        )
        conn.commit()

    return plan_id


def _upload_to_s3(plan_id: str, user_id: str, sections: dict, is_preview: bool) -> None:
    bucket = os.environ.get("PLANS_BUCKET", "")
    if not bucket:
        return

    key = f"plans/{user_id}/{plan_id}.json"
    boto3.client("s3").put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps({"plan_id": plan_id, "is_preview": is_preview, "sections": sections}),
        ContentType="application/json",
        ServerSideEncryption="AES256",
    )
