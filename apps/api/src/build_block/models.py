from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class GenerationInput(BaseModel):
    business_idea: str = Field(min_length=20, max_length=2000)
    industry: str
    target_market: str
    stage: str = "idea"
    revenue_model: str | None = None
    geography: str | None = None
    is_preview: bool = False


class OutlineSection(BaseModel):
    id: str
    title: str
    key_points: list[str]


class OutlineOutput(BaseModel):
    sections: list[OutlineSection]
    assumptions: list[str]
    industry_tags: list[str]


class StageContext(BaseModel):
    stage_id: str
    user_input: GenerationInput
    outline: OutlineOutput | None = None
    prior_sections: dict[str, str] = Field(default_factory=dict)
    retrieved_chunks: list[str] = Field(default_factory=list)


class UsageCheckResult(BaseModel):
    allowed: bool
    tier: str
    plans_used: int
    plans_limit: int
    is_preview: bool
    message: str | None = None


class GenerationJob(BaseModel):
    id: UUID
    user_id: UUID
    status: str
    is_preview: bool
    input_json: dict[str, Any]
    created_at: datetime
