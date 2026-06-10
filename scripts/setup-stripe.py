#!/usr/bin/env python3
"""Create Stripe products and prices for Build-Block, then print the price IDs
to paste into billing/stripe_client.py.

Usage:
    python scripts/setup-stripe.py --key sk_test_...
    python scripts/setup-stripe.py --key sk_live_...  --live

Sets up:
    Starter  — $24/month, 3 plans
    Pro      — $59/month, 10 plans
    Business — $129/month, 30 plans
"""

from __future__ import annotations

import argparse
import json
import sys

import stripe


PRODUCTS = [
    {
        "key":         "starter",
        "name":        "Build-Block Starter",
        "description": "3 full business plans per month with PDF export.",
        "price_usd":   2400,   # cents
    },
    {
        "key":         "pro",
        "name":        "Build-Block Pro",
        "description": "10 business plans per month, industry-specific RAG, PDF + DOCX export.",
        "price_usd":   5900,
    },
    {
        "key":         "business",
        "name":        "Build-Block Business",
        "description": "30 business plans per month, priority queue, email support.",
        "price_usd":   12900,
    },
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--key", required=True, help="Stripe secret key (sk_test_... or sk_live_...)")
    parser.add_argument("--live", action="store_true", help="Confirm live mode")
    args = parser.parse_args()

    if "live" in args.key and not args.live:
        print("ERROR: Detected live key but --live not passed. Add --live to confirm.", file=sys.stderr)
        sys.exit(1)

    client = stripe.Stripe(args.key)
    price_ids: dict[str, str] = {}

    for p in PRODUCTS:
        print(f"\nCreating product: {p['name']} …", end=" ", flush=True)
        product = client.products.create(
            name=p["name"],
            description=p["description"],
            metadata={"tier": p["key"]},
        )

        price = client.prices.create(
            product=product.id,
            unit_amount=p["price_usd"],
            currency="usd",
            recurring={"interval": "month"},
            nickname=p["key"],
            metadata={"tier": p["key"]},
        )

        price_ids[p["key"]] = price.id
        print(f"OK  price_id={price.id}")

    print("\n" + "=" * 60)
    print("Paste into apps/api/src/build_block/billing/stripe_client.py:")
    print("=" * 60)
    print("\nTIER_PRICE_IDS: dict[str, str] = {")
    for key, pid in price_ids.items():
        print(f'    "{key}":  "{pid}",')
    print("}")

    output_path = "dist/stripe-price-ids.json"
    import pathlib
    pathlib.Path("dist").mkdir(exist_ok=True)
    pathlib.Path(output_path).write_text(json.dumps(price_ids, indent=2))
    print(f"\nAlso saved to {output_path}")


if __name__ == "__main__":
    main()
