"""Lambda handler: POST /portal

Returns a Stripe Customer Portal URL for subscription self-management
(upgrade, downgrade, cancel, payment method update).
"""

from __future__ import annotations

import json
import os
from typing import Any

from build_block.auth.cognito import extract_bearer, verify_token
from build_block.billing.stripe_client import create_portal_session
from build_block.db import get_or_create_user
from build_block.db.subscriptions import get_stripe_customer_id


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    try:
        headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
        token = extract_bearer(headers.get("authorization"))
        claims = verify_token(token)
        cognito_sub: str = claims["sub"]
        email: str = claims.get("email", "")

        user = get_or_create_user(cognito_sub, email)
        customer_id = get_stripe_customer_id(user.id)

        if not customer_id:
            return _response(404, {"error": "No billing account found. Subscribe first."})

        web_url = os.environ.get("WEB_URL", "http://localhost:3000")
        portal_url = create_portal_session(
            stripe_customer_id=customer_id,
            return_url=f"{web_url}/account",
        )

        return _response(200, {"portal_url": portal_url})

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
