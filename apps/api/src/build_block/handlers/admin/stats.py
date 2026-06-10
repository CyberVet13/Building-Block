"""GET /admin/stats — key metrics for the dashboard overview."""

from __future__ import annotations

import json
from typing import Any

from build_block.auth.admin import require_admin
from build_block.db.pool import get_conn


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    try:
        require_admin(event)

        with get_conn() as conn:
            # Active subscriptions by tier
            tiers = conn.execute(
                """
                SELECT tier, COUNT(*) AS cnt
                FROM subscriptions
                WHERE status = 'active'
                GROUP BY tier
                ORDER BY tier
                """
            ).fetchall()

            # Plans generated last 30 days
            plans_30d = conn.execute(
                """
                SELECT COUNT(*) FROM usage_ledger
                WHERE billed_as_plan = true
                  AND created_at >= now() - INTERVAL '30 days'
                """
            ).fetchone()[0]

            # Previews generated last 30 days
            previews_30d = conn.execute(
                """
                SELECT COUNT(*) FROM usage_ledger
                WHERE billed_as_plan = false
                  AND created_at >= now() - INTERVAL '30 days'
                """
            ).fetchone()[0]

            # Estimated token cost last 30 days
            cost_30d = conn.execute(
                """
                SELECT COALESCE(SUM(estimated_cost_usd), 0)
                FROM usage_ledger
                WHERE created_at >= now() - INTERVAL '30 days'
                """
            ).fetchone()[0]

            # Failed jobs last 7 days
            failed_7d = conn.execute(
                """
                SELECT COUNT(*) FROM generation_jobs
                WHERE status = 'failed'
                  AND created_at >= now() - INTERVAL '7 days'
                """
            ).fetchone()[0]

            # New users last 30 days
            new_users_30d = conn.execute(
                """
                SELECT COUNT(*) FROM users
                WHERE created_at >= now() - INTERVAL '30 days'
                """
            ).fetchone()[0]

            # Plans per day last 14 days
            daily = conn.execute(
                """
                SELECT DATE(created_at) AS day, COUNT(*) AS cnt
                FROM usage_ledger
                WHERE billed_as_plan = true
                  AND created_at >= now() - INTERVAL '14 days'
                GROUP BY day
                ORDER BY day
                """
            ).fetchall()

        return _ok({
            "subscriptions_by_tier": {row[0]: row[1] for row in tiers},
            "plans_30d": plans_30d,
            "previews_30d": previews_30d,
            "estimated_cost_usd_30d": float(cost_30d),
            "failed_jobs_7d": failed_7d,
            "new_users_30d": new_users_30d,
            "plans_per_day_14d": [{"day": str(r[0]), "count": r[1]} for r in daily],
        })

    except PermissionError as exc:
        return _err(403, str(exc))
    except ValueError as exc:
        return _err(401, str(exc))
    except Exception as exc:
        return _err(500, str(exc))


def _ok(body: dict) -> dict:
    return {"statusCode": 200, "headers": _h(), "body": json.dumps(body, default=str)}

def _err(status: int, msg: str) -> dict:
    return {"statusCode": status, "headers": _h(), "body": json.dumps({"error": msg})}

def _h() -> dict:
    return {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
