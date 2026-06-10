"""Tests for per-user concurrent job limits."""

from unittest.mock import patch
from uuid import UUID

from build_block.db.concurrency import check_concurrency_allowed

USER = UUID("00000000-0000-0000-0000-000000000001")


def _check(tier: str, active: int) -> tuple[bool, str | None]:
    with patch("build_block.db.concurrency.count_active_jobs", return_value=active):
        return check_concurrency_allowed(USER, tier)


def test_free_allows_zero_active():
    allowed, _ = _check("free", 0)
    assert allowed is True


def test_free_blocks_at_one():
    allowed, msg = _check("free", 1)
    assert allowed is False
    assert msg is not None


def test_starter_allows_zero():
    allowed, _ = _check("starter", 0)
    assert allowed is True


def test_starter_blocks_at_one():
    allowed, _ = _check("starter", 1)
    assert allowed is False


def test_pro_allows_one():
    allowed, _ = _check("pro", 1)
    assert allowed is True


def test_pro_blocks_at_two():
    allowed, _ = _check("pro", 2)
    assert allowed is False


def test_business_allows_two():
    allowed, _ = _check("business", 2)
    assert allowed is True


def test_business_blocks_at_three():
    allowed, _ = _check("business", 3)
    assert allowed is False


def test_unknown_tier_defaults_to_one():
    allowed, _ = _check("enterprise", 0)
    assert allowed is True

    allowed, _ = _check("enterprise", 1)
    assert allowed is False


def test_error_message_mentions_in_progress():
    _, msg = _check("starter", 1)
    assert "progress" in msg.lower()
