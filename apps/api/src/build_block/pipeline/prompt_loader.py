from pathlib import Path

from build_block.pipeline.stage_runner import PromptTemplate

DEFAULT_PROMPTS: dict[str, str] = {
    "preview": """Write a one-page executive summary preview for this business.

Business idea: {{business_idea}}
Industry: {{industry}}
Target market: {{target_market}}
Revenue model: {{revenue_model}}

Use this template context for structure:
{{retrieved_context}}

End with a single line: [PREVIEW — Subscribe to unlock full plan]""",
    "outline": """Create a JSON outline for a full business plan.

Business idea: {{business_idea}}
Industry: {{industry}}
Target market: {{target_market}}

Template context:
{{retrieved_context}}

Return JSON with keys: sections (id, title, key_points), assumptions, industry_tags.""",
    "executive_summary": """Write the Executive Summary section.

{{retrieved_context}}

Business: {{business_idea}} | Industry: {{industry}} | Market: {{target_market}}""",
}


class PromptLoader:
    """Load prompts from DB in production; file/defaults for local dev."""

    def __init__(self, prompts_dir: Path | None = None):
        self.prompts_dir = prompts_dir

    def load(self, stage_id: str) -> PromptTemplate:
        if self.prompts_dir:
            path = self.prompts_dir / f"{stage_id}.md"
            if path.exists():
                return PromptTemplate(stage_id=stage_id, version=1, template_text=path.read_text())

        template = DEFAULT_PROMPTS.get(
            stage_id,
            """Write the '{{stage}}' section of a business plan.

Business idea: {{business_idea}}
Industry: {{industry}}
Target market: {{target_market}}
Revenue model: {{revenue_model}}

Template context:
{{retrieved_context}}""".replace("{{stage}}", stage_id),
        )
        return PromptTemplate(stage_id=stage_id, version=1, template_text=template)
