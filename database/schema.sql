-- Build-Block v1 schema (Aurora PostgreSQL + pgvector)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Users (Cognito sub is source of truth for identity)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cognito_sub     TEXT NOT NULL UNIQUE,
    email           TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Subscriptions (synced from Stripe webhooks)
-- ---------------------------------------------------------------------------
CREATE TABLE subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id      TEXT NOT NULL,
    stripe_subscription_id  TEXT UNIQUE,
    tier                    TEXT NOT NULL DEFAULT 'free'
                            CHECK (tier IN ('free', 'starter', 'pro', 'business')),
    status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
    plans_per_period        INT NOT NULL DEFAULT 0,
    current_period_start    TIMESTAMPTZ,
    current_period_end      TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

-- Tier limits (reference; enforced in app from tier column)
-- free: 0 full plans (preview only)
-- starter: 3, pro: 10, business: 30

-- ---------------------------------------------------------------------------
-- Business plans (generated output)
-- ---------------------------------------------------------------------------
CREATE TABLE plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    industry        TEXT,
    content_json    JSONB NOT NULL DEFAULT '{}',
    is_preview      BOOLEAN NOT NULL DEFAULT false,
    version         INT NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plans_user ON plans(user_id);

-- ---------------------------------------------------------------------------
-- Generation jobs
-- ---------------------------------------------------------------------------
CREATE TABLE generation_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id         UUID REFERENCES plans(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'reserved'
                    CHECK (status IN ('reserved', 'running', 'completed', 'failed', 'canceled')),
    is_preview      BOOLEAN NOT NULL DEFAULT false,
    input_json      JSONB NOT NULL,
    error_message   TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_user_status ON generation_jobs(user_id, status);

-- ---------------------------------------------------------------------------
-- Usage ledger (immutable; 1 row per billed plan)
-- ---------------------------------------------------------------------------
CREATE TABLE usage_ledger (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id          UUID NOT NULL REFERENCES generation_jobs(id),
    plan_id         UUID REFERENCES plans(id),
    billed_as_plan  BOOLEAN NOT NULL DEFAULT true,
    tokens_by_stage JSONB NOT NULL DEFAULT '{}',
    estimated_cost_usd NUMERIC(10, 6),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_user_period ON usage_ledger(user_id, created_at);

-- ---------------------------------------------------------------------------
-- Prompt registry (versioned, admin-tunable)
-- ---------------------------------------------------------------------------
CREATE TABLE pipeline_stages (
    id              TEXT PRIMARY KEY,
    display_name    TEXT NOT NULL,
    sort_order      INT NOT NULL,
    default_model   TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prompt_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id        TEXT NOT NULL REFERENCES pipeline_stages(id),
    version         INT NOT NULL,
    template_text   TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (stage_id, version)
);

CREATE TABLE retrieval_policies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id        TEXT NOT NULL REFERENCES pipeline_stages(id) UNIQUE,
    top_k           INT NOT NULL DEFAULT 5,
    filters_json    JSONB NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Corpus metadata (vectors stored in corpus_chunks)
-- ---------------------------------------------------------------------------
CREATE TABLE corpus_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    s3_key          TEXT NOT NULL UNIQUE,
    doc_type        TEXT NOT NULL CHECK (doc_type IN ('template', 'example', 'framework')),
    section         TEXT NOT NULL,
    industry        TEXT NOT NULL DEFAULT 'general',
    tier_gate       TEXT NOT NULL DEFAULT 'starter' CHECK (tier_gate IN ('free', 'starter', 'pro', 'business')),
    version         TEXT NOT NULL DEFAULT 'v1',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    chunk_count     INT NOT NULL DEFAULT 0,
    ingested_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE corpus_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID NOT NULL REFERENCES corpus_documents(id) ON DELETE CASCADE,
    chunk_index     INT NOT NULL,
    content         TEXT NOT NULL,
    metadata_json   JSONB NOT NULL DEFAULT '{}',
    embedding       vector(1024),  -- Titan Embeddings v2 dimension
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_corpus_chunks_document ON corpus_chunks(document_id);
CREATE INDEX idx_corpus_chunks_embedding ON corpus_chunks
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ---------------------------------------------------------------------------
-- Seed pipeline stages
-- ---------------------------------------------------------------------------
INSERT INTO pipeline_stages (id, display_name, sort_order, default_model) VALUES
    ('intake_enrichment', 'Intake Enrichment', 1, 'anthropic.claude-3-haiku-20240307-v1:0'),
    ('outline', 'Outline', 2, 'anthropic.claude-3-5-sonnet-20241022-v2:0'),
    ('market_analysis', 'Market Analysis', 3, 'anthropic.claude-3-5-sonnet-20241022-v2:0'),
    ('competitive_landscape', 'Competitive Landscape', 4, 'anthropic.claude-3-5-sonnet-20241022-v2:0'),
    ('financials', 'Financial Projections', 5, 'anthropic.claude-3-5-sonnet-20241022-v2:0'),
    ('operations', 'Operations Plan', 6, 'anthropic.claude-3-5-sonnet-20241022-v2:0'),
    ('consistency', 'Consistency Pass', 7, 'anthropic.claude-3-haiku-20240307-v1:0'),
    ('executive_summary', 'Executive Summary', 8, 'anthropic.claude-3-5-sonnet-20241022-v2:0'),
    ('preview', 'Preview Section', 0, 'anthropic.claude-3-5-sonnet-20241022-v2:0');
