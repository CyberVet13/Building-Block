from __future__ import annotations

import json
from functools import lru_cache

import httpx
from jose import jwt, JWTError

from build_block.config import settings


@lru_cache(maxsize=1)
def _jwks() -> dict:
    url = (
        f"https://cognito-idp.{settings.aws_region}.amazonaws.com"
        f"/{settings.cognito_user_pool_id}/.well-known/jwks.json"
    )
    return httpx.get(url, timeout=5).json()


def verify_token(token: str) -> dict:
    """
    Validate a Cognito JWT and return its claims.
    Raises ValueError on invalid/expired tokens.
    """
    if not settings.cognito_user_pool_id:
        # Local dev shortcut: accept unsigned tokens with sub + email claims
        try:
            claims = json.loads(
                __import__("base64").b64decode(token.split(".")[1] + "==").decode()
            )
            return claims
        except Exception as exc:
            raise ValueError("Invalid dev token") from exc

    try:
        jwks = _jwks()
        claims = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=settings.cognito_client_id,
            options={"verify_at_hash": False},
        )
    except JWTError as exc:
        raise ValueError(f"Token validation failed: {exc}") from exc

    if claims.get("token_use") != "access":
        raise ValueError("Expected access token")

    return claims


def extract_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise ValueError("Missing or malformed Authorization header")
    return authorization.removeprefix("Bearer ").strip()
