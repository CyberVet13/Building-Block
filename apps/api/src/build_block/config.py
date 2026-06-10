from __future__ import annotations

import json
import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── Direct env vars (set in .env for local dev) ───────────────────────
    database_url: str = ""
    aws_region: str = "us-east-1"
    aws_account_id: str = "058170691476"

    bedrock_embedding_model: str = "amazon.titan-embed-text-v2:0"
    bedrock_fast_model: str = "anthropic.claude-3-haiku-20240307-v1:0"
    bedrock_quality_model: str = "anthropic.claude-3-5-sonnet-20241022-v2:0"

    corpus_bucket: str = "build-block-corpus-dev"
    plans_bucket: str = "build-block-plans-dev"

    # Production: resolved from Secrets Manager ARNs below
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""

    web_url: str = "http://localhost:3000"

    # Secrets Manager ARNs (set by CDK)
    db_secret_arn: str = ""
    stripe_secret_arn: str = ""
    db_host: str = ""
    db_name: str = "buildblock"

    # Demo mode: return fixture data, skip DB and Bedrock entirely
    demo_mode: bool = False

    # Tier limits (override in .env if needed)
    tier_limit_free: int = 0
    tier_limit_starter: int = 3
    tier_limit_pro: int = 10
    tier_limit_business: int = 30

    def plans_limit_for_tier(self, tier: str) -> int:
        return {
            "free":     self.tier_limit_free,
            "starter":  self.tier_limit_starter,
            "pro":      self.tier_limit_pro,
            "business": self.tier_limit_business,
        }.get(tier, 0)

    def resolved_database_url(self) -> str:
        """Return DATABASE_URL, fetching DB password from Secrets Manager if needed."""
        if self.database_url:
            return self.database_url
        if self.db_secret_arn and self.db_host:
            creds = _fetch_secret(self.db_secret_arn)
            password = creds.get("password", "")
            username = creds.get("username", "buildblock_app")
            return f"postgresql://{username}:{password}@{self.db_host}:5432/{self.db_name}"
        raise RuntimeError("No DATABASE_URL or DB_SECRET_ARN configured")

    def resolved_stripe_key(self) -> str:
        if self.stripe_secret_key:
            return self.stripe_secret_key
        if self.stripe_secret_arn:
            return _fetch_secret(self.stripe_secret_arn).get("secret_key", "")
        return ""

    def resolved_stripe_webhook_secret(self) -> str:
        if self.stripe_webhook_secret:
            return self.stripe_webhook_secret
        if self.stripe_secret_arn:
            return _fetch_secret(self.stripe_secret_arn).get("webhook_secret", "")
        return ""


@lru_cache(maxsize=8)
def _fetch_secret(secret_arn: str) -> dict:
    """Fetch and cache a Secrets Manager secret value (JSON)."""
    import boto3
    client = boto3.client("secretsmanager", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    resp = client.get_secret_value(SecretId=secret_arn)
    raw = resp.get("SecretString", "{}")
    return json.loads(raw)


settings = Settings()
