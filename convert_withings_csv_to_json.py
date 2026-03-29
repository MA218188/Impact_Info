#!/usr/bin/env python3
import argparse
import csv
import json
import os
import re
from datetime import datetime, timezone

def parse_iso_to_ms(s: str) -> int | None:
    s = (s or "").strip()
    if not s or s in {"-", "NA", "N/A", "NULL", "null"}:
        return None

    try:
        if s.endswith("Z"):
            dt = datetime.fromisoformat(s[:-1]).replace(tzinfo=timezone.utc)
            return int(dt.timestamp() * 1000)

        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp() * 1000)
    except ValueError:
        return None

def parse_value(raw: str):
    raw = (raw or "").strip()
    if raw == "":
        return None
    u = raw.upper()
    if u == "TRUE":
        return True
    if u == "FALSE":
        return False
    # Try int first, then float
    try:
        if re.fullmatch(r"[+-]?\d+", raw):
            return int(raw)
        return float(raw)
    except ValueError:
        return raw  # keep as string if not numeric

def sanitize_filename(name: str) -> str:
    name = (name or "unknown").strip().lower()
    name = re.sub(r"\s+", "_", name)
    name = re.sub(r"[^a-z0-9_\-]+", "", name)
    return name or "unknown"

class StreamingJsonArrayWriter:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.fh = open(file_path, "w", encoding="utf-8")
        self.first = True
        self.fh.write("[\n")

    def write_obj(self, obj):
        if not self.first:
            self.fh.write(",\n")
        self.fh.write(json.dumps(obj, ensure_ascii=False))
        self.first = False

    def close(self):
        self.fh.write("\n]\n")
        self.fh.close()

def main():
    ap = argparse.ArgumentParser(description="Convert Withings epoch CSV to JSON (high resolution).")
    ap.add_argument("--input", required=True, help="Path to the CSV export")
    ap.add_argument("--outdir", default="out_json", help="Output directory")
    ap.add_argument("--format", choices=["json", "jsonl"], default="json",
                    help="json = one big JSON array; jsonl = newline-delimited JSON")
    ap.add_argument("--split-by-type", action="store_true",
                    help="Also write one file per Data Type Name")
    args = ap.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    events_path = os.path.join(args.outdir, f"events.{ 'jsonl' if args.format == 'jsonl' else 'json' }")

    # Writers
    if args.format == "jsonl":
        events_fh = open(events_path, "w", encoding="utf-8")
        events_writer = None
    else:
        events_fh = None
        events_writer = StreamingJsonArrayWriter(events_path)

    per_type = {}  # typeName -> (writer_or_fh, count, path)
    counts = {}
    min_start = None
    max_end = None
    total = 0
    all_records = []  # collected for DB insert

    with open(args.input, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            type_name = (row.get("Data Type Name") or "").strip() or "Unknown"

            start_ms = parse_iso_to_ms(row.get("Start Timestamps"))
            end_ms = parse_iso_to_ms(row.get("End Timestamps"))
            created_ms = parse_iso_to_ms(row.get("Created At"))

            rec = {
                "type": type_name,
                "dataTypeId": int(row["Data Type ID"]) if (row.get("Data Type ID") or "").strip().isdigit() else row.get("Data Type ID"),
                "startMs": start_ms,
                "endMs": end_ms,
                "value": parse_value(row.get("Value")),
                "sourceId": int(row["Data Source ID"]) if (row.get("Data Source ID") or "").strip().isdigit() else row.get("Data Source ID"),
                "sourceName": row.get("Data Source Name"),
                "generationType": row.get("Generation Type"),
                "offsetToUtcMinutes": int(row["Offset to UTC"]) if (row.get("Offset to UTC") or "").strip().lstrip("+-").isdigit() else row.get("Offset to UTC"),
                "createdAtMs": created_ms,
            }

            # Track bounds
            if start_ms is not None:
                min_start = start_ms if (min_start is None or start_ms < min_start) else min_start
            if end_ms is not None:
                max_end = end_ms if (max_end is None or end_ms > max_end) else max_end

            # Write main output
            if args.format == "jsonl":
                events_fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            else:
                events_writer.write_obj(rec)

            # Optional per-type outputs
            if args.split_by_type:
                safe = sanitize_filename(type_name)
                type_path = os.path.join(args.outdir, f"type_{safe}.{ 'jsonl' if args.format == 'jsonl' else 'json' }")

                if type_name not in per_type:
                    if args.format == "jsonl":
                        fh = open(type_path, "w", encoding="utf-8")
                        per_type[type_name] = (fh, 0, type_path)
                    else:
                        w = StreamingJsonArrayWriter(type_path)
                        per_type[type_name] = (w, 0, type_path)

                writer_or_fh, cnt, _ = per_type[type_name]
                if args.format == "jsonl":
                    writer_or_fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
                else:
                    writer_or_fh.write_obj(rec)
                per_type[type_name] = (writer_or_fh, cnt + 1, type_path)

            counts[type_name] = counts.get(type_name, 0) + 1
            total += 1
            all_records.append(rec)

    # Close writers
    if args.format == "jsonl":
        events_fh.close()
    else:
        events_writer.close()

    for type_name, (writer_or_fh, cnt, _) in per_type.items():
        if args.format == "jsonl":
            writer_or_fh.close()
        else:
            writer_or_fh.close()

    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "input": os.path.basename(args.input),
        "format": args.format,
        "totalRecords": total,
        "timeBounds": {"minStartMs": min_start, "maxEndMs": max_end},
        "countsByType": dict(sorted(counts.items(), key=lambda kv: kv[0].lower())),
        "files": {
            "events": os.path.basename(events_path),
            "perType": {k: os.path.basename(v[2]) for k, v in per_type.items()} if args.split_by_type else {},
        },
    }

    with open(os.path.join(args.outdir, "manifest.json"), "w", encoding="utf-8") as mf:
        json.dump(manifest, mf, ensure_ascii=False, indent=2)
        mf.write("\n")

    from db import init_db, insert_records
    init_db()
    n = insert_records(all_records)
    print(f"Persisted to DB: {n} new rows inserted (of {total} total records).")

if __name__ == "__main__":
    main()