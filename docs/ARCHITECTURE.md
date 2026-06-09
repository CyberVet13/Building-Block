# Build-Block Architecture

AI-powered business plan generator with proprietary template RAG, subscription billing, and cost-minimized AWS infrastructure.

## System context

```mermaid
flowchart TB
    subgraph users [Users]
        Customer[Customer web app]
        Admin[Admin dashboard]
    end

    subgraph aws [AWS]
        APIGW[API Gateway]
        Lambda[Lambda API]
        SF[Step Functions]
        Bedrock[Bedrock]
        Aurora[Aurora pgvector]
        S3[S3]
        Cognito[Cognito]
    end

    Stripe[Stripe]

    Customer --> APIGW
    Admin --> APIGW
    APIGW --> Lambda
    Lambda --> Cognito
    Lambda --> Stripe
    Lambda --> SF
    SF --> Bedrock
    SF --> Aurora
    SF --> S3
    Stripe -->|webhooks| Lambda
```

## Generation pipeline

```mermaid
sequenceDiagram
    participant U as User
    participant API as API Lambda
    participant DB as Aurora
    participant SF as Step Functions
    participant RAG as Retrieval
    participant BR as Bedrock

    U->>API: POST /generate
    API->>DB: Check subscription plus plans remaining
    alt limit reached
        API-->>U: 402 Upgrade required
    end
    API->>DB: Create job reserved
    API->>SF: Start workflow
    SF->>RAG: Retrieve templates per stage
    RAG->>DB: pgvector similarity
    SF->>BR: Stage outline Sonnet
    par Section writers
        SF->>BR: market_analysis
        SF->>BR: financials
        SF->>BR: competitive_landscape
    end
    SF->>BR: Consistency pass Haiku
    SF->>DB: Persist plan plus usage_ledger
    SF-->>U: SSE stream sections
```

## Monorepo layout

```
apps/web/          Next.js customer app + admin
apps/api/          Python Lambda handlers + pipeline
infra/cdk/         AWS CDK stacks
corpus/templates/  Proprietary template source files
database/          SQL schema
scripts/ingest/    Corpus ingestion CLI
packages/pipeline/ Shared JSON schemas
```

## Subscription tiers (initial)

| Tier | Price | Plans/month | Export |
|------|-------|-------------|--------|
| Free | $0 | 0 (preview only) | No |
| Starter | $24/mo | 3 | PDF |
| Pro | $59/mo | 10 | PDF + DOCX |
| Business | $129/mo | 30 | PDF + DOCX + priority |

## Free tier behavior

- Full intake wizard
- Generate **one preview section** (executive summary)
- Watermarked output, no PDF/DOCX export
- CTA to subscribe for full plan

## Cost controls

1. Haiku for outline enrichment and consistency; Sonnet for section writing
2. Aurora Serverless v2 min 0.5 ACU
3. Lambda outside VPC initially (RDS Data API or public Aurora endpoint)
4. No OpenSearch until corpus scale demands it
5. Retrieval interface abstracted for future migration

## Security

- Corpus chunks never returned to client (server-side RAG only)
- S3 corpus bucket private, IAM role per Lambda
- Presigned URLs for exports (15 min TTL)
- Rate limits: 3 concurrent jobs per user
