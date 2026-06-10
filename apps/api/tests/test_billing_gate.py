"""Tests for the generation entitlement / billing gate."""

import pytest
from build_block.billing.usage import check_generation_allowed
from build_block.models import GenerationInput


def _input(is_preview: bool = False) -> GenerationInput:
    return GenerationInput(
        business_idea="A platform that connects dog walkers with owners",
        industry="marketplace",
        target_market="urban dog owners",
        is_preview=is_preview,
    )


# ── Preview always allowed ────────────────────────────────────────────────────

def test_preview_always_allowed_on_free():
    result = check_generation_allowed(tier="free", plans_used_in_period=0, input_data=_input(True))
    assert result.allowed is True
    assert result.is_preview is True


def test_preview_does_not_count_on_paid():
    result = check_generation_allowed(tier="starter", plans_used_in_period=3, input_data=_input(True))
    assert result.allowed is True
    assert "not count" in (result.message or "").lower()


# ── Free tier blocks full generation ─────────────────────────────────────────

def test_free_tier_blocks_full_generation():
    result = check_generation_allowed(tier="free", plans_used_in_period=0, input_data=_input(False))
    assert result.allowed is False
    assert result.plans_limit == 0


# ── Starter tier ──────────────────────────────────────────────────────────────

def test_starter_allows_within_limit():
    result = check_generation_allowed(tier="starter", plans_used_in_period=2, input_data=_input())
    assert result.allowed is True
    assert result.plans_limit == 3


def test_starter_blocks_at_limit():
    result = check_generation_allowed(tier="starter", plans_used_in_period=3, input_data=_input())
    assert result.allowed is False
    assert "limit" in result.message.lower()


def test_starter_blocks_over_limit():
    result = check_generation_allowed(tier="starter", plans_used_in_period=5, input_data=_input())
    assert result.allowed is False


# ── Pro tier ──────────────────────────────────────────────────────────────────

def test_pro_allows_up_to_10():
    result = check_generation_allowed(tier="pro", plans_used_in_period=9, input_data=_input())
    assert result.allowed is True
    assert result.plans_limit == 10


def test_pro_blocks_at_10():
    result = check_generation_allowed(tier="pro", plans_used_in_period=10, input_data=_input())
    assert result.allowed is False


# ── Business tier ─────────────────────────────────────────────────────────────

def test_business_allows_up_to_30():
    result = check_generation_allowed(tier="business", plans_used_in_period=29, input_data=_input())
    assert result.allowed is True
    assert result.plans_limit == 30


def test_business_blocks_at_30():
    result = check_generation_allowed(tier="business", plans_used_in_period=30, input_data=_input())
    assert result.allowed is False


# ── Unknown tier treated as 0 ─────────────────────────────────────────────────

def test_unknown_tier_blocks():
    result = check_generation_allowed(tier="enterprise", plans_used_in_period=0, input_data=_input())
    assert result.allowed is False
