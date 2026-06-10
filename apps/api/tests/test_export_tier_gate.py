"""Tests for the export tier gate logic (no Lambda invocation, no S3)."""

import json
from unittest.mock import MagicMock, patch
from uuid import UUID

from build_block.db.users import SubscriptionRow, UserRow

_USER = UserRow(
    id=UUID("00000000-0000-0000-0000-000000000001"),
    cognito_sub="u1",
    email="test@x.com",
    role="customer",
)


def _sub(tier: str) -> SubscriptionRow:
    return SubscriptionRow(
        user_id=_USER.id,
        tier=tier,
        status="active",
        plans_per_period=10,
        current_period_start=None,
        current_period_end=None,
    )


def _plan(is_preview: bool = False) -> dict:
    return {
        "id": "00000000-0000-0000-0000-000000000099",
        "title": "My Test Plan",
        "content": {"sections": {"executive_summary": "Summary text."}},
        "is_preview": is_preview,
    }


def _event(fmt: str = "pdf") -> dict:
    return {
        "headers": {"authorization": "Bearer dev"},
        "pathParameters": {"planId": "00000000-0000-0000-0000-000000000099"},
        "body": json.dumps({"format": fmt}),
    }


def _run_export(tier: str, fmt: str = "pdf", is_preview: bool = False) -> dict:
    from build_block.handlers import export

    s3_mock = MagicMock()
    s3_mock.generate_presigned_url.return_value = "https://s3.example.com/file"

    with (
        patch.object(export, "extract_bearer", return_value="tok"),
        patch.object(export, "verify_token", return_value={"sub": "u1", "email": "test@x.com"}),
        patch.object(export, "get_or_create_user", return_value=_USER),
        patch.object(export, "get_subscription", return_value=_sub(tier)),
        patch.object(export, "_load_plan", return_value=_plan(is_preview)),
        patch("build_block.handlers.export.boto3") as mock_boto3,
    ):
        mock_boto3.client.return_value = s3_mock
        return export.handler(_event(fmt), None)


# ── Allowed cases ─────────────────────────────────────────────────────────────

def test_starter_pdf_allowed():
    res = _run_export("starter", "pdf")
    assert res["statusCode"] == 200
    assert "download_url" in json.loads(res["body"])


def test_pro_pdf_allowed():
    res = _run_export("pro", "pdf")
    assert res["statusCode"] == 200


def test_pro_docx_allowed():
    res = _run_export("pro", "docx")
    assert res["statusCode"] == 200


def test_business_docx_allowed():
    res = _run_export("business", "docx")
    assert res["statusCode"] == 200


# ── Blocked cases ─────────────────────────────────────────────────────────────

def test_starter_docx_blocked():
    res = _run_export("starter", "docx")
    assert res["statusCode"] == 402
    assert "Pro" in json.loads(res["body"])["error"]


def test_free_full_plan_blocked():
    res = _run_export("free", "pdf", is_preview=False)
    assert res["statusCode"] == 402


def test_free_preview_blocked():
    res = _run_export("free", "pdf", is_preview=True)
    assert res["statusCode"] == 402


def test_unknown_format_rejected():
    from build_block.handlers import export
    with (
        patch.object(export, "extract_bearer", return_value="tok"),
        patch.object(export, "verify_token", return_value={"sub": "u1", "email": "test@x.com"}),
        patch.object(export, "get_or_create_user", return_value=_USER),
        patch.object(export, "get_subscription", return_value=_sub("pro")),
        patch.object(export, "_load_plan", return_value=_plan()),
    ):
        bad_event = {
            "headers": {"authorization": "Bearer dev"},
            "pathParameters": {"planId": "00000000-0000-0000-0000-000000000099"},
            "body": json.dumps({"format": "html"}),
        }
        res = export.handler(bad_event, None)
    assert res["statusCode"] == 400
