# Deployment Guide

Single-operator deploy of Build-Block to AWS account `058170691476`.

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 20+ | `node --version` |
| Python | 3.12 | `py -3.12 --version` |
| AWS CLI | 2.x | `aws --version` |
| AWS CDK | 2.x | `npx cdk --version` |

AWS credentials must be configured (`aws configure` or `AWS_PROFILE`).

## First-time setup

```powershell
# 1. Install local dev dependencies
.\scripts\setup-local.ps1

# 2. Verify tests pass (29/29)
cd apps/api
.\.venv\Scripts\python.exe -m pytest tests/ -q
cd ../..
```

## Deploy (every time)

```powershell
# Set your web URL (Vercel/Amplify domain)
$env:WEB_URL = "https://your-domain.com"

# Full deploy: tests → Lambda build → CDK deploy
.\scripts\deploy.ps1 -Stage dev

# Dry run (shows diff, no changes)
.\scripts\deploy.ps1 -Stage dev -DryRun

# Skip rebuild when only updating source code (not deps)
.\scripts\deploy.ps1 -Stage dev -SkipBuild
```

## Post-deploy steps (run once after first deploy)

### 1. Set Stripe secrets

```bash
aws secretsmanager put-secret-value \
  --secret-id build-block/stripe-dev \
  --secret-string '{"secret_key":"sk_live_...","webhook_secret":"whsec_..."}'
```

### 2. Run Aurora schema migration

Get the DB endpoint from CDK outputs (`DbClusterEndpoint`), then:

```bash
psql "postgresql://buildblock_app:{PASSWORD}@{HOST}:5432/buildblock" \
  -f database/schema.sql
```

The DB password is in Secrets Manager: `build-block/db-password-dev`.

```bash
aws secretsmanager get-secret-value \
  --secret-id build-block/db-password-dev \
  --query SecretString --output text | python -c "import sys,json; print(json.load(sys.stdin)['password'])"
```

### 3. Ingest corpus templates

```powershell
cd apps/api
$env:DATABASE_URL = "postgresql://buildblock_app:{PASSWORD}@{HOST}:5432/buildblock"
.\.venv\Scripts\python.exe ..\..\scripts\ingest\ingest_corpus.py --corpus-dir ..\..\corpus\templates
```

### 4. Fill Stripe price IDs

Open `apps/api/src/build_block/billing/stripe_client.py` and set:

```python
TIER_PRICE_IDS = {
    "starter":  "price_...",   # from Stripe Dashboard → Products
    "pro":      "price_...",
    "business": "price_...",
}
```

Create products in Stripe Dashboard first:
- Starter — $24/mo recurring
- Pro — $59/mo recurring
- Business — $129/mo recurring

### 5. Register Stripe webhook

Stripe Dashboard → Webhooks → Add endpoint:

- URL: `{HttpApiUrl}/webhooks/stripe`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`

Copy the signing secret into Secrets Manager (step 1 above).

### 6. Make yourself admin

After your first sign-up:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

### 7. Deploy the web app

```powershell
# Copy CDK outputs to web env
# (replace values from dist/cdk-outputs-dev.json)
cp apps/web/.env.example apps/web/.env.local
# Fill in:
#   NEXT_PUBLIC_API_URL = {HttpApiUrl}
#   NEXT_PUBLIC_COGNITO_USER_POOL_ID = {UserPoolId}
#   NEXT_PUBLIC_COGNITO_CLIENT_ID = {UserPoolClientId}
#   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_...

cd apps/web
npm run build
# Deploy to Vercel: vercel deploy --prod
# Or Amplify Hosting: amplify publish
```

## Subsequent deploys

```powershell
# Source code change only (no dep changes)
.\scripts\build-lambda.ps1 -SrcOnly
.\scripts\deploy.ps1 -Stage dev -SkipBuild  # already built above

# Dependency change (requirements.txt changed)
.\scripts\build-lambda.ps1  # full rebuild
.\scripts\deploy.ps1 -Stage dev -SkipBuild
```

## Production stage

```powershell
$env:WEB_URL = "https://app.build-block.com"
.\scripts\deploy.ps1 -Stage prod
```

Update `infra/cdk/bin/app.ts` to add a `BuildBlockProd` stack with the same structure.

## Cost monitoring

| What to watch | Where |
|---------------|-------|
| Bedrock tokens | CloudWatch → `build-block-waf-dev` metrics + Bedrock console |
| Lambda invocations | CloudWatch → Lambda → Functions |
| Aurora ACU hours | RDS console → Aurora → Monitoring |
| WAF blocked requests | CloudWatch → `IpRateLimit` metric |
| Stripe revenue | Stripe Dashboard → Overview |

Admin dashboard shows estimated Bedrock cost per 30 days at `/admin`.
