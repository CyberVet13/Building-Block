from __future__ import annotations

import contextlib
from functools import lru_cache

import psycopg
import psycopg_pool
from pgvector.psycopg import register_vector

from build_block.config import settings


@lru_cache(maxsize=1)
def _pool() -> psycopg_pool.ConnectionPool:
    pool = psycopg_pool.ConnectionPool(
        settings.resolved_database_url(),
        min_size=1,
        max_size=5,
        open=False,
    )
    pool.open(wait=True, timeout=10)
    return pool


@contextlib.contextmanager
def get_conn():
    """Yield a psycopg3 connection from the pool with pgvector registered."""
    with _pool().connection() as conn:
        register_vector(conn)
        yield conn


def close_pool() -> None:
    """Call on Lambda shutdown / process exit."""
    try:
        _pool.cache_clear()
    except Exception:
        pass
