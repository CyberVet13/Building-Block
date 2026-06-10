"""GET /admin/prompts  |  POST /admin/prompts  — versioned prompt editor."""

from __future__ import annotations

import json
from typing import Any

from build_block.auth.admin import require_admin
from build_block.config import settings
from build_block.db.pool import get_conn


_DEMO_STAGES = [
    {"stage_id": s, "display_name": n, "sort_order": i, "default_model": m,
     "active_prompt": {"prompt_id": f"p-{s}", "version": 1, "template_text": f"Write the {n} section.\n\nBusiness idea: {{{{business_idea}}}}\nIndustry: {{{{industry}}}}\n\n{{{{retrieved_context}}}}", "is_active": True},
     "retrieval": {"top_k": 5, "filters": {}}, "versions": [{"version": 1, "is_active": True, "created_at": "2026-06-10T00:00:00Z"}]}
    for i, (s, n, m) in enumerate([
        ("outline", "Outline", "claude-3-5-sonnet"),
        ("market_analysis", "Market Analysis", "claude-3-5-sonnet"),
        ("financials", "Financial Projections", "claude-3-5-sonnet"),
        ("competitive_landscape", "Competitive Landscape", "claude-3-5-sonnet"),
        ("executive_summary", "Executive Summary", "claude-3-5-sonnet"),
        ("consistency", "Consistency Pass", "claude-3-haiku"),
    ])
]

def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    if settings.demo_mode:
        method = (event.get("requestContext") or {}).get("http", {}).get("method", "GET")
        if method == "POST":
            body = json.loads(event.get("body") or "{}")
            return _ok({"message": f"Saved prompt v2 for {body.get('stage_id', '?')} (demo)", "version": 2})
        return _ok({"stages": _DEMO_STAGES})

    try:
        require_admin(event)

        method = event.get("requestContext", {}).get("http", {}).get("method", "GET")

        if method == "POST":
            return _save_prompt(json.loads(event.get("body") or "{}"))

        # GET — list all stages with their active prompt version
        with get_conn() as conn:
            stages = conn.execute(
                """
                SELECT ps.id, ps.display_name, ps.sort_order, ps.default_model,
                       pt.id AS prompt_id, pt.version, pt.template_text, pt.is_active,
                       rp.top_k, rp.filters_json
                FROM pipeline_stages ps
                LEFT JOIN prompt_templates pt
                  ON pt.stage_id = ps.id AND pt.is_active = true
                LEFT JOIN retrieval_policies rp ON rp.stage_id = ps.id
                ORDER BY ps.sort_order
                """
            ).fetchall()

            all_versions = conn.execute(
                """
                SELECT stage_id, version, is_active, created_at
                FROM prompt_templates
                ORDER BY stage_id, version DESC
                """
            ).fetchall()

        version_map: dict[str, list] = {}
        for v in all_versions:
            version_map.setdefault(v[0], []).append({
                "version": v[1],
                "is_active": v[2],
                "created_at": str(v[3]),
            })

        result = [
            {
                "stage_id": r[0],
                "display_name": r[1],
                "sort_order": r[2],
                "default_model": r[3],
                "active_prompt": {
                    "prompt_id": str(r[4]) if r[4] else None,
                    "version": r[5],
                    "template_text": r[6],
                    "is_active": r[7],
                } if r[4] else None,
                "retrieval": {
                    "top_k": r[8] or 5,
                    "filters": r[9] or {},
                },
                "versions": version_map.get(r[0], []),
            }
            for r in stages
        ]

        return _ok({"stages": result})

    except PermissionError as exc:
        return _err(403, str(exc))
    except ValueError as exc:
        return _err(401, str(exc))
    except Exception as exc:
        return _err(500, str(exc))


def _save_prompt(body: dict) -> dict:
    """Save a new prompt version and optionally activate it."""
    stage_id = body.get("stage_id")
    template_text = body.get("template_text", "").strip()
    activate = bool(body.get("activate", True))

    if not stage_id or not template_text:
        return _err(400, "stage_id and template_text are required")

    with get_conn() as conn:
        # Next version number
        row = conn.execute(
            "SELECT COALESCE(MAX(version), 0) FROM prompt_templates WHERE stage_id = %s",
            (stage_id,),
        ).fetchone()
        next_version = row[0] + 1

        conn.execute(
            """
            INSERT INTO prompt_templates (stage_id, version, template_text, is_active)
            VALUES (%s, %s, %s, %s)
            """,
            (stage_id, next_version, template_text, activate),
        )

        if activate:
            conn.execute(
                """
                UPDATE prompt_templates
                SET is_active = false
                WHERE stage_id = %s AND version != %s
                """,
                (stage_id, next_version),
            )

        conn.commit()

    return _ok({"message": f"Saved prompt v{next_version} for {stage_id}", "version": next_version})


def _ok(body: dict) -> dict:
    return {"statusCode": 200, "headers": _h(), "body": json.dumps(body, default=str)}

def _err(status: int, msg: str) -> dict:
    return {"statusCode": status, "headers": _h(), "body": json.dumps({"error": msg})}

def _h() -> dict:
    return {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
