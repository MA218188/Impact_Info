"""
Thryve Patient Data Discovery Script
=====================================
Queries all users and scores them by how many of the target clinical
biomarkers they have, and how many days of data each covers.

Usage:
  1. Fill in your credentials below
  2. Fill in your list of user aliases (partnerUserIDs)
  3. Run: python find_rich_patients.py
  4. Results are saved to patient_data_coverage.json and a summary CSV

Prerequisites:
  pip install requests
"""

import requests
import json
import csv
import time
import base64
from datetime import datetime, timedelta
from collections import defaultdict

# ============================================================
# CONFIGURATION — fill these in
# ============================================================

# Your API web auth credentials
USERNAME = "meddevhackathon-api"
PASSWORD = "wXGbFrGa1L2wfySO"

# Your app authorization (use prod for real data, staging for testing)
AUTH_ID = "Fis4FXE7JIBioBNF"          # prodAuthId
AUTH_SECRET = "5ah2XbZhp2CFJj9ktSHsgpK8tr9XSQv5xhsIp0a1Y8EudlmfWz1REgrqadY6qNBC"  # prodAuthSecret

# List all your user aliases here.
# If you don't know them, you may need to pull them from the Thryve
# dashboard or from your own database.
USER_ALIASES = [
    # "patient-alias-001",
    # "patient-alias-002",
    # ...
]

# How far back to look (adjust as needed)
START_DAY = "2023-01-01"
END_DAY = datetime.now().strftime("%Y-%m-%d")

# Delay between API calls to avoid rate limits
REQUEST_DELAY = 1.0  # seconds

# ============================================================
# TARGET BIOMARKERS — the metrics you care about
# ============================================================
# We define them by name (as Thryve returns in dynamicValueTypeName).
# The script will match case-insensitively.
# After the first run you can also hardcode the numeric IDs if you prefer.

TARGET_METRICS = {
    # --- Tier 1: Core Vitals & Leading Indicators ---
    "core_vitals": [
        "HeartRateResting",
        "SPO2",
        "RespirationRateResting",
        "RespirationRateSleep",
        "BloodPressureSystolic",
        "BloodPressureDiastolic",
        "BodyTemperature",
        "SkinTemperature",
    ],
    # --- Tier 2: Autonomic Nervous System & Heart Health ---
    "autonomic_heart": [
        "Rmssd",
        "RmssdSleep",
        "AtrialFibrillationDetection",
        "ArrhythmiaDetection",
        "BloodGlucose",
        "EstimatedBloodGlucose",
    ],
    # --- Tier 3: Functional Status & Behavioral Shifts ---
    "functional_status": [
        "Steps",
        "ActivitySedentaryDuration",
        "ActiveDuration",
        "Weight",
    ],
    # --- Tier 4: Sleep & Recovery ---
    "sleep_recovery": [
        "SleepDuration",
        "SleepEfficiency",
        "SleepQuality",
        "SleepInterruptions",
    ],
}

# Flatten for easy lookup
ALL_TARGET_NAMES = set()
for names in TARGET_METRICS.values():
    ALL_TARGET_NAMES.update(n.lower() for n in names)


# ============================================================
# AUTH HEADERS
# ============================================================

def make_basic_auth(user, pwd):
    token = base64.b64encode(f"{user}:{pwd}".encode()).decode()
    return f"Basic {token}"

HEADERS = {
    "Authorization": make_basic_auth(USERNAME, PASSWORD),
    "AppAuthorization": make_basic_auth(AUTH_ID, AUTH_SECRET),
}


# ============================================================
# API HELPERS
# ============================================================

def get_access_token(alias):
    """Get or create a Thryve accessToken for a user alias."""
    resp = requests.post(
        "https://api.thryve.de/v5/accessToken",
        headers=HEADERS,
        data={"partnerUserID": alias},
    )
    resp.raise_for_status()
    return resp.text.strip().strip('"')


def get_daily_data(access_token, start_day=START_DAY, end_day=END_DAY):
    """
    Pull ALL daily dynamic values for a user (no type filter).
    Returns the raw JSON response.
    """
    resp = requests.post(
        "https://api.thryve.de/v5/dailyDynamicValues",
        headers=HEADERS,
        data={
            "accessToken": access_token,
            "startDay": start_day,
            "endDay": end_day,
            # Omit dailyDynamicValueTypes to get EVERYTHING
        },
    )
    resp.raise_for_status()
    return resp.json()


