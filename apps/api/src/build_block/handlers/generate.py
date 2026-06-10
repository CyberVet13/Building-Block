"""Lambda handler: POST /generate

Flow:
  1. Verify Cognito JWT
  2. Get or create user row
  3. Load subscription + count plans used this period
  4. check_generation_allowed()  →  402 if at limit
  5. Reserve job in DB
  6. Start Step Functions execution
  7. Return 202 with job_id (client polls /jobs/{id} or SSE /jobs/{id}/stream)
"""

from __future__ import annotations

import json
import os
from typing import Any
from uuid import UUID

import boto3

from build_block.auth.cognito import extract_bearer, verify_token
from build_block.billing.usage import check_generation_allowed
from build_block.config import settings
from build_block.demo import DEMO_JOB_ID
from build_block.db import (
    count_plans_used_in_period,
    get_or_create_user,
    get_subscription,
    reserve_job,
)
from build_block.db.concurrency import check_concurrency_allowed
from build_block.models import GenerationInput


def _sfn_client():
    return boto3.client("stepfunctions", region_name=os.environ.get("AWS_REGION", "us-east-1"))


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    # --- Demo mode: skip all infrastructure ---
    if settings.demo_mode:
        body = json.loads(event.get("body") or "{}")
        is_preview = body.get("is_preview", False)
        return _response(202, {
            "job_id": DEMO_JOB_ID,
            "is_preview": is_preview,
            "stream_url": f"/jobs/{DEMO_JOB_ID}",
            "usage": {"allowed": True, "tier": "pro", "plans_used": 1,
                      "plans_limit": 10, "is_preview": is_preview},
        })

    try:
        # --- Auth ---
        headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
        token = extract_bearer(headers.get("authorization"))
        claims = verify_token(token)
        cognito_sub: str = claims["sub"]
        email: str = claims.get("email", "")

        # --- Parse input ---
        body = json.loads(event.get("body") or "{}")
        user_input = GenerationInput(**body)

        # --- User + subscription ---
        user = get_or_create_user(cognito_sub, email)
        sub = get_subscription(user.id)
        plans_used = count_plans_used_in_period(user.id, sub)

        # --- Entitlement check ---
        usage = check_generation_allowed(
            tier=sub.tier,
            plans_used_in_period=plans_used,
            input_data=user_input,
        )
        if not usage.allowed:
            return _response(402, {
                "error": usage.message,
                "usage": usage.model_dump(),
            })

        # --- Concurrency check ---
        concurrent_ok, concurrent_msg = check_concurrency_allowed(user.id, sub.tier)
        if not concurrent_ok:
            return _response(429, {"error": concurrent_msg})

        # --- Reserve job ---
        job = reserve_job(
            user_id=user.id,
            input_json=user_input.model_dump(),
            is_preview=user_input.is_preview,
        )

        # --- Start Step Functions ---
        state_machine_arn = os.environ.get("STATE_MACHINE_ARN", "")
        if state_machine_arn:
            _sfn_client().start_execution(
                stateMachineArn=state_machine_arn,
                name=str(job.id),
                input=json.dumps({
                    "job_id": str(job.id),
                    "user_id": str(user.id),
                    "tier": sub.tier,
                    "is_preview": user_input.is_preview,
                    "input": user_input.model_dump(),
                }),
            )

        return _response(202, {
            "job_id": str(job.id),
            "is_preview": user_input.is_preview,
            "usage": usage.model_dump(),
            "stream_url": f"/jobs/{job.id}/stream",
        })

    except ValueError as exc:
        return _response(401, {"error": str(exc)})
    except Exception as exc:
        return _response(500, {"error": "Internal error", "detail": str(exc)})


def _response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }
