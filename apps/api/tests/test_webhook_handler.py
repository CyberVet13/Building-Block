"""Tests for the Stripe webhook handler event routing.

These tests mock the DB calls so no real database is needed.
"""

import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from build_block.handlers.stripe_webhook import (
    _handle_checkout_completed,
    _handle_invoice_paid,
    _handle_subscription_deleted,
    _handle_subscription_updated,
    _ts,
)


# ── _ts helper ────────────────────────────────────────────────────────────────

def test_ts_converts_epoch():
    dt = _ts(0)
    assert dt == datetime(1970, 1, 1, tzinfo=timezone.utc)


def test_ts_returns_none_for_none():
    assert _ts(None) is None


# ── checkout.session.completed ────────────────────────────────────────────────

@patch("build_block.handlers.stripe_webhook.upsert_subscription")
def test_checkout_completed_upserts_subscription(mock_upsert):
    session = {
        "mode": "subscription",
        "customer": "cus_123",
        "subscription": "sub_456",
        "metadata": {"user_id": "00000000-0000-0000-0000-000000000001", "tier": "pro"},
    }
    _handle_checkout_completed(session)
    mock_upsert.assert_called_once()
    call_kwargs = mock_upsert.call_args.kwargs
    assert call_kwargs["tier"] == "pro"
    assert call_kwargs["status"] == "active"
    assert str(call_kwargs["stripe_subscription_id"]) == "sub_456"


@patch("build_block.handlers.stripe_webhook.upsert_subscription")
def test_checkout_completed_skips_non_subscription(mock_upsert):
    _handle_checkout_completed({"mode": "payment"})
    mock_upsert.assert_not_called()


@patch("build_block.handlers.stripe_webhook.upsert_subscription")
def test_checkout_completed_skips_missing_user_id(mock_upsert):
    _handle_checkout_completed({
        "mode": "subscription",
        "customer": "cus_x",
        "subscription": "sub_x",
        "metadata": {},
    })
    mock_upsert.assert_not_called()


# ── customer.subscription.deleted ────────────────────────────────────────────

@patch("build_block.handlers.stripe_webhook.cancel_subscription")
def test_subscription_deleted_cancels(mock_cancel):
    _handle_subscription_deleted({"id": "sub_789"})
    mock_cancel.assert_called_once_with("sub_789")


# ── invoice.paid (period renewal) ────────────────────────────────────────────

@patch("build_block.handlers.stripe_webhook.get_user_id_by_stripe_customer")
@patch("build_block.db.pool.get_conn")
def test_invoice_paid_updates_period(mock_get_conn, mock_get_user):
    from uuid import UUID
    mock_get_user.return_value = UUID("00000000-0000-0000-0000-000000000002")
    mock_conn = MagicMock()
    mock_get_conn.return_value.__enter__ = MagicMock(return_value=mock_conn)
    mock_get_conn.return_value.__exit__ = MagicMock(return_value=False)

    _handle_invoice_paid({
        "subscription": "sub_abc",
        "customer": "cus_abc",
        "period_start": 1700000000,
        "period_end":   1702678400,
    })

    mock_conn.execute.assert_called_once()
    sql = mock_conn.execute.call_args.args[0]
    assert "UPDATE subscriptions" in sql
    assert "current_period_start" in sql


@patch("build_block.handlers.stripe_webhook.get_user_id_by_stripe_customer")
def test_invoice_paid_skips_no_sub_id(mock_get_user):
    _handle_invoice_paid({"customer": "cus_x", "subscription": None})
    mock_get_user.assert_not_called()
