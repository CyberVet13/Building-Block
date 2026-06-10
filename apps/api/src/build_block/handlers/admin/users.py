"""GET /admin/users  |  POST /admin/users/{id}/grant  |  POST /admin/users/{id}/suspend"""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from build_block.auth.admin import require_admin
from build_block.config import settings
from build_block.db.pool import get_conn


_DEMO_USERS = [
    {"user_id": "u-001", "email": "alice@example.com",  "role": "customer", "created_at": "2026-06-01T00:00:00Z", "tier": "pro",     "sub_status": "active",  "period_end": "2026-07-01T00:00:00Z", "total_plans": 7},
    {"user_id": "u-002", "email": "bob@example.com",    "role": "customer", "created_at": "2026-06-03T00:00:00Z", "tier": "starter", "sub_status": "active",  "period_end": "2026-07-03T00:00:00Z", "total_plans": 2},
    {"user_id": "u-003", "email": "carol@example.com",  "role": "customer", "created_at": "2026-06-05T00:00:00Z", "tier": "free",    "sub_status": "none",    "period_end": None, "total_plans": 0},
    {"user_id": "u-004", "email": "admin@build-block.com", "role": "admin", "created_at": "2026-06-01T00:00:00Z", "tier": "business","sub_status": "active",  "period_end": "2026-07-01T00:00:00Z", "total_plans": 3},
]

def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    if settings.demo_mode:
        method = (event.get("requestContext") or {}).get("http", {}).get("method", "GET")
        if method == "POST":
            path = event.get("rawPath", "")
            parts = path.strip("/").split("/")
            action = parts[-1] if parts else "unknown"
            return _ok({"message": f"Action '{action}' applied (demo)"})
        return _ok({"users": _DEMO_USERS, "count": len(_DEMO_USERS)})

    try:
        require_admin(event)

        method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
        path: str = event.get("rawPath", "/admin/users")
        params = event.get("queryStringParameters") or {}

        # Route: POST /admin/users/{id}/grant or /suspend
        if method == "POST":
            parts = path.strip("/").split("/")
            if len(parts) >= 4:
                user_id = parts[2]
                action = parts[3]
                return _mutate_user(user_id, action, event.get("body") or "{}")
            return _err(400, "Unknown action")

        # GET — list users
        limit = min(int(params.get("limit", 50)), 200)
        search = params.get("q", "")

        with get_conn() as conn:
            if search:
                rows = conn.execute(
                    """
                    SELECT u.id, u.email, u.role, u.created_at,
                           s.tier, s.status, s.current_period_end,
                           COUNT(ul.id) AS total_plans
                    FROM users u
                    LEFT JOIN subscriptions s ON s.user_id = u.id
                    LEFT JOIN usage_ledger ul ON ul.user_id = u.id AND ul.billed_as_plan = true
                    WHERE u.email ILIKE %s
                    GROUP BY u.id, s.tier, s.status, s.current_period_end
                    ORDER BY u.created_at DESC
                    LIMIT %s
                    """,
                    (f"%{search}%", limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT u.id, u.email, u.role, u.created_at,
                           s.tier, s.status, s.current_period_end,
                           COUNT(ul.id) AS total_plans
                    FROM users u
                    LEFT JOIN subscriptions s ON s.user_id = u.id
                    LEFT JOIN usage_ledger ul ON ul.user_id = u.id AND ul.billed_as_plan = true
                    GROUP BY u.id, s.tier, s.status, s.current_period_end
                    ORDER BY u.created_at DESC
                    LIMIT %s
                    """,
                    (limit,),
                ).fetchall()

        users = [
            {
                "user_id": str(r[0]),
                "email": r[1],
                "role": r[2],
                "created_at": str(r[3]),
                "tier": r[4] or "free",
                "sub_status": r[5] or "none",
                "period_end": str(r[6]) if r[6] else None,
                "total_plans": r[7],
            }
            for r in rows
        ]

        return _ok({"users": users, "count": len(users)})

    except PermissionError as exc:
        return _err(403, str(exc))
    except ValueError as exc:
        return _err(401, str(exc))
    except Exception as exc:
        return _err(500, str(exc))


def _mutate_user(user_id: str, action: str, body_str: str) -> dict:
    body = json.loads(body_str)

    with get_conn() as conn:
        if action == "grant":
            tier = body.get("tier", "starter")
            conn.execute(
                """
                INSERT INTO subscriptions (user_id, stripe_customer_id, tier, status, plans_per_period)
                VALUES (%s, 'manual', %s, 'active', %s)
                ON CONFLICT (user_id) DO UPDATE
                  SET tier = EXCLUDED.tier,
                      status = 'active',
                      plans_per_period = EXCLUDED.plans_per_period,
                      updated_at = now()
                """,
                (user_id, tier, {"starter": 3, "pro": 10, "business": 30}.get(tier, 0)),
            )
            conn.commit()
            return _ok({"message": f"Granted {tier} to {user_id}"})

        if action == "suspend":
            conn.execute(
                "UPDATE subscriptions SET status = 'canceled' WHERE user_id = %s",
                (user_id,),
            )
            conn.commit()
            return _ok({"message": f"Suspended {user_id}"})

        if action == "promote":
            conn.execute(
                "UPDATE users SET role = 'admin' WHERE id = %s",
                (user_id,),
            )
            conn.commit()
            return _ok({"message": f"Promoted {user_id} to admin"})

    return _err(400, f"Unknown action: {action}")


def _ok(body: dict) -> dict:
    return {"statusCode": 200, "headers": _h(), "body": json.dumps(body, default=str)}

def _err(status: int, msg: str) -> dict:
    return {"statusCode": status, "headers": _h(), "body": json.dumps({"error": msg})}

def _h() -> dict:
    return {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
