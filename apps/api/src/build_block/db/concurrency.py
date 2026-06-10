"""Per-user concurrent job limit.

Prevents a single user from holding many in-flight generation jobs simultaneously,
which would bypass plan-count limits and run up Bedrock costs.

Limits (by tier):
  free     — 1 concurrent preview
  starter  — 1 concurrent job
  pro      — 2 concurrent jobs
  business — 3 concurrent jobs
"""

from __future__ import annotations

from uuid import UUID

from build_block.db.pool import get_conn

CONCURRENCY_LIMITS: dict[str, int] = {
    "free":     1,
    "starter":  1,
    "pro":      2,
    "business": 3,
}


def count_active_jobs(user_id: UUID) -> int:
    """Count jobs in 'reserved' or 'running' state for this user."""
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) FROM generation_jobs
            WHERE user_id = %s AND status IN ('reserved', 'running')
            """,
            (str(user_id),),
        ).fetchone()
    return row[0] if row else 0


def check_concurrency_allowed(user_id: UUID, tier: str) -> tuple[bool, str | None]:
    """Return (allowed, error_message)."""
    limit = CONCURRENCY_LIMITS.get(tier, 1)
    active = count_active_jobs(user_id)
    if active >= limit:
        return False, (
            f"You already have {active} generation{'s' if active > 1 else ''} in progress. "
            f"Wait for {'them' if active > 1 else 'it'} to complete before starting another."
        )
    return True, None
