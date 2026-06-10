"""Local development server — wraps Lambda handlers as HTTP endpoints.

Run:
    cd apps/api
    .venv/Scripts/uvicorn build_block.dev_server:app --reload --port 3001

This gives you a local HTTP API identical to the Lambda/API Gateway surface,
so the Next.js frontend works end-to-end without an AWS deploy.

Auth: uses the dev-stub token bypass (no real Cognito needed locally).
DB:   reads DATABASE_URL from .env — requires docker compose up -d db first.
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from build_block.handlers import generate, jobs, plans, account
from build_block.handlers import checkout, portal
from build_block.handlers import export as export_handler
from build_block.handlers.admin import stats, jobs as admin_jobs, users, prompts, corpus

app = FastAPI(title="Build-Block Dev API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _event(request: Request, body: bytes, path_params: dict | None = None) -> dict:
    """Convert a FastAPI request to a Lambda-style event dict."""
    return {
        "headers": dict(request.headers),
        "queryStringParameters": dict(request.query_params) or None,
        "pathParameters": path_params or {},
        "body": body.decode() if body else None,
        "rawPath": request.url.path,
        "requestContext": {
            "http": {"method": request.method}
        },
    }


def _resp(result: dict) -> Response:
    return Response(
        content=result.get("body", "{}"),
        status_code=result.get("statusCode", 200),
        media_type="application/json",
    )


# ── Generation ────────────────────────────────────────────────────────────────

@app.post("/generate")
async def generate_plan(request: Request):
    body = await request.body()
    return _resp(generate.handler(_event(request, body), None))


@app.get("/jobs/{job_id}")
async def get_job(job_id: str, request: Request):
    return _resp(jobs.handler(_event(request, b"", {"jobId": job_id}), None))


# ── Plans ─────────────────────────────────────────────────────────────────────

@app.get("/plans")
async def list_plans(request: Request):
    return _resp(plans.handler(_event(request, b""), None))


@app.get("/plans/{plan_id}")
async def get_plan(plan_id: str, request: Request):
    return _resp(plans.handler(_event(request, b"", {"planId": plan_id}), None))


@app.post("/plans/{plan_id}/export")
async def export_plan(plan_id: str, request: Request):
    body = await request.body()
    return _resp(export_handler.handler(_event(request, body, {"planId": plan_id}), None))


# ── Account / billing ─────────────────────────────────────────────────────────

@app.get("/account")
async def get_account(request: Request):
    return _resp(account.handler(_event(request, b""), None))


@app.post("/checkout")
async def create_checkout(request: Request):
    body = await request.body()
    return _resp(checkout.handler(_event(request, body), None))


@app.post("/portal")
async def get_portal(request: Request):
    return _resp(portal.handler(_event(request, b""), None))


# ── Admin ─────────────────────────────────────────────────────────────────────

@app.get("/admin/stats")
async def admin_stats_route(request: Request):
    return _resp(stats.handler(_event(request, b""), None))


@app.get("/admin/jobs")
async def admin_jobs_route(request: Request):
    return _resp(admin_jobs.handler(_event(request, b""), None))


@app.get("/admin/users")
async def admin_users_list(request: Request):
    return _resp(users.handler(_event(request, b""), None))


@app.post("/admin/users/{user_id}/{action}")
async def admin_user_action(user_id: str, action: str, request: Request):
    body = await request.body()
    return _resp(users.handler(
        _event(request, body, {"userId": user_id, "action": action}), None
    ))


@app.get("/admin/prompts")
async def admin_prompts_list(request: Request):
    return _resp(prompts.handler(_event(request, b""), None))


@app.post("/admin/prompts")
async def admin_prompts_save(request: Request):
    body = await request.body()
    return _resp(prompts.handler(_event(request, body), None))


@app.get("/admin/corpus")
async def admin_corpus_list(request: Request):
    return _resp(corpus.handler(_event(request, b""), None))


@app.post("/admin/corpus/{doc_id}/{action}")
async def admin_corpus_action(doc_id: str, action: str, request: Request):
    body = await request.body()
    return _resp(corpus.handler(
        _event(request, body, {"docId": doc_id, "action": action}), None
    ))
