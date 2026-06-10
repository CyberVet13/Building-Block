"""Admin role guard — call require_admin() at the top of every admin handler."""

from __future__ import annotations

from build_block.auth.cognito import extract_bearer, verify_token
from build_block.db import get_or_create_user


def require_admin(event: dict) -> dict:
    """
    Verify JWT and confirm role == 'admin'.
    Returns the user row on success.
    Raises ValueError (→ 401/403) on failure.
    """
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    token = extract_bearer(headers.get("authorization"))
    claims = verify_token(token)

    user = get_or_create_user(claims["sub"], claims.get("email", ""))
    if user.role != "admin":
        raise PermissionError("Admin role required")

    return user
