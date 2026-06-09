from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://postgres:dev@localhost:5432/buildblock"
    aws_region: str = "us-east-1"
    aws_account_id: str = "058170691476"

    bedrock_embedding_model: str = "amazon.titan-embed-text-v2:0"
    bedrock_fast_model: str = "anthropic.claude-3-haiku-20240307-v1:0"
    bedrock_quality_model: str = "anthropic.claude-3-5-sonnet-20241022-v2:0"

    corpus_bucket: str = "build-block-corpus-dev"
    plans_bucket: str = "build-block-plans-dev"

    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""

    tier_limit_free: int = 0
    tier_limit_starter: int = 3
    tier_limit_pro: int = 10
    tier_limit_business: int = 30

    def plans_limit_for_tier(self, tier: str) -> int:
        return {
            "free": self.tier_limit_free,
            "starter": self.tier_limit_starter,
            "pro": self.tier_limit_pro,
            "business": self.tier_limit_business,
        }.get(tier, 0)


settings = Settings()
