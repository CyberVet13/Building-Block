"""Lambda handler: POST /checkout

Creates a Stripe Checkout Session for a subscription tier upgrade.
Returns the Stripe-hosted checkout URL; the frontend redirects the user there.

Body: { "tier": "starter" | "pro" | "business" }
"""

from __future__ import annotations

import json
import os
from typing import Any

from build_block.auth.cognito import extract_bearer, verify_token
from build_block.billing.stripe_client import create_checkout_session
from build_block.db import get_or_create_user


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    try:
        headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
        token = extract_bearer(headers.get("authorization"))
        claims = verify_token(token)
        cognito_sub: str = claims["sub"]
        email: str = claims.get("email", "")

        body = json.loads(event.get("body") or "{}")
        tier = body.get("tier", "starter")
        if tier not in ("starter", "pro", "business"):
            return _response(400, {"error": f"Unknown tier: {tier}"})

        user = get_or_create_user(cognito_sub, email)

        web_url = os.environ.get("WEB_URL", "http://localhost:3000")
        checkout_url = create_checkout_session(
            user_id=str(user.id),
            email=email,
            tier=tier,
            success_url=f"{web_url}/create?subscribed=1",
            cancel_url=f"{web_url}/pricing",
        )

        return _response(200, {"checkout_url": checkout_url})

    except ValueError as exc:
        return _response(401, {"error": str(exc)})
    except RuntimeError as exc:
        # Missing Stripe key or price ID
        return _response(503, {"error": str(exc)})
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
