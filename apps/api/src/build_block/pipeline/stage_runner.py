from dataclasses import dataclass

from build_block.bedrock.client import BedrockClient
from build_block.models import StageContext


@dataclass
class PromptTemplate:
    stage_id: str
    version: int
    template_text: str


@dataclass
class ModelBinding:
    stage_id: str
    model_id: str
    max_tokens: int = 4096
    temperature: float = 0.4


class StageRunner:
    """Runs a single pipeline stage: retrieve → prompt → model → validate."""

    def __init__(
        self,
        bedrock_client: BedrockClient,
        retrieval_service,
        prompt_loader,
    ):
        self.bedrock = bedrock_client
        self.retrieval = retrieval_service
        self.prompt_loader = prompt_loader

    def run(self, context: StageContext, binding: ModelBinding) -> str:
        prompt = self.prompt_loader.load(binding.stage_id)
        retrieved = self.retrieval.retrieve(
            query=self._retrieval_query(context),
            top_k=5,
            filters=self._filters_for_stage(binding.stage_id, context),
        )
        context.retrieved_chunks = [c.content for c in retrieved]

        rendered = self._render_prompt(prompt.template_text, context)
        return self.bedrock.converse(
            model_id=binding.model_id,
            system_message=self._system_prompt(binding.stage_id, context),
            user_message=rendered,
            max_tokens=binding.max_tokens,
            temperature=binding.temperature,
        )

    def _retrieval_query(self, context: StageContext) -> str:
        parts = [
            context.user_input.business_idea,
            context.user_input.industry,
            context.user_input.target_market,
        ]
        if context.outline:
            parts.append(" ".join(s.title for s in context.outline.sections))
        return " ".join(parts)

    def _filters_for_stage(self, stage_id: str, context: StageContext):
        from build_block.retrieval.base import RetrievalFilter

        if context.user_input.is_preview:
            return RetrievalFilter(section="executive_summary", doc_type="template", tier_gate="free")

        return RetrievalFilter(
            section=stage_id if stage_id not in {"outline", "consistency", "intake_enrichment"} else None,
            industry=context.user_input.industry,
            doc_type="template",
            tier_gate="starter",
        )

    def _render_prompt(self, template: str, context: StageContext) -> str:
        replacements = {
            "{{business_idea}}": context.user_input.business_idea,
            "{{industry}}": context.user_input.industry,
            "{{target_market}}": context.user_input.target_market,
            "{{revenue_model}}": context.user_input.revenue_model or "not specified",
            "{{retrieved_context}}": "\n\n---\n\n".join(context.retrieved_chunks),
        }
        rendered = template
        for key, value in replacements.items():
            rendered = rendered.replace(key, value)
        return rendered

    def _system_prompt(self, stage_id: str, context: StageContext) -> str:
        mode = "preview" if context.user_input.is_preview else "full plan"
        return (
            f"You are an expert business plan writer for stage '{stage_id}'. "
            f"Write in clear, investor-ready prose. Mode: {mode}. "
            "Use retrieved template context as structure guidance, not verbatim copy. "
            "Do not mention retrieval, templates, or AI."
        )
