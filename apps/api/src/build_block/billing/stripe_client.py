"""Thin wrapper around the Stripe SDK.

Keeps all Stripe imports in one place so the rest of the codebase
stays testable without a live Stripe key.
"""

from __future__ import annotations

from functools import lru_cache

import stripe

from build_block.config import settings

# Tier → Stripe Price ID mapping (populate after creating products in Stripe Dashboard)
TIER_PRICE_IDS: dict[str, str] = {
    "starter":  "",   # fill from Stripe Dashboard → Products → Starter → Price ID
    "pro":      "",
    "business": "",
}

TIER_PLAN_LIMITS: dict[str, int] = {
    "free":     0,
    "starter":  3,
    "pro":      10,
    "business": 30,
}


@lru_cache(maxsize=1)
def _stripe() -> stripe.Stripe:
    if not settings.stripe_secret_key:
        raise RuntimeError("STRIPE_SECRET_KEY is not set")
    return stripe.Stripe(settings.stripe_secret_key)


def create_checkout_session(
    *,
    user_id: str,
    email: str,
    tier: str,
    success_url: str,
    cancel_url: str,
) -> str:
    """Create a Stripe Checkout Session and return its URL."""
    price_id = TIER_PRICE_IDS.get(tier)
    if not price_id:
        raise ValueError(f"No Stripe price configured for tier '{tier}'")

    client = _stripe()
    session = client.checkout.sessions.create(
        mode="subscription",
        customer_email=email,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": user_id, "tier": tier},
        subscription_data={"metadata": {"user_id": user_id, "tier": tier}},
    )
    return session.url


def create_portal_session(*, stripe_customer_id: str, return_url: str) -> str:
    """Return a Stripe Customer Portal URL for self-serve billing management."""
    client = _stripe()
    session = client.billing_portal.sessions.create(
        customer=stripe_customer_id,
        return_url=return_url,
    )
    return session.url


def construct_webhook_event(payload: bytes, sig_header: str) -> stripe.Event:
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.stripe_webhook_secret
    )
