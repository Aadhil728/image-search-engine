#!/usr/bin/env python3
"""Populate dummy product metadata for existing images in the DB.

Run: python scripts/populate_dummy_metadata.py
"""
import random
from datetime import datetime, timedelta
import os

import db_mysql


BRANDS = ["Acme", "BrillCo", "FurniLux", "HomeCraft", "NordicHome", "CasaBella"]
DESCS = [
    "High-quality product with excellent finish.",
    "Comfortable and stylish — perfect for modern homes.",
    "Durable construction with premium materials.",
    "Limited edition — available while stocks last.",
    "Customer favorite: highly rated for comfort and design.",
]


def random_date(start_year=2023, end_year=2026):
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 1, 1)
    delta = end - start
    r = random.randint(0, delta.days)
    return (start + timedelta(days=r)).date().isoformat()


def generate_price():
    return round(random.uniform(49.99, 999.99), 2)


def main():
    print("Fetching image list from DB...")
    files = db_mysql.get_all_images()
    if not files:
        print("No images found in DB. Exiting.")
        return

    print(f"Found {len(files)} images. Updating metadata...")
    updated = 0
    for i, fname in enumerate(files, start=1):
        base = os.path.splitext(fname)[0]
        sku = f"SKU-{base.upper()}-{i:03d}"
        brand = random.choice(BRANDS)
        name = f"{brand} {base.replace('_',' ').title()}"
        date = random_date()
        desc = random.choice(DESCS)
        price = generate_price()

        ok = db_mysql.update_image_metadata(fname, sku=sku, brand=brand, product_name=name, product_date=date, description=desc, price=price)
        if ok:
            updated += 1
        else:
            print(f"Failed to update: {fname}")

    print(f"Updated metadata for {updated}/{len(files)} images.")


if __name__ == "__main__":
    main()
