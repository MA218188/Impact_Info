import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  CartesianGrid,
} from "recharts";
import { fetchEvents, type HealthEvent } from "@/lib/api";

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  hr:    "#185FA5",
  spo2:  "#85B7EB",
  steps: "#0F6E56",
  dist:  "#185FA5",
  cal:   "#854F0B",
  walk:  "#0F6E56",
  bike:  "#534AB7",
  sleep: "#1a3d6e",
  grid:  "hsl(220 15% 88%)",
  labelBg: "hsl(220 15% 96%)",
  labelText: "#5f5e57",
};

const LABEL_COL_W = 88;
const TRACK_DIVIDER = "border-b border-border/60";
const GRID_DASH = "3 3";

const SEVERITY_COLOR = (v: number) => {
  if (v <= 1) return "#2ecc71";
  if (v <= 2) return "#a8d86e";
  if (v <= 3) return "#f39c12";
  if (v <= 4) return "#e67e22";
  return "#e74c3c";
};

// ── Data helpers ──────────────────────────────────────────────────────────────

function toSeries(events: HealthEvent[], target = 600): { x: number; y: number }[] {
  const valid = events
    .filter((e) => e.value != null)
    .sort((a, b) => a.startMs - b.startMs);
  if (!valid.length) return [];
  const step = Math.max(1, Math.floor(valid.length / target));
  return valid
    .filter((_, i) => i % step === 0)
    .map((e) => ({ x: e.startMs, y: e.value as number }));
}

type XY = { x: number; y: number };

function interpolateLinear(series: XY[], x: number): number | null {
  if (!series.length) return null;
  if (x <= series[0].x) return series[0].y;
  if (x >= series[series.length - 1].x) return series[series.length - 1].y;

  let lo = 0;
  let hi = series.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].x === x) return series[mid].y;
    if (series[mid].x < x) lo = mid + 1;
    else hi = mid - 1;
  }

  const right = Math.min(lo, series.length - 1);
  const left = Math.max(right - 1, 0);
  const p1 = series[left];
  const p2 = series[right];
  if (p2.x === p1.x) return p1.y;

  const ratio = (x - p1.x) / (p2.x - p1.x);
  return p1.y + (p2.y - p1.y) * ratio;
}

function interpolateStepAfter(series: XY[], x: number): number | null {
  if (!series.length) return null;
  if (x < series[0].x) return series[0].y;

  let lo = 0;
  let hi = series.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (series[mid].x <= x) lo = mid;
    else hi = mid - 1;
  }
  return series[lo].y;
}

function latestObservedX(series: XY[], x: number): number | null {
  if (!series.length) return null;
  if (x < series[0].x) return series[0].x;

  let lo = 0;
  let hi = series.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (series[mid].x <= x) lo = mid;
    else hi = mid - 1;
  }
  return series[lo].x;
}

function latestObservedDate(x: number, seriesList: XY[][]): number {
  const candidates = seriesList
    .map((series) => latestObservedX(series, x))
    .filter((v): v is number => v != null);

  if (!candidates.length) return x;
  return Math.max(...candidates);
}

// Merge multiple named series into one array sorted by x.
// Rows where a series has no point at that timestamp get null → connectNulls fills the gap.
type MergedRow = { x: number } & Record<string, number | null>;
function mergeSeries(series: Record<string, { x: number; y: number }[]>): MergedRow[] {
  const allX = new Set<number>();
  for (const pts of Object.values(series)) pts.forEach((p) => allX.add(p.x));
  const sorted = Array.from(allX).sort((a, b) => a - b);
  const maps = Object.fromEntries(
    Object.entries(series).map(([k, pts]) => [k, new Map(pts.map((p) => [p.x, p.y]))]),
  );
  return sorted.map((x) => {
    const row: MergedRow = { x };
    for (const [k, m] of Object.entries(maps)) row[k] = m.get(x) ?? null;
    return row;
  });
}

// Sleep hypnogram: deep=3, light=2, awake=1, out-of-bed=0
function buildHypnogram(
  awake: HealthEvent[],
  deep: HealthEvent[],
  light: HealthEvent[],
): { x: number; y: number }[] {
  type Iv = [number, number];
  const toIvs = (evs: HealthEvent[]): Iv[] =>
    evs.filter((e) => e.endMs != null).map((e) => [e.startMs, e.endMs!]);

  const ivDeep  = toIvs(deep);
  const ivLight = toIvs(light);
  const ivAwake = toIvs(awake);

  const times = new Set<number>();
  for (const [s, e] of [...ivDeep, ...ivLight, ...ivAwake]) { times.add(s); times.add(e); }
  if (!times.size) return [];

  const sorted = Array.from(times).sort((a, b) => a - b);
  const inAny = (ivs: Iv[], t: number) => ivs.some(([s, e]) => s <= t && t < e);

  return sorted.map((t) => ({
    x: t,
    y: inAny(ivDeep, t) ? 3 : inAny(ivLight, t) ? 2 : inAny(ivAwake, t) ? 1 : 0,
  }));
}

