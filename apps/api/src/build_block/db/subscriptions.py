from __future__ import annotations

from datetime import datetime
from uuid import UUID

from build_block.db.pool import get_conn


def upsert_subscription(
    *,
    user_id: UUID,
    stripe_customer_id: str,
    stripe_subscription_id: str | None,
    tier: str,
    status: str,
    plans_per_period: int,
    current_period_start: datetime | None,
    current_period_end: datetime | None,
) -> None:
    """Insert or update the subscription row for a user (called from webhook)."""
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO subscriptions
              (user_id, stripe_customer_id, stripe_subscription_id,
               tier, status, plans_per_period,
               current_period_start, current_period_end, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (stripe_subscription_id) DO UPDATE SET
              tier                  = EXCLUDED.tier,
              status                = EXCLUDED.status,
              plans_per_period      = EXCLUDED.plans_per_period,
              current_period_start  = EXCLUDED.current_period_start,
              current_period_end    = EXCLUDED.current_period_end,
              updated_at            = now()
            """,
            (
                str(user_id),
                stripe_customer_id,
                stripe_subscription_id,
                tier,
                status,
                plans_per_period,
                current_period_start,
                current_period_end,
            ),
        )
        conn.commit()


def cancel_subscription(stripe_subscription_id: str) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            UPDATE subscriptions
            SET status = 'canceled', updated_at = now()
            WHERE stripe_subscription_id = %s
            """,
            (stripe_subscription_id,),
        )
        conn.commit()


def get_user_id_by_stripe_customer(stripe_customer_id: str) -> UUID | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT user_id FROM subscriptions WHERE stripe_customer_id = %s LIMIT 1",
            (stripe_customer_id,),
        ).fetchone()
    return UUID(str(row[0])) if row else None


def get_stripe_customer_id(user_id: UUID) -> str | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT stripe_customer_id FROM subscriptions WHERE user_id = %s LIMIT 1",
            (str(user_id),),
        ).fetchone()
    return str(row[0]) if row else None
