# Architecture Decision Record

Locked decisions for Build-Block v1. Update this file when reversing a decision.

## Product

| Decision | Choice | Date |
|----------|--------|------|
| Timeline | Solid v1 (~2–3 months) | 2026-06-08 |
| Knowledge corpus | Proprietary templates (owned moat) | 2026-06-08 |
| Monetization | Subscription tiers (plans/month) | 2026-06-08 |
| Free tier | Wizard + watermarked preview (1 section only) | 2026-06-08 |
| Ops priority | Minimize AWS bill | 2026-06-08 |

## Infrastructure

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Cloud | AWS (account `058170691476`) | User requirement |
| LLM | Amazon Bedrock | Pay-per-token, no cross-cloud egress |
| Vector store | Aurora PostgreSQL + pgvector | Avoid OpenSearch Serverless floor cost |
| Compute | Lambda + API Gateway + Step Functions | Serverless, zero idle cost |
| Auth | Amazon Cognito | Low cost, AWS-native |
| Billing | Stripe Billing + Customer Portal | Industry standard for subscriptions |
| Object storage | S3 | Corpus + generated plans |

## Deferred (post-v1)

- OpenSearch migration (when corpus > ~1M chunks or retrieval latency hurts)
- Bedrock fine-tuning per stage
- Real-time collaboration
- Credit packs / overage billing
- NAT Gateway + private VPC (unless compliance requires)

## Definitions

- **1 plan** = one full generation job (all sections), regardless of length
- **Preview** = single section (executive summary) with watermark; no export
- **Billing period** = Stripe subscription `current_period_start` → `current_period_end`
