from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from build_block.db.pool import get_conn


@dataclass
class UserRow:
    id: UUID
    cognito_sub: str
    email: str
    role: str


@dataclass
class SubscriptionRow:
    user_id: UUID
    tier: str
    status: str
    plans_per_period: int
    current_period_start: datetime | None
    current_period_end: datetime | None


def get_or_create_user(cognito_sub: str, email: str) -> UserRow:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, cognito_sub, email, role FROM users WHERE cognito_sub = %s",
            (cognito_sub,),
        ).fetchone()

        if row:
            return UserRow(*row)

        row = conn.execute(
            """
            INSERT INTO users (cognito_sub, email)
            VALUES (%s, %s)
            RETURNING id, cognito_sub, email, role
            """,
            (cognito_sub, email),
        ).fetchone()
        conn.commit()
        return UserRow(*row)


def get_subscription(user_id: UUID) -> SubscriptionRow:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT user_id, tier, status, plans_per_period,
                   current_period_start, current_period_end
            FROM subscriptions
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (str(user_id),),
        ).fetchone()

        if row:
            return SubscriptionRow(*row)

        # No subscription row yet — treat as free
        return SubscriptionRow(
            user_id=user_id,
            tier="free",
            status="active",
            plans_per_period=0,
            current_period_start=None,
            current_period_end=None,
        )


def count_plans_used_in_period(user_id: UUID, sub: SubscriptionRow) -> int:
    """Count billed (non-preview) plans since current period start."""
    with get_conn() as conn:
        if sub.current_period_start:
            row = conn.execute(
                """
                SELECT COUNT(*) FROM usage_ledger
                WHERE user_id = %s
                  AND billed_as_plan = true
                  AND created_at >= %s
                """,
                (str(user_id), sub.current_period_start),
            ).fetchone()
        else:
            # No Stripe period yet — count all time
            row = conn.execute(
                "SELECT COUNT(*) FROM usage_ledger WHERE user_id = %s AND billed_as_plan = true",
                (str(user_id),),
            ).fetchone()
        return row[0] if row else 0