// ── Alert detection ───────────────────────────────────────────────────────────

type Pair = [number, number];
type Band = { x1: number; x2: number; fill: string; label: string };

function sortedPairs(events: HealthEvent[]): Pair[] {
  return events
    .filter((e) => e.value != null)
    .sort((a, b) => a.startMs - b.startMs)
    .map((e) => [e.startMs, e.value as number]);
}

// Binary search step-hold interpolation — O(log n) per lookup
function stepVal(series: Pair[], t: number): number | null {
  if (!series.length || t < series[0][0]) return null;
  let lo = 0, hi = series.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (series[mid][0] <= t) lo = mid;
    else hi = mid - 1;
  }
  return series[lo][0] <= t ? series[lo][1] : null;
}

function mergeWindows(flagged: number[], minDuration: number): [number, number][] {
  if (!flagged.length) return [];
  const GAP = 120_000;
  const out: [number, number][] = [];
  let s = flagged[0], e = flagged[0];
  for (let i = 1; i < flagged.length; i++) {
    if (flagged[i] - e <= GAP) { e = flagged[i]; }
    else { if (e - s >= minDuration) out.push([s, e]); s = flagged[i]; e = flagged[i]; }
  }
  if (e - s >= minDuration) out.push([s, e]);
  return out;
}

function detectAlerts(byType: Record<string, HealthEvent[]>): Band[] {
  const bands: Band[] = [];
  const walk  = sortedPairs(byType["WalkBinary"]              ?? []);
  const spo2  = sortedPairs(byType["SPO2"]                   ?? []);
  const hr    = sortedPairs(byType["HeartRate"]               ?? []);
  const inbed = sortedPairs(byType["SleepInBedBinary"]        ?? []);
  const awake = sortedPairs(byType["SleepAwakeBinary"]        ?? []);
  const steps = sortedPairs(byType["Steps"]                   ?? []);

  function scanRange(a: Pair[], b: Pair[], extra: Pair[][] = []): [number, number] {
    const all = [a, b, ...extra].flatMap((s) => s.map(([t]) => t));
    return [Math.min(...all), Math.max(...all)];
  }

  // Rule 1: Exertional Hypoxia
  if (walk.length && spo2.length && hr.length) {
    const [tMin, tMax] = scanRange(walk, spo2, [hr]);
    const flagged: number[] = [];
    for (let t = tMin; t <= tMax; t += 60_000) {
      const w = stepVal(walk, t), s = stepVal(spo2, t), h = stepVal(hr, t);
      if (w != null && w > 0 && s != null && s < 97 && h != null && h > 90) flagged.push(t);
    }
    for (const [ws, we] of mergeWindows(flagged, 60_000))
      bands.push({ x1: ws, x2: we, fill: "rgba(220,50,50,0.15)", label: "Exertional Hypoxia" });
  }

  // Rule 2: Sleep Apnea
  if (inbed.length && spo2.length && hr.length && awake.length) {
    const [tMin, tMax] = scanRange(inbed, spo2);
    const cycleTimes: number[] = [];
    for (let t = tMin; t <= tMax; t += 60_000) {
      const ib = stepVal(inbed, t), s = stepVal(spo2, t);
      const hN = stepVal(hr, t), hP = stepVal(hr, t - 120_000);
      const aw = stepVal(awake, t + 120_000);
      if (ib != null && ib > 0 && s != null && s < 95
          && hN != null && hP != null && hP > 0 && (hN - hP) / hP > 0.05
          && aw != null && aw > 0)
        cycleTimes.push(t);
    }
    const flaggedHours = new Set<number>();
    for (const ct of cycleTimes) {
      const hs = Math.floor(ct / 3_600_000) * 3_600_000;
      if (cycleTimes.filter((x) => x >= hs && x < hs + 3_600_000).length >= 1) flaggedHours.add(hs);
    }
    for (const hs of [...flaggedHours].sort())
      bands.push({ x1: hs, x2: hs + 3_600_000, fill: "rgba(240,180,0,0.15)", label: "Sleep Apnea" });
  }

  return bands;
}

