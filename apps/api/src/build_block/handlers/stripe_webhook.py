"""Lambda handler: POST /webhooks/stripe

Processes Stripe webhook events and syncs subscription state to Aurora.

Events handled:
  checkout.session.completed       — new subscription created
  customer.subscription.updated    — tier change, renewal, payment status
  customer.subscription.deleted    — cancellation
  invoice.paid                     — period renewed; reset entitlement window

Stripe sends all webhooks to a single endpoint. Each event is idempotent:
re-processing the same event leaves the DB in the same state.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import stripe

from build_block.billing.stripe_client import (
    TIER_PLAN_LIMITS,
    construct_webhook_event,
)
from build_block.db.subscriptions import (
    cancel_subscription,
    get_user_id_by_stripe_customer,
    upsert_subscription,
)

log = logging.getLogger(__name__)


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    body_raw = (event.get("body") or "").encode()
    sig = (event.get("headers") or {}).get("stripe-signature", "")

    try:
        stripe_event = construct_webhook_event(body_raw, sig)
    except (ValueError, stripe.error.SignatureVerificationError) as exc:
        log.warning("Webhook signature verification failed: %s", exc)
        return _response(400, {"error": "Invalid signature"})

    event_type: str = stripe_event["type"]
    data_obj = stripe_event["data"]["object"]

    try:
        if event_type == "checkout.session.completed":
            _handle_checkout_completed(data_obj)
        elif event_type in (
            "customer.subscription.updated",
            "customer.subscription.created",
        ):
            _handle_subscription_updated(data_obj)
        elif event_type == "customer.subscription.deleted":
            _handle_subscription_deleted(data_obj)
        elif event_type == "invoice.paid":
            _handle_invoice_paid(data_obj)
        else:
            log.debug("Unhandled Stripe event: %s", event_type)
    except Exception as exc:
        log.error("Error processing %s: %s", event_type, exc, exc_info=True)
        # Return 200 so Stripe doesn't retry — we log the failure
        return _response(200, {"warning": "Processed with error", "detail": str(exc)})

    return _response(200, {"received": True})


# ── Event handlers ────────────────────────────────────────────────────────────

def _handle_checkout_completed(session: dict) -> None:
    if session.get("mode") != "subscription":
        return

    customer_id: str = session["customer"]
    subscription_id: str = session["subscription"]
    user_id_str: str = session.get("metadata", {}).get("user_id", "")
    tier: str = session.get("metadata", {}).get("tier", "starter")

    if not user_id_str:
        log.warning("checkout.session.completed: no user_id in metadata")
        return

    upsert_subscription(
        user_id=UUID(user_id_str),
        stripe_customer_id=customer_id,
        stripe_subscription_id=subscription_id,
        tier=tier,
        status="active",
        plans_per_period=TIER_PLAN_LIMITS.get(tier, 0),
        current_period_start=None,
        current_period_end=None,
    )
    log.info("Activated %s subscription for user %s", tier, user_id_str)


def _handle_subscription_updated(sub: dict) -> None:
    customer_id: str = sub["customer"]
    subscription_id: str = sub["id"]
    status: str = sub["status"]  # active, past_due, trialing, etc.

    # Derive tier from metadata (set at checkout) or price nickname
    tier = sub.get("metadata", {}).get("tier", "")
    if not tier:
        items = sub.get("items", {}).get("data", [])
        tier = items[0]["price"].get("nickname", "starter").lower() if items else "starter"

    period_start = _ts(sub.get("current_period_start"))
    period_end = _ts(sub.get("current_period_end"))

    user_id = get_user_id_by_stripe_customer(customer_id)
    if not user_id:
        log.warning("subscription.updated: no user found for customer %s", customer_id)
        return

    upsert_subscription(
        user_id=user_id,
        stripe_customer_id=customer_id,
        stripe_subscription_id=subscription_id,
        tier=tier,
        status=status,
        plans_per_period=TIER_PLAN_LIMITS.get(tier, 0),
        current_period_start=period_start,
        current_period_end=period_end,
    )
    log.info("Updated subscription %s → tier=%s status=%s", subscription_id, tier, status)


def _handle_subscription_deleted(sub: dict) -> None:
    cancel_subscription(sub["id"])
    log.info("Canceled subscription %s", sub["id"])


def _handle_invoice_paid(invoice: dict) -> None:
    """Renewal — update billing period so plan counter resets."""
    sub_id: str | None = invoice.get("subscription")
    if not sub_id:
        return

    customer_id: str = invoice["customer"]
    period_start = _ts(invoice.get("period_start"))
    period_end = _ts(invoice.get("period_end"))

    user_id = get_user_id_by_stripe_customer(customer_id)
    if not user_id:
        return

    from build_block.db.pool import get_conn
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE subscriptions
            SET current_period_start = %s,
                current_period_end   = %s,
                status               = 'active',
                updated_at           = now()
            WHERE stripe_subscription_id = %s
            """,
            (period_start, period_end, sub_id),
        )
        conn.commit()
    log.info("Renewed subscription %s period %s → %s", sub_id, period_start, period_end)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _ts(epoch: int | None) -> datetime | None:
    if epoch is None:
        return None
    return datetime.fromtimestamp(epoch, tz=timezone.utc)


def _response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }
