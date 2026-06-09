# Build-Block

AI-powered business plan generator. Users describe a business idea; a RAG pipeline retrieves proprietary templates and produces a structured, editable business plan.

## Locked decisions

- **Corpus:** Proprietary templates (your competitive moat)
- **Billing:** Subscription tiers (plans per month)
- **Free tier:** Full wizard + one watermarked preview section (no export)
- **Infra:** Cost-minimized AWS (Bedrock, Lambda, Aurora pgvector, Cognito, Stripe)

See [docs/DECISIONS.md](docs/DECISIONS.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Repository structure

```
apps/web/              Next.js customer app + admin dashboard
apps/api/              Python Lambda API + generation pipeline
infra/cdk/             AWS CDK infrastructure
corpus/templates/      Proprietary template source files
database/schema.sql    PostgreSQL + pgvector schema
scripts/ingest/        Corpus ingestion tooling
packages/pipeline/     Shared stage contracts (JSON Schema)
```

## Quick start (local dev)

### Prerequisites

- Node.js 20+
- Python 3.12+
- AWS CLI configured for account `058170691476`
- Docker (for local Postgres with pgvector)

### Database

```bash
docker run -d --name build-block-db \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=buildblock \
  -p 5432:5432 \
  pgvector/pgvector:pg16

psql postgresql://postgres:dev@localhost:5432/buildblock -f database/schema.sql
```

### API

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -e ".[dev]"
cp .env.example .env
```

### Web

```bash
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

## Build order (v1)

1. Corpus ingestion + seed templates
2. Step Functions pipeline + Bedrock integration
3. Job API + SSE streaming
4. Frontend wizard + generation UI
5. Stripe subscriptions + usage limits
6. Admin: template manager, prompts, job debugger

## AWS account

Target account: `058170691476`. Deploy via `infra/cdk/` when ready.
