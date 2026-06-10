"""Global test configuration — runs before any test module is imported."""

import os

# Ensure demo mode is always off during tests so tier-gate and
# billing-logic tests exercise the real code paths.
os.environ.setdefault("DEMO_MODE", "false")

# Override DEMO_MODE even if .env has it set to true.
os.environ["DEMO_MODE"] = "false"
