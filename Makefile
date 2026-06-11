# Build-Block development commands
# Usage: make <target>
# Requires: Python 3.12, Node 20, Docker Desktop

.PHONY: help setup db db-stop test api web ingest build-lambda deploy-dev deploy-prod \
        stripe-setup admin-promote clean

# ── Default ───────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "Build-Block commands:"
	@echo ""
	@echo "  Setup"
	@echo "    make setup          Install all dependencies (web + api)"
	@echo ""
	@echo "  Local dev"
	@echo "    make db             Start local Postgres (Docker)"
	@echo "    make db-stop        Stop local Postgres"
	@echo "    make api            Start local API server on :3001"
	@echo "    make web            Start Next.js dev server on :3000"
	@echo "    make ingest         Ingest corpus templates into local DB"
	@echo ""
	@echo "  Testing"
	@echo "    make test           Run Python test suite (39 tests)"
	@echo ""
	@echo "  Deploy"
	@echo "    make build-lambda   Build Lambda layer + source zip (no Docker needed)"
	@echo "    make deploy-dev     Run full deploy to dev stage"
	@echo "    make deploy-prod    Run full deploy to prod stage"
	@echo ""
	@echo "  Post-deploy"
	@echo "    make stripe-setup   Create Stripe products (sk_test_ key)"
	@echo "    make admin-promote  Promote EMAIL= to admin role"
	@echo ""

# ── Setup ─────────────────────────────────────────────────────────────────────

setup:
	@echo "==> Installing API dependencies..."
	cd apps/api && python -m venv .venv || true
	cd apps/api && .venv/Scripts/pip install -e ".[dev,server]"
	@echo "==> Installing web dependencies..."
	cd apps/web && npm install
	@echo "==> Copying env examples..."
	cp -n apps/api/.env.example apps/api/.env 2>/dev/null || true
	cp -n apps/web/.env.example apps/web/.env.local 2>/dev/null || true
	@echo "Done. Edit apps/api/.env and apps/web/.env.local before starting."

# ── Local dev ─────────────────────────────────────────────────────────────────

db:
	docker compose up -d db
	@echo "Postgres running at postgresql://postgres:dev@localhost:5432/buildblock"
	@echo "Applying schema..."
	sleep 3
	docker exec build-block-db psql -U postgres -d buildblock -f /docker-entrypoint-initdb.d/01-schema.sql 2>/dev/null || true

db-stop:
	docker compose stop db

api:
	cd apps/api && .venv/Scripts/uvicorn build_block.dev_server:app --reload --port 3001

web:
	cd apps/web && npm run dev

ingest:
	cd apps/api && .venv/Scripts/python ../../scripts/ingest/ingest_corpus.py \
		--corpus-dir ../../corpus/templates

ingest-dry:
	cd apps/api && .venv/Scripts/python ../../scripts/ingest/ingest_corpus.py \
		--corpus-dir ../../corpus/templates --dry-run

# ── Testing ───────────────────────────────────────────────────────────────────

test:
	cd apps/api && .venv/Scripts/python -m pytest tests/ -v

test-e2e:
	cd apps/web && npm run test:e2e

test-e2e-ui:
	cd apps/web && npm run test:e2e:ui

playwright-install:
	cd apps/web && npx playwright install chromium

# ── Deploy ────────────────────────────────────────────────────────────────────

build-lambda:
	powershell -ExecutionPolicy Bypass -File scripts/build-lambda.ps1

deploy-dev: test build-lambda
	powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -Stage dev

deploy-prod: test build-lambda
	powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -Stage prod

# ── Post-deploy ───────────────────────────────────────────────────────────────

stripe-setup:
	@test -n "$(KEY)" || (echo "Usage: make stripe-setup KEY=sk_test_..." && exit 1)
	cd apps/api && .venv/Scripts/python ../../scripts/setup-stripe.py --key $(KEY)

admin-promote:
	@test -n "$(EMAIL)" || (echo "Usage: make admin-promote EMAIL=you@domain.com" && exit 1)
	@echo "UPDATE users SET role = 'admin' WHERE email = '$(EMAIL)';" | \
		docker exec -i build-block-db psql -U postgres -d buildblock

# ── Clean ─────────────────────────────────────────────────────────────────────

clean:
	rm -rf dist/ apps/web/.next/ apps/web/node_modules/.cache/
