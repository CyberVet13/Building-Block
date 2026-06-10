"""Lambda handler: GET /account

Returns the current user's subscription status and usage for the UI header.
"""

from __future__ import annotations

import json
from typing import Any

from build_block.auth.cognito import extract_bearer, verify_token
from build_block.billing.stripe_client import TIER_PLAN_LIMITS
from build_block.db import (
    count_plans_used_in_period,
    get_or_create_user,
    get_subscription,
)


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    try:
        headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
        token = extract_bearer(headers.get("authorization"))
        claims = verify_token(token)

        user = get_or_create_user(claims["sub"], claims.get("email", ""))
        sub = get_subscription(user.id)
        plans_used = count_plans_used_in_period(user.id, sub)
        limit = TIER_PLAN_LIMITS.get(sub.tier, 0)

        return _response(200, {
            "tier": sub.tier,
            "status": sub.status,
            "plans_used": plans_used,
            "plans_limit": limit,
            "plans_remaining": max(0, limit - plans_used),
            "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
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
