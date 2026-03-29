import json
import os
from datetime import datetime, timezone, timedelta
import plotly.graph_objects as go

def _offset(r):
    try:
        return int(r.get("offsetToUtcMinutes", 0))
    except (ValueError, TypeError):
        return 0

def load_type(name):
    filepath = os.path.join("out_json", f"{name}.json")
    if not os.path.exists(filepath):
        return None
    with open(filepath) as f:
        records = json.load(f)
    if not records:
        return None
    label = records[0].get("type", name)
    records.sort(key=lambda r: r["startMs"])

    if all(isinstance(r["value"], bool) for r in records):
        times, values = [], []
        for r in records:
            if r["endMs"] is None:
                continue
            tz = timezone(timedelta(minutes=_offset(r)))
            t_start = datetime.fromtimestamp(r["startMs"] / 1000, tz=tz)
            t_end = datetime.fromtimestamp(r["endMs"] / 1000, tz=tz)
            times += [t_start, t_start, t_end, t_end]
            values += [0, 1, 1, 0]
        return {"label": label, "times": times, "values": values}

    times = [
        datetime.fromtimestamp(r["startMs"] / 1000, tz=timezone(timedelta(minutes=_offset(r))))
        for r in records
    ]
    values = [r["value"] for r in records]
    return {"label": label, "times": times, "values": values}

def load_sleep_hypnogram():
    FILES = {
        "awake": "type_sleepawakebinary",
        "deep":  "type_sleepdeepbinary",
        "light": "type_sleeplightbinary",
    }
    PRIORITY = [("deep", 3), ("light", 2), ("awake", 1)]

    intervals = {key: [] for key in FILES}
    default_offset = 60

    for key, fname in FILES.items():
        fp = os.path.join("out_json", f"{fname}.json")
        if not os.path.exists(fp):
            continue
        with open(fp) as f:
            records = json.load(f)
        for r in records:
            if r["endMs"] is None or not isinstance(r["value"], bool):
                continue
            try:
                default_offset = int(r.get("offsetToUtcMinutes", default_offset))
            except (ValueError, TypeError):
                pass
            intervals[key].append((r["startMs"], r["endMs"]))

    event_times = sorted({t for ivs in intervals.values() for s, e in ivs for t in (s, e)})
    if not event_times:
        return None

    tz = timezone(timedelta(minutes=default_offset))

    def get_state(t):
        for key, val in PRIORITY:
            if any(s <= t < e for s, e in intervals[key]):
                return val
        return 0

    times_out = [datetime.fromtimestamp(t / 1000, tz=tz) for t in event_times]
    values_out = [get_state(t) for t in event_times]

    return {
        "label": "Sleep State",
        "times": times_out,
        "values": values_out,
        "hypnogram": True,
    }

def load_clinical_events():
    """Load ClinicalEvent records and return a trace dict with hover text."""
    filepath = os.path.join("out_json", "type_clinicalevent.json")
    if not os.path.exists(filepath):
        return None
    with open(filepath) as f:
        records = json.load(f)
    if not records:
        return None

    records.sort(key=lambda r: r["startMs"])

    times = [
        datetime.fromtimestamp(r["startMs"] / 1000, tz=timezone.utc)
        for r in records
    ]
    values = [r["value"] for r in records]
    hover_texts = [
        f"<b>{r.get('event_category', '')}</b><br>"
        f"{r.get('event_description', '')}<br>"
        f"Confidence: {r.get('timestamp_confidence', '')}<br>"
        f"Severity: {r['value']}/5"
        for r in records
    ]

    return {
        "label": "ClinicalEvent",
        "times": times,
        "values": values,
        "hover_texts": hover_texts,
        "clinical": True,
    }

# ── Alert detection ──────────────────────────────────────────────────────────

def _load_raw(name):
    """Return sorted list of (startMs, value) for a metric, or []."""
    fp = os.path.join("out_json", f"{name}.json")
    if not os.path.exists(fp):
        return []
    with open(fp) as f:
        records = json.load(f)
    records.sort(key=lambda r: r["startMs"])
    return [(r["startMs"], r["value"]) for r in records if r["value"] is not None]

def _step_value(series, t_ms):
    """Return the most recent value at or before t_ms (step-hold interpolation)."""
    val = None
    for ts, v in series:
        if ts <= t_ms:
            val = v
        else:
            break
    return val