// ── Tooltip & axis helpers ────────────────────────────────────────────────────

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function buildXTicks(domain: [number, number]): number[] {
  const [minMs, maxMs] = domain;
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || maxMs <= minMs) return [];

  const durationDays = (maxMs - minMs) / 86400000;
  const intervalDays = durationDays <= 7 ? 1 : durationDays <= 35 ? 7 : 14;
  const intervalMs = intervalDays * 86400000;

  const ticks: number[] = [];
  const firstTick = Math.ceil(minMs / intervalMs) * intervalMs;
  for (let t = firstTick; t <= maxMs; t += intervalMs) {
    ticks.push(t);
  }
  return ticks;
}

const fmtLabel = (_label: unknown, payload?: Array<{ payload?: { x?: number } }>) => {
  const x = payload?.[0]?.payload?.x;
  return x != null ? fmtDate(x) : "";
};

function InterpolatedTooltip({
  active,
  label,
  dateMs,
  rows,
}: {
  active?: boolean;
  label?: number;
  dateMs?: number;
  rows: Array<{ name: string; value: number | null; color: string; formatter?: (v: number) => string }>;
}) {
  if (!active || label == null) return null;
  const available = rows.filter((r) => r.value != null);
  if (!available.length) return null;

  return (
    <div className="bg-white border border-border/60 rounded-lg p-2 text-[11px] shadow-sm min-w-[120px]">
      <div className="text-muted-foreground mb-1">{fmtDate(dateMs ?? label)}</div>
      {available.map((row) => (
        <div key={row.name} className="flex items-center justify-between gap-3">
          <span className="font-medium" style={{ color: row.color }}>{row.name}</span>
          <span>{row.formatter ? row.formatter(row.value as number) : (row.value as number).toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

const MARGIN = { top: 8, right: 10, bottom: 8, left: 10 };
const NO_ANIM = { isAnimationActive: false } as const;

const XAx = ({ domain, ticks }: { domain: [number, number]; ticks: number[] }) => (
  <XAxis
    type="number"
    dataKey="x"
    domain={domain}
    ticks={ticks.length ? ticks : undefined}
    tickFormatter={fmtDate}
    tickLine={false}
    axisLine={false}
    tick={{ fontSize: 10.5, fill: C.labelText, fontWeight: 500 }}
    minTickGap={24}
  />
);

const GroupTitle = ({ title }: { title: string }) => (
  <div className="flex border-b border-border/40">
    <div
      className="flex-shrink-0 border-r border-border/60"
      style={{ width: LABEL_COL_W, background: C.labelBg }}
    />
    <div className="flex-1 px-4 py-1.5 bg-secondary/20">
      <span className="text-[10px] font-medium tracking-[0.08em] uppercase text-muted-foreground">{title}</span>
    </div>
  </div>
);

const Panel = ({
  label,
  height = 150,
  children,
}: {
  label: React.ReactNode;
  height?: number;
  children: React.ReactNode;
}) => (
  <div className={`flex ${TRACK_DIVIDER}`} style={{ height }}>
    <div
      className="flex-shrink-0 flex items-center justify-end pr-3 border-r border-border/60"
      style={{ width: LABEL_COL_W, background: C.labelBg }}
    >
      <span className="text-[12px] font-semibold leading-tight text-right" style={{ color: C.labelText }}>{label}</span>
    </div>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

function ClinicalDot(props: { cx?: number; cy?: number; payload?: { y?: number; documentId?: number | null } }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  const fill = SEVERITY_COLOR(payload?.y ?? 1);
  const hasDoc = payload?.documentId != null;
  return (
    <circle
      cx={cx} cy={cy} r={5} fill={fill} stroke="#fff" strokeWidth={1}
      style={hasDoc ? { cursor: "pointer" } : undefined}
      onClick={hasDoc ? () => window.open(`/api/documents/${payload!.documentId}`, "_blank") : undefined}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  selectedPatient: number;
  xTicks?: number[];
  domain?: [number, number];
}

const SensorCharts = ({ selectedPatient, xTicks, domain: domainFromParent }: Props) => {
  const enabled = selectedPatient === 0;

  // Single fetch — all 22k records in one request instead of 15 separate calls
  const { data: allEvents, isLoading } = useQuery({
    queryKey: ["events", "all"],
    queryFn: () => fetchEvents({ limit: 100_000 }),
    enabled,
    staleTime: 600_000,
    retry: false,
  });

  // Group by type client-side
  const byType = useMemo(() => {
    const map: Record<string, HealthEvent[]> = {};
    for (const e of allEvents ?? []) (map[e.type] ??= []).push(e);
    return map;
  }, [allEvents]);

  // Global x-axis domain — computed first so all charts can be padded to it
  const domainFromData: [number, number] = useMemo(() => {
    if (!allEvents?.length) return [0, 0];
    let min = Infinity, max = -Infinity;
    for (const e of allEvents) {
      if (e.startMs < min) min = e.startMs;
      const end = e.endMs ?? e.startMs;
      if (end > max) max = end;
    }
    return [min, max];
  }, [allEvents]);
  const domain = domainFromParent ?? domainFromData;

  // Transform series (padded to global domain so every chart spans A→Z)
  const hrData    = useMemo(() => toSeries(byType["HeartRate"] ?? []), [byType]);
  const spo2Data  = useMemo(() => toSeries(byType["SPO2"]     ?? []), [byType]);

  // Centre each signal on its mean so both lines sit at the same vertical midpoint
  const hrDomain = useMemo((): [number, number] => {
    if (!hrData.length) return [40, 130];
    const vals = hrData.map((d) => d.y);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const half = Math.max(...vals) - Math.min(...vals);
    return [Math.floor(mean - half), Math.ceil(mean + half)];
  }, [hrData]);

  const spo2Domain = useMemo((): [number, number] => {
    if (!spo2Data.length) return [85, 101];
    const vals = spo2Data.map((d) => d.y);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const half = Math.max(...vals) - Math.min(...vals);
    return [Math.floor(mean - half), Math.ceil(mean + half)];
  }, [spo2Data]);
  const stepsData = useMemo(() => toSeries(byType["Steps"] ?? []), [byType]);

  // Merged datasets for charts with multiple overlaid series
  const hrSpo2Data = useMemo(() => mergeSeries({ hr: hrData, spo2: spo2Data }), [hrData, spo2Data]);

  const hypnoData = useMemo(
    () => buildHypnogram(
      byType["SleepAwakeBinary"] ?? [],
      byType["SleepDeepBinary"]  ?? [],
      byType["SleepLightBinary"] ?? [],
    ),
    [byType],
  );

  const clinData = useMemo(
    () => (byType["ClinicalEvent"] ?? [])
      .filter((e) => e.value != null)
      .map((e) => ({ x: e.startMs, y: e.value as number, category: e.event_category ?? "", description: e.event_description ?? "", documentId: e.documentId })),
    [byType],
  );

  const alertBands = useMemo(() => detectAlerts(byType), [byType]);
  const alertLabels = [...new Set(alertBands.map((b) => b.label))];
  const computedXTicks = useMemo(() => buildXTicks(domain), [domain]);
  const axisTicks = xTicks?.length ? xTicks : computedXTicks;

  if (!enabled) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading sensor data…
      </div>
    );
  }

  const grid = <CartesianGrid stroke={C.grid} strokeWidth={0.9} strokeDasharray={GRID_DASH} horizontal={false} vertical />;

  const bands = alertBands.map((b) => (
    <ReferenceArea key={`${b.label}-${b.x1}`} x1={b.x1} x2={b.x2}
      fill={b.fill} strokeWidth={0} ifOverflow="extendDomain" />
  ));

  return (
    <div className="flex flex-col">

      {/* Alert legend */}
      {alertLabels.length > 0 && (
        <div className="flex border-b border-border/60">
          <div
            className="flex-shrink-0 border-r border-border/60"
            style={{ width: LABEL_COL_W, background: C.labelBg }}
          />
          <div className="flex-1 flex items-center gap-3 px-5 py-2 bg-secondary/30">
            <span className="text-[10px] font-medium text-muted-foreground">Alerts:</span>
            {alertLabels.map((lbl) => {
              const b = alertBands.find((x) => x.label === lbl)!;
              return (
                <div key={lbl} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm" style={{ background: b.fill.replace(/[\d.]+\)$/, "0.6)") }} />
                  <span className="text-[10px] text-foreground/70">{lbl}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Group 1: Core Vitals ──────────────────────────────────────── */}
      <GroupTitle title="Core Vitals & Cardiovascular Health" />

      <Panel label={<>HR (bpm)<br />SpO₂ (%)</>} height={160}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={hrSpo2Data} margin={MARGIN}>
            {grid}
            <XAx domain={domain} ticks={axisTicks} />
            <YAxis yAxisId="hr" hide domain={hrDomain} />
            <YAxis yAxisId="spo2" hide orientation="right" domain={spo2Domain} />
            <Tooltip
              content={({ active, label }) => {
                const x = typeof label === "number" ? label : Number(label);
                if (!Number.isFinite(x)) return null;
                return (
                  <InterpolatedTooltip
                    active={active}
                    label={x}
                    rows={[
                      { name: "HR", value: interpolateLinear(hrData, x), color: C.hr, formatter: (v) => `${v.toFixed(1)} bpm` },
                      { name: "SpO2", value: interpolateLinear(spo2Data, x), color: C.spo2, formatter: (v) => `${v.toFixed(1)}%` },
                    ]}
                  />
                );
              }}
            />
            {bands}
            <Line yAxisId="hr"   dataKey="hr"   name="hr"   dot={false} stroke={C.hr}   strokeWidth={1.4} connectNulls {...NO_ANIM} />
            <Line yAxisId="spo2" dataKey="spo2" name="spo2" dot={false} stroke={C.spo2} strokeWidth={1.2} connectNulls {...NO_ANIM} />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      {/* ── Group 2: Functional Status ────────────────────────────────── */}
      <GroupTitle title="Functional Status & Mobility" />

      <Panel label="Steps" height={120}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={stepsData} margin={MARGIN}>
            {grid} <XAx domain={domain} ticks={axisTicks} />
            <YAxis hide />
            <Tooltip
              content={({ active, label }) => {
                const x = typeof label === "number" ? label : Number(label);
                if (!Number.isFinite(x)) return null;
                return (
                  <InterpolatedTooltip
                    active={active}
                    label={x}
                    rows={[
                      { name: "Steps", value: interpolateLinear(stepsData, x), color: C.steps, formatter: (v) => `${Math.round(v)}` },
                    ]}
                  />
                );
              }}
            />
            {bands}
            <Line dataKey="y" dot={false} stroke={C.steps} strokeWidth={1.4} {...NO_ANIM} />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      {/* ── Group 3: Sleep Architecture ──────────────────────────────── */}
      <GroupTitle title="Sleep Architecture" />

      <Panel label="Sleep State" height={150}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={hypnoData} margin={MARGIN}>
            {grid} <XAx domain={domain} ticks={axisTicks} />
            <YAxis hide domain={[-0.5, 3.5]} ticks={[0, 1, 2, 3]} />
            <Tooltip
              content={({ active, label }) => {
                const x = typeof label === "number" ? label : Number(label);
                if (!Number.isFinite(x)) return null;
                const stateValue = interpolateStepAfter(hypnoData, x);
                const stateLabel = stateValue == null
                  ? null
                  : ["Out of Bed", "Awake", "Light Sleep", "Deep Sleep"][Math.round(stateValue)] ?? `${stateValue}`;

                return (
                  <InterpolatedTooltip
                    active={active}
                    label={x}
                    dateMs={latestObservedDate(x, [hypnoData])}
                    rows={[
                      {
                        name: "Sleep State",
                        value: stateValue,
                        color: C.sleep,
                        formatter: () => stateLabel ?? "",
                      },
                    ]}
                  />
                );
              }}
            />
            {bands}
            <Line dataKey="y" dot={false} stroke={C.sleep} strokeWidth={1.5} type="stepAfter" {...NO_ANIM} />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      {/* ── Group 4: Clinical History ─────────────────────────────────── */}
      <GroupTitle title="Clinical History" />

      <Panel label="Clinical Events" height={150}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={clinData} margin={MARGIN}>
            {grid} <XAx domain={domain} ticks={axisTicks} />
            <YAxis hide domain={[0.5, 5.5]} ticks={[1, 2, 3, 4, 5]} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof clinData)[0];
                return (
                  <div className="bg-white border border-border/60 rounded-lg p-2 text-[11px] shadow-sm max-w-[220px]">
                    <div className="font-semibold">{d.category}</div>
                    <div className="text-muted-foreground mt-0.5">{d.description}</div>
                    <div className="mt-1">Severity: <b>{d.y}/5</b></div>
                    <div className="text-muted-foreground">{fmtDate(d.x)}</div>
                    {d.documentId != null && (
                      <div className="mt-1 text-primary font-medium">Click to view source PDF</div>
                    )}
                  </div>
                );
              }}
            />
            {bands}
            <Scatter dataKey="y" shape={<ClinicalDot />} {...NO_ANIM} />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
};

export default SensorCharts;
