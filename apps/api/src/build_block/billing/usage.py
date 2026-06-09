from datetime import datetime, timezone

from build_block.config import settings
from build_block.models import GenerationInput, UsageCheckResult


def check_generation_allowed(
    *,
    tier: str,
    plans_used_in_period: int,
    input_data: GenerationInput,
) -> UsageCheckResult:
    """Enforce subscription limits before starting a job."""

    if input_data.is_preview:
        return UsageCheckResult(
            allowed=True,
            tier=tier,
            plans_used=plans_used_in_period,
            plans_limit=settings.plans_limit_for_tier(tier),
            is_preview=True,
            message="Preview generation does not count against plan limit.",
        )

    limit = settings.plans_limit_for_tier(tier)
    if plans_used_in_period >= limit:
        return UsageCheckResult(
            allowed=False,
            tier=tier,
            plans_used=plans_used_in_period,
            plans_limit=limit,
            is_preview=False,
            message="Plan limit reached for this billing period. Upgrade to continue.",
        )

    return UsageCheckResult(
        allowed=True,
        tier=tier,
        plans_used=plans_used_in_period,
        plans_limit=limit,
        is_preview=False,
    )


def current_billing_period() -> tuple[datetime, datetime]:
    """Placeholder — replace with Stripe subscription period from DB."""
    now = datetime.now(timezone.utc)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return start, now
