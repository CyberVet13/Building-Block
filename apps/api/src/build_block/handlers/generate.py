"""Lambda handler: POST /generate

Flow:
  1. Authenticate (Cognito JWT)
  2. check_generation_allowed()
  3. Reserve job in DB
  4. Start Step Functions execution
  5. Return job_id (+ stream URL for SSE)
"""

import json
from typing import Any

from build_block.billing.usage import check_generation_allowed
from build_block.models import GenerationInput


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    try:
        body = json.loads(event.get("body") or "{}")
        user_input = GenerationInput(**body)

        # TODO: load user tier + plans_used from DB via cognito sub
        tier = "free"
        plans_used = 0

        usage = check_generation_allowed(
            tier=tier,
            plans_used_in_period=plans_used,
            input_data=user_input,
        )

        if not usage.allowed:
            return _response(402, {"error": usage.message, "usage": usage.model_dump()})

        # TODO: insert generation_job, start Step Functions
        return _response(202, {
            "message": "Generation started",
            "is_preview": user_input.is_preview,
            "usage": usage.model_dump(),
            "job_id": "00000000-0000-0000-0000-000000000000",
        })
    except Exception as exc:
        return _response(400, {"error": str(exc)})


def _response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }
