from __future__ import annotations

import json
from typing import Any

import boto3
from botocore.exceptions import ClientError

from build_block.config import settings


class BedrockClient:
    """Thin wrapper around Bedrock Runtime for embeddings and Converse."""

    def __init__(self, region: str | None = None):
        self.region = region or settings.aws_region
        self._runtime = boto3.client("bedrock-runtime", region_name=self.region)

    def embed(self, text: str, model_id: str | None = None) -> list[float]:
        model_id = model_id or settings.bedrock_embedding_model
        body = {"inputText": text}
        if "titan-embed-text-v2" in model_id:
            body["dimensions"] = 1024
            body["normalize"] = True

        response = self._runtime.invoke_model(
            modelId=model_id,
            body=json.dumps(body),
            contentType="application/json",
            accept="application/json",
        )
        payload = json.loads(response["body"].read())
        return payload["embedding"]

    def converse(
        self,
        *,
        model_id: str,
        user_message: str,
        system_message: str | None = None,
        max_tokens: int = 4096,
        temperature: float = 0.4,
    ) -> str:
        messages = [
            {
                "role": "user",
                "content": [{"text": user_message}],
            }
        ]
        kwargs: dict[str, Any] = {
            "modelId": model_id,
            "messages": messages,
            "inferenceConfig": {
                "maxTokens": max_tokens,
                "temperature": temperature,
            },
        }
        if system_message:
            kwargs["system"] = [{"text": system_message}]

        try:
            response = self._runtime.converse(**kwargs)
        except ClientError as exc:
            raise RuntimeError(f"Bedrock converse failed for {model_id}: {exc}") from exc

        output = response.get("output", {})
        message = output.get("message", {})
        content = message.get("content", [])
        texts = [block["text"] for block in content if "text" in block]
        if not texts:
            raise RuntimeError(f"Bedrock returned no text for model {model_id}")
        return "\n".join(texts)