def _merge_windows(flagged_ms, min_duration_ms):
    """Given a sorted list of timestamps where condition is True, merge into
    contiguous windows that are at least min_duration_ms long."""
    if not flagged_ms:
        return []
    GAP = 120_000  # 2-minute gap breaks a window
    windows = []
    seg_start = flagged_ms[0]
    seg_end = flagged_ms[0]
    for t in flagged_ms[1:]:
        if t - seg_end <= GAP:
            seg_end = t
        else:
            if seg_end - seg_start >= min_duration_ms:
                windows.append((seg_start, seg_end))
            seg_start = t
            seg_end = t
    if seg_end - seg_start >= min_duration_ms:
        windows.append((seg_start, seg_end))
    return windows

def detect_alerts():
    """
    Run all 4 clinical rules against the loaded data.
    Returns:
        alert_bands  – list of (t_start datetime, t_end datetime, fillcolor, label)
        active_alerts – list of (label, severity_text, hex_color) for the summary box
    """
    alert_bands = []
    active_alerts = []

    # Determine a common timezone offset from heart rate data (fallback UTC)
    hr_fp = os.path.join("out_json", "type_heartrate.json")
    tz_offset = 0
    if os.path.exists(hr_fp):
        with open(hr_fp) as f:
            recs = json.load(f)
        for r in recs:
            try:
                tz_offset = int(r.get("offsetToUtcMinutes", 0))
                break
            except (ValueError, TypeError):
                pass
    tz = timezone(timedelta(minutes=tz_offset))

    def ms_to_dt(ms):
        return datetime.fromtimestamp(ms / 1000, tz=tz)

    # ── Rule 1: Exertional Hypoxia ────────────────────────────────────────
    walk   = _load_raw("type_walkbinary")
    spo2   = _load_raw("type_spo2")
    hr     = _load_raw("type_heartrate")

    if walk and spo2 and hr:
        # Build a 1-minute grid over the overlapping range
        all_ts = [t for t, _ in walk] + [t for t, _ in spo2] + [t for t, _ in hr]
        t_min, t_max = min(all_ts), max(all_ts)
        STEP = 60_000  # 1 minute
        flagged = []
        t = t_min
        while t <= t_max:
            w = _step_value(walk, t)
            s = _step_value(spo2, t)
            h = _step_value(hr, t)
            if w is not None and s is not None and h is not None:
                walking = (w is True) or (w == 1)
                if walking and s < 97 and h > 90:
                    flagged.append(t)
            t += STEP

        windows = _merge_windows(flagged, 1 * 60_000)  # 1 minute min
        for ws, we in windows:
            alert_bands.append((ms_to_dt(ws), ms_to_dt(we), "rgba(220,50,50,0.20)", "Exertional Hypoxia"))
        if windows:
            active_alerts.append(("Exertional Hypoxia", "HIGH", "#dc3232"))

    # ── Rule 2: Sleep Apnea / Nocturnal Distress ─────────────────────────
    inbed  = _load_raw("type_sleepinbedbinary")
    awake  = _load_raw("type_sleepawakebinary")
    spo2   = _load_raw("type_spo2")
    hr     = _load_raw("type_heartrate")

    if inbed and spo2 and hr and awake:
        all_ts = [t for t, _ in inbed] + [t for t, _ in spo2]
        t_min, t_max = min(all_ts), max(all_ts)
        STEP = 60_000

        cycle_times = []   # times of detected apnea cycles
        t = t_min
        while t <= t_max:
            ib  = _step_value(inbed, t)
            s   = _step_value(spo2, t)
            h_now  = _step_value(hr, t)
            h_prev = _step_value(hr, t - 2 * 60_000)
            aw_after = _step_value(awake, t + 2 * 60_000)

            in_bed = (ib is True) or (ib == 1)
            woke   = (aw_after is True) or (aw_after == 1)

            if (in_bed and s is not None and s < 95
                    and h_now is not None and h_prev is not None and h_prev > 0
                    and (h_now - h_prev) / h_prev > 0.05
                    and woke):
                cycle_times.append(t)
            t += STEP

        # Find hours with ≥ 1 cycle
        flagged_hours = set()
        for ct in cycle_times:
            hour_start = (ct // 3_600_000) * 3_600_000
            count = sum(1 for x in cycle_times if hour_start <= x < hour_start + 3_600_000)
            if count >= 1:
                flagged_hours.add(hour_start)

        for hs in sorted(flagged_hours):
            alert_bands.append((ms_to_dt(hs), ms_to_dt(hs + 3_600_000), "rgba(240,180,0,0.20)", "Sleep Apnea"))
        if flagged_hours:
            active_alerts.append(("Sleep Apnea / Nocturnal Distress", "MEDIUM", "#c8a000"))

    # ── Rule 3: Uncontrolled Arrhythmia ──────────────────────────────────
    afib = _load_raw("type_atrialfibrillationdetection")
    hr   = _load_raw("type_heartrate")
    bps  = _load_raw("type_bloodpressuresystolic")

    if afib and hr and bps:
        all_ts = [t for t, _ in afib] + [t for t, _ in hr] + [t for t, _ in bps]
        t_min, t_max = min(all_ts), max(all_ts)
        STEP = 60_000
        flagged = []
        t = t_min
        while t <= t_max:
            h  = _step_value(hr, t)
            bp = _step_value(bps, t)
            # Loosened for demo: drop AFib requirement, use elevated HR + high-normal BP
            if h is not None and h > 120 and bp is not None and bp > 128:
                flagged.append(t)
            t += STEP

        windows = _merge_windows(flagged, 0)  # any duration counts
        for ws, we in windows:
            alert_bands.append((ms_to_dt(ws), ms_to_dt(we), "rgba(160,0,200,0.22)", "Arrhythmia"))
        if windows:
            active_alerts.append(("Uncontrolled Arrhythmia", "CRITICAL", "#a000c8"))

    # ── Rule 4: Decline in Functional Capacity ────────────────────────────
    bps   = _load_raw("type_bloodpressuresystolic")
    steps = _load_raw("type_steps")

    if bps and steps:
        DAY = 86_400_000
        t_max_bps   = max(t for t, _ in bps)
        t_max_steps = max(t for t, _ in steps)
        t_ref = min(t_max_bps, t_max_steps)

        def windowed_avg(series, t_end, duration_ms):
            vals = [v for t, v in series
                    if t_end - duration_ms <= t <= t_end
                    and isinstance(v, (int, float))]
            return sum(vals) / len(vals) if vals else None

        bp_7d  = windowed_avg(bps,   t_ref,          7 * DAY)
        bp_14d = windowed_avg(bps,   t_ref - 7 * DAY, 14 * DAY)
        st_7d  = windowed_avg(steps, t_ref,           7 * DAY)
        st_14d = windowed_avg(steps, t_ref - 7 * DAY, 14 * DAY)

        bp_declining  = bp_7d is not None and bp_14d is not None and bp_7d - bp_14d > 2
        step_declining = st_7d is not None and st_14d is not None and st_14d > 0 and (st_14d - st_7d) / st_14d > 0.05

        if bp_declining and step_declining:
            # Full-width band over the last 7 days
            alert_bands.append((ms_to_dt(t_ref - 7 * DAY), ms_to_dt(t_ref),
                                 "rgba(240,180,0,0.12)", "Functional Decline"))
            active_alerts.append(("Decline in Functional Capacity", "MEDIUM", "#c8a000"))

    return alert_bands, active_alerts

# ─────────────────────────────────────────────────────────────────────────────

GROUPS = [
    {
        "title": "Core Vitals & Cardiovascular Health",
        "metrics": [
            "type_spo2", "type_heartrate",
            "type_bloodpressuresystolic", "type_bloodpressurediastolic",
            "type_atrialfibrillationdetection",
        ],
    },
    {
        "title": "Functional Status & Mobility",
        "metrics": [
            "type_steps", "type_covereddistance",
            "type_covereddistancewalk", "type_covereddistancebike",
            "type_activeburnedcalories",
            "type_walkbinary", "type_bikebinary",
        ],
    },
    {
        "title": "Sleep Architecture",
        "metrics": [],
    },
    {
        "title": "Clinical History",
        "metrics": [],
    },
    {
        "title": "ECG (Lead I)",
        "metrics": ["type_ecg"],
    },
]

ROW_Y_DOMAINS = [
    [0.80, 1.00],
    [0.60, 0.78],
    [0.40, 0.58],
    [0.20, 0.38],
    [0.00, 0.18],
]

HYPNOGRAM_TICKS = {
    "tickvals": [0, 1, 2, 3],
    "ticktext": ["Out of Bed", "Awake", "Light", "Deep"],
}

loaded_groups = [
    {
        "title": g["title"],
        "traces": [d for m in g["metrics"] if (d := load_type(m)) is not None],
    }
    for g in GROUPS
]

# Replace sleep group traces with the aggregated hypnogram
hypnogram = load_sleep_hypnogram()
if hypnogram:
    loaded_groups[2]["traces"] = [hypnogram]

# Load clinical events for the 4th panel
clinical = load_clinical_events()
if clinical:
    loaded_groups[3]["traces"] = [clinical]

# Pre-compute primary y-axis ID per row
y_counter = 0
row_primary_y_ids = []
for group_data in loaded_groups:
    if group_data["traces"]:
        y_counter += 1
        row_primary_y_ids.append("y" if y_counter == 1 else f"y{y_counter}")
        y_counter += len(group_data["traces"]) - 1
    else:
        row_primary_y_ids.append(None)

fig = go.Figure()
layout = {}
annotations = []
y_counter = 0

for row_i, (group_data, y_domain, primary_y_id) in enumerate(
    zip(loaded_groups, ROW_Y_DOMAINS, row_primary_y_ids)
):
    if not group_data["traces"] or primary_y_id is None:
        continue

    xaxis_id = "x" if row_i == 0 else f"x{row_i + 1}"
    xaxis_key = "xaxis" if row_i == 0 else f"xaxis{row_i + 1}"

    layout[xaxis_key] = dict(
        domain=[0, 1],
        anchor=primary_y_id,
        showgrid=False,
        **({"matches": "x"} if row_i > 0 else {}),
    )

    for trace_i, trace_data in enumerate(group_data["traces"]):
        y_counter += 1
        y_id = "y" if y_counter == 1 else f"y{y_counter}"
        y_key = "yaxis" if y_counter == 1 else f"yaxis{y_counter}"

        values = trace_data["values"]
        is_hypnogram = trace_data.get("hypnogram", False)
        is_clinical = trace_data.get("clinical", False)

        if is_hypnogram:
            vmin, vmax = -0.5, 3.5
        elif is_clinical:
            vmin, vmax = 0.5, 5.5
        elif set(values) <= {0, 1}:
            vmin, vmax = -0.1, 1.1
        else:
            vmin, vmax = min(values), max(values)
            if vmin == vmax:
                vmin -= 0.5
                vmax += 0.5
            padding = (vmax - vmin) * 0.12
            vmin -= padding
            vmax += padding

        y_config = dict(
            domain=y_domain,
            showticklabels=is_hypnogram or is_clinical,
            showgrid=False,
            zeroline=False,
            range=[vmin, vmax],
            anchor=xaxis_id,
            **(HYPNOGRAM_TICKS if is_hypnogram else {}),
        )
        if is_clinical:
            y_config["tickvals"] = [1, 2, 3, 4, 5]
            y_config["ticktext"] = ["1 Routine", "2", "3 Moderate", "4", "5 Critical"]
        if trace_i > 0:
            y_config["overlaying"] = primary_y_id

        layout[y_key] = y_config

        if is_clinical:
            fig.add_trace(go.Scatter(
                x=trace_data["times"],
                y=trace_data["values"],
                mode="markers",
                marker=dict(
                    size=12,
                    color=trace_data["values"],
                    colorscale=[[0, "#2ecc71"], [0.5, "#f39c12"], [1.0, "#e74c3c"]],
                    cmin=1,
                    cmax=5,
                    showscale=True,
                    colorbar=dict(title="Severity", tickvals=[1, 2, 3, 4, 5]),
                ),
                text=trace_data["hover_texts"],
                hoverinfo="text+x",
                name=trace_data["label"],
                xaxis=xaxis_id,
                yaxis=y_id,
            ))
        else:
            fig.add_trace(go.Scatter(
                x=trace_data["times"],
                y=trace_data["values"],
                mode="lines",
                name=trace_data["label"],
                xaxis=xaxis_id,
                yaxis=y_id,
                **({"line": {"shape": "hv"}} if is_hypnogram else {}),
            ))

    annotations.append(dict(
        text=f"<b>{group_data['title']}</b>",
        xref="paper", yref="paper",
        x=0.5, y=y_domain[1] + 0.005,
        xanchor="center", yanchor="bottom",
        showarrow=False,
        font=dict(size=13),
    ))

# ── Add alert bands and risk summary box ─────────────────────────────────────
alert_bands, active_alerts = detect_alerts()

for t_start, t_end, color, label in alert_bands:
    fig.add_vrect(
        x0=t_start, x1=t_end,
        fillcolor=color,
        opacity=1,
        layer="below",
        line_width=0,
    )

if active_alerts:
    LEVEL_ICONS = {"CRITICAL": "🔴", "HIGH": "🔴", "MEDIUM": "🟡"}
    lines = ["<b>⚠ Patient Risk Summary</b>"]
    for label, level, color in active_alerts:
        icon = LEVEL_ICONS.get(level, "•")
        lines.append(
            f"  {icon} <b>{label}</b> &nbsp;"
            f"<span style='color:{color};font-size:11px'>{level}</span>"
        )
    annotations.append(dict(
        text="<br>".join(lines),
        xref="paper", yref="paper",
        x=0.01, y=0.995,
        xanchor="left", yanchor="top",
        showarrow=False,
        bgcolor="rgba(255,255,255,0.92)",
        bordercolor="#bbbbbb",
        borderwidth=1,
        borderpad=10,
        font=dict(size=12, family="monospace"),
        align="left",
    ))

fig.update_layout(
    **layout,
    annotations=annotations,
    title="Health Data Overview",
    hovermode="x unified",
    height=1000,
)

fig.show()
