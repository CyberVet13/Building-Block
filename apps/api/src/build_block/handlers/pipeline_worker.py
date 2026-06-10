"""Lambda handler invoked by Step Functions for each pipeline stage.

Step Functions passes:
  {
    "job_id": "...",
    "user_id": "...",
    "tier": "starter",
    "is_preview": false,
    "stage": "outline" | "market_analysis" | ...,
    "input": { GenerationInput fields },
    "prior_sections": { "outline": "...", ... },   # accumulated
    "outline": { OutlineOutput fields } | null
  }

Returns the stage output (string or dict) to be merged into the execution state.
"""

from __future__ import annotations

import json
from typing import Any

from build_block.bedrock.client import BedrockClient
from build_block.config import settings
from build_block.db import update_job_status
from build_block.models import GenerationInput, OutlineOutput, StageContext
from build_block.pipeline.prompt_loader import PromptLoader
from build_block.pipeline.stage_runner import ModelBinding, StageRunner
from build_block.retrieval import PgVectorRetrievalService

_bedrock = BedrockClient()
_retrieval = PgVectorRetrievalService(
    database_url=settings.database_url,
    embed_fn=_bedrock.embed,
)
_prompt_loader = PromptLoader()
_runner = StageRunner(
    bedrock_client=_bedrock,
    retrieval_service=_retrieval,
    prompt_loader=_prompt_loader,
)

FAST_STAGES = {"intake_enrichment", "consistency"}


def handler(event: dict[str, Any], _context: Any) -> dict[str, Any]:
    job_id = event["job_id"]
    stage_id = event["stage"]

    try:
        update_job_status(job_id, status="running", stage=stage_id)

        user_input = GenerationInput(**event["input"])

        outline_data = event.get("outline")
        outline = OutlineOutput(**outline_data) if outline_data else None

        ctx = StageContext(
            stage_id=stage_id,
            user_input=user_input,
            outline=outline,
            prior_sections=event.get("prior_sections", {}),
        )

        model_id = (
            settings.bedrock_fast_model
            if stage_id in FAST_STAGES
            else settings.bedrock_quality_model
        )
        binding = ModelBinding(stage_id=stage_id, model_id=model_id)
        output_text = _runner.run(ctx, binding)

        # For the outline stage, parse JSON
        result: dict[str, Any] = {"stage": stage_id, "output": output_text}
        if stage_id == "outline":
            try:
                parsed = json.loads(output_text)
                result["outline"] = parsed
            except json.JSONDecodeError:
                result["outline"] = None

        return result

    except Exception as exc:
        update_job_status(job_id, status="failed", stage=stage_id, error_message=str(exc))
        raise
