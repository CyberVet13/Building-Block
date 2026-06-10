"""Lambda handler: POST /plans/{planId}/export

Generates a PDF or DOCX of the plan, uploads to S3, and returns a
15-minute presigned download URL. Enforces tier-based format access.

Body: { "format": "pdf" | "docx" }

Tier gates:
  free     → no export (preview watermarked display only)
  starter  → PDF only
  pro+     → PDF + DOCX
"""

from __future__ import annotations

import json
import os
from typing import Any
from uuid import UUID

import boto3
from botocore.exceptions import ClientError

from build_block.auth.cognito import extract_bearer, verify_token
from build_block.billing.stripe_client import TIER_PLAN_LIMITS
from build_block.db import get_or_create_user, get_subscription
from build_block.db.pool import get_conn
from build_block.export.pdf import render_pdf
from build_block.export.docx import render_docx

DOCX_TIERS = {"pro", "business"}
EXPORT_ALLOWED_TIERS = {"starter", "pro", "business"}

URL_EXPIRY_SECONDS = 900   # 15 minutes


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    try:
        headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
        token = extract_bearer(headers.get("authorization"))
        claims = verify_token(token)

        user = get_or_create_user(claims["sub"], claims.get("email", ""))
        sub = get_subscription(user.id)

        # ── Tier gate ─────────────────────────────────────────────────────
        if sub.tier not in EXPORT_ALLOWED_TIERS or sub.status not in ("active", "trialing"):
            return _err(402, "Export requires an active paid subscription. Upgrade at /pricing.")

        body = json.loads(event.get("body") or "{}")
        fmt = body.get("format", "pdf").lower()
        if fmt not in ("pdf", "docx"):
            return _err(400, f"Unknown format: {fmt}. Use 'pdf' or 'docx'.")
        if fmt == "docx" and sub.tier not in DOCX_TIERS:
            return _err(402, "DOCX export requires Pro or Business tier.")

        # ── Load plan ─────────────────────────────────────────────────────
        path_params = event.get("pathParameters") or {}
        plan_id = path_params.get("planId", "")
        plan = _load_plan(UUID(plan_id), user.id)
        if not plan:
            return _err(404, "Plan not found")

        sections: dict[str, str] = plan["content"].get("sections", {})
        title: str = plan["title"]
        is_preview: bool = plan["is_preview"]

        # Free users only get their preview displayed, not downloaded
        if is_preview and sub.tier == "free":
            return _err(402, "Upgrade to export your plan.")

        # ── Render ────────────────────────────────────────────────────────
        watermark = f"Generated for {claims.get('email', '')}" if not is_preview else "PREVIEW — Build-Block"

        if fmt == "pdf":
            file_bytes = render_pdf(
                title=title,
                sections=sections,
                is_preview=is_preview,
                generated_for=claims.get("email", ""),
            )
            content_type = "application/pdf"
            ext = "pdf"
        else:
            file_bytes = render_docx(
                title=title,
                sections=sections,
                is_preview=is_preview,
                generated_for=claims.get("email", ""),
            )
            content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ext = "docx"

        # ── Upload to S3 ──────────────────────────────────────────────────
        bucket = os.environ.get("PLANS_BUCKET", "")
        s3_key = f"exports/{user.id}/{plan_id}/{title[:40].replace(' ', '_')}.{ext}"

        s3 = boto3.client("s3")
        s3.put_object(
            Bucket=bucket,
            Key=s3_key,
            Body=file_bytes,
            ContentType=content_type,
            ServerSideEncryption="AES256",
            ContentDisposition=f'attachment; filename="{title[:50]}.{ext}"',
        )

        # ── Presigned URL (15 min TTL) ─────────────────────────────────────
        presigned_url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": s3_key},
            ExpiresIn=URL_EXPIRY_SECONDS,
        )

        return _ok({
            "download_url": presigned_url,
            "format": fmt,
            "expires_in_seconds": URL_EXPIRY_SECONDS,
            "filename": f"{title[:50]}.{ext}",
        })

    except ValueError as exc:
        return _err(401, str(exc))
    except ClientError as exc:
        return _err(500, f"Storage error: {exc}")
    except Exception as exc:
        return _err(500, str(exc))


def _load_plan(plan_id: UUID, user_id) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, title, content_json, is_preview FROM plans WHERE id = %s AND user_id = %s",
            (str(plan_id), str(user_id)),
        ).fetchone()
    if not row:
        return None
    return {
        "id": str(row[0]),
        "title": row[1],
        "content": row[2] if isinstance(row[2], dict) else json.loads(row[2]),
        "is_preview": row[3],
    }


def _ok(body: dict) -> dict:
    return {"statusCode": 200, "headers": _h(), "body": json.dumps(body)}

def _err(status: int, msg: str) -> dict:
    return {"statusCode": status, "headers": _h(), "body": json.dumps({"error": msg})}

def _h() -> dict:
    return {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