def get_epoch_data(access_token, start_day=START_DAY, end_day=END_DAY):
    """
    Pull ALL epoch dynamic values for a user (no type filter).
    Uses timestamps derived from start/end day.
    """
    # Convert days to ISO timestamps
    start_ts = f"{start_day}T00:00:00Z"
    end_ts = f"{end_day}T23:59:59Z"

    resp = requests.post(
        "https://api.thryve.de/v5/dynamicEpochValues",
        headers=HEADERS,
        data={
            "accessToken": access_token,
            "startTimestamp": start_ts,
            "endTimestamp": end_ts,
            # Omit dynamicValueTypes to get EVERYTHING
        },
    )
    resp.raise_for_status()
    return resp.json()


# ============================================================
# ANALYSIS
# ============================================================

def analyze_user_data(daily_data, epoch_data):
    """
    Parse API responses and build a profile of what metrics this user has.

    Returns dict like:
    {
        "HeartRateResting": {"count": 342, "first_date": "2023-01-05", "last_date": "2024-12-01", "source": "daily"},
        "Rmssd": {"count": 280, "first_date": "2023-02-01", "last_date": "2024-11-30", "source": "epoch"},
        ...
    }
    Also returns a set of ALL metric names found (for discovering new ones).
    """
    metrics = {}
    all_found_names = {}  # name -> numeric id

    # --- Process daily data ---
    # v5 daily response is typically a list of user objects with nested dataSources
    if isinstance(daily_data, list):
        for user_block in daily_data:
            for ds in user_block.get("dataSources", []):
                for record in ds.get("data", []):
                    vtype = record.get("dailyDynamicValueType") or record.get("dynamicValueType")
                    vname = record.get("dailyDynamicValueTypeName") or record.get("dynamicValueTypeName") or str(vtype)
                    day = record.get("day") or record.get("startDay", "")

                    all_found_names[vname] = vtype

                    if vname.lower() in ALL_TARGET_NAMES:
                        if vname not in metrics:
                            metrics[vname] = {
                                "type_id": vtype,
                                "count": 0,
                                "first_date": day,
                                "last_date": day,
                                "source": "daily",
                            }
                        metrics[vname]["count"] += 1
                        if day and day < metrics[vname]["first_date"]:
                            metrics[vname]["first_date"] = day
                        if day and day > metrics[vname]["last_date"]:
                            metrics[vname]["last_date"] = day

    # --- Process epoch data ---
    if isinstance(epoch_data, list):
        for user_block in epoch_data:
            for ds in user_block.get("dataSources", []):
                for record in ds.get("data", []):
                    vtype = record.get("dynamicValueType")
                    vname = record.get("dynamicValueTypeName") or str(vtype)

                    # Extract a date from timestamps
                    ts = record.get("startTimestamp") or record.get("startTimestampUnix")
                    if isinstance(ts, (int, float)):
                        day = datetime.utcfromtimestamp(ts / 1000).strftime("%Y-%m-%d")
                    elif isinstance(ts, str):
                        day = ts[:10]
                    else:
                        day = ""

                    all_found_names[vname] = vtype

                    if vname.lower() in ALL_TARGET_NAMES:
                        if vname not in metrics:
                            metrics[vname] = {
                                "type_id": vtype,
                                "count": 0,
                                "first_date": day,
                                "last_date": day,
                                "source": "epoch",
                            }
                        metrics[vname]["count"] += 1
                        if day and day < metrics[vname]["first_date"]:
                            metrics[vname]["first_date"] = day
                        if day and day > metrics[vname]["last_date"]:
                            metrics[vname]["last_date"] = day

    return metrics, all_found_names


def score_user(metrics):
    """
    Score a user based on:
      - Number of distinct target metrics present (weighted by tier)
      - Total data points
      - Date range span
    """
    tier_weights = {
        "core_vitals": 3,
        "autonomic_heart": 2,
        "functional_status": 1,
        "sleep_recovery": 1.5,
    }

    score = 0
    metrics_lower = {k.lower(): v for k, v in metrics.items()}

    for tier, names in TARGET_METRICS.items():
        weight = tier_weights[tier]
        for name in names:
            if name.lower() in metrics_lower:
                m = metrics_lower[name.lower()]
                # Points for having the metric at all
                score += 10 * weight
                # Points for volume of data
                score += min(m["count"], 365) * 0.1 * weight
                # Points for date range span
                try:
                    d1 = datetime.strptime(m["first_date"], "%Y-%m-%d")
                    d2 = datetime.strptime(m["last_date"], "%Y-%m-%d")
                    span_days = (d2 - d1).days
                    score += min(span_days, 730) * 0.05 * weight
                except (ValueError, TypeError):
                    pass

    return round(score, 2)


