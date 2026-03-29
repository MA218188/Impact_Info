#!/usr/bin/env python3
"""One-shot bulk import of all data/out_json/ files into health_data.db."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from db import init_db, insert_records

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data", "out_json")


def main():
    init_db()

    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    if not os.path.exists(manifest_path):
        print(f"No manifest found at {manifest_path}. Run the pipeline first.")
        return

    with open(manifest_path) as f:
        manifest = json.load(f)

    files_to_import: list[str] = []

    # Per-type files (preferred — already split)
    per_type = manifest.get("files", {}).get("perType", {})
    if per_type:
        for fname in per_type.values():
            files_to_import.append(os.path.join(OUT_DIR, fname))
    else:
        # Fall back to the monolithic events file
        events_file = manifest.get("files", {}).get("events", "events.json")
        files_to_import.append(os.path.join(OUT_DIR, events_file))

    total_inserted = 0
    total_records = 0

    for path in files_to_import:
        if not os.path.exists(path):
            print(f"  [skip] {path} not found")
            continue

        with open(path) as f:
            records = json.load(f)

        if not isinstance(records, list):
            print(f"  [skip] {path} does not contain a JSON array")
            continue

        n = insert_records(records)
        total_inserted += n
        total_records += len(records)
        print(f"  {os.path.basename(path)}: {len(records)} records, {n} newly inserted")

    print(f"\nDone. {total_inserted} new rows inserted ({total_records} total records processed).")
    print(f"Database: {os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'health_data.db')}")


if __name__ == "__main__":
    main()