# ============================================================
# MAIN
# ============================================================

def main():
    if not USER_ALIASES:
        print("ERROR: Please fill in USER_ALIASES with your patient aliases.")
        print("       You can find these in the Thryve Dashboard under 'Review users',")
        print("       or in your own application database.")
        return

    results = []
    # Collect all metric names found across all users (for discovery)
    global_metric_names = {}

    print(f"Scanning {len(USER_ALIASES)} users for data coverage...")
    print(f"Date range: {START_DAY} to {END_DAY}")
    print("=" * 60)

    for i, alias in enumerate(USER_ALIASES):
        print(f"\n[{i+1}/{len(USER_ALIASES)}] Processing: {alias}")

        try:
            # Step 1: Get access token
            token = get_access_token(alias)
            print(f"  Token: {token[:12]}...")
            time.sleep(REQUEST_DELAY)

            # Step 2: Pull daily data
            print("  Fetching daily data...")
            daily = get_daily_data(token)
            time.sleep(REQUEST_DELAY)

            # Step 3: Pull epoch data
            print("  Fetching epoch data...")
            epoch = get_epoch_data(token)
            time.sleep(REQUEST_DELAY)

            # Step 4: Analyze
            metrics, found_names = analyze_user_data(daily, epoch)
            global_metric_names.update(found_names)

            # Step 5: Score
            user_score = score_user(metrics)

            result = {
                "alias": alias,
                "score": user_score,
                "num_target_metrics": len(metrics),
                "total_data_points": sum(m["count"] for m in metrics.values()),
                "metrics": metrics,
            }
            results.append(result)

            print(f"  Score: {user_score}")
            print(f"  Target metrics found: {len(metrics)}/{len(ALL_TARGET_NAMES)}")
            if metrics:
                print(f"  Metrics: {', '.join(sorted(metrics.keys()))}")

        except Exception as e:
            print(f"  ERROR: {e}")
            results.append({
                "alias": alias,
                "score": 0,
                "num_target_metrics": 0,
                "total_data_points": 0,
                "metrics": {},
                "error": str(e),
            })

    # Sort by score descending
    results.sort(key=lambda r: r["score"], reverse=True)

    # ---- Save detailed JSON ----
    with open("patient_data_coverage.json", "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nDetailed results saved to: patient_data_coverage.json")

    # ---- Save summary CSV ----
    all_target_list = sorted(ALL_TARGET_NAMES)
    csv_headers = ["rank", "alias", "score", "num_metrics", "total_points"] + all_target_list

    with open("patient_data_summary.csv", "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(csv_headers)
        for rank, r in enumerate(results, 1):
            metrics_lower = {k.lower(): v for k, v in r["metrics"].items()}
            row = [
                rank,
                r["alias"],
                r["score"],
                r["num_target_metrics"],
                r["total_data_points"],
            ]
            for name in all_target_list:
                m = metrics_lower.get(name)
                if m:
                    row.append(f"{m['count']}pts ({m['first_date']} to {m['last_date']})")
                else:
                    row.append("")
            writer.writerow(row)
    print(f"Summary CSV saved to: patient_data_summary.csv")

    # ---- Save discovered metric name -> ID mapping ----
    with open("thryve_metric_id_map.json", "w") as f:
        json.dump(
            {name: type_id for name, type_id in sorted(global_metric_names.items())},
            f, indent=2,
        )
    print(f"Metric name->ID mapping saved to: thryve_metric_id_map.json")

    # ---- Print top patients ----
    print("\n" + "=" * 60)
    print("TOP PATIENTS BY DATA RICHNESS")
    print("=" * 60)
    for rank, r in enumerate(results[:20], 1):
        print(f"\n#{rank}  {r['alias']}")
        print(f"     Score: {r['score']}  |  Metrics: {r['num_target_metrics']}  |  Points: {r['total_data_points']}")
        if r["metrics"]:
            for tier_name, tier_metrics in TARGET_METRICS.items():
                found_in_tier = []
                for name in tier_metrics:
                    m = r["metrics"].get(name)
                    if m:
                        found_in_tier.append(f"{name}({m['count']})")
                if found_in_tier:
                    print(f"     [{tier_name}] {', '.join(found_in_tier)}")


if __name__ == "__main__":
    main()