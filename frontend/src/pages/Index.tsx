import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PatientHeader from "@/components/dashboard/PatientHeader";
import PatientSidebar from "@/components/dashboard/PatientSidebar";
import Timeline from "@/components/dashboard/Timeline";
import SensorCharts from "@/components/dashboard/SensorCharts";
import { fetchManifest } from "@/lib/api";

export type DataLayerKey = "sensor" | "cardioVisits" | "gpVisits" | "drugAlerts" | "labResults" | "imaging" | "notes";


const LABEL_COL_W = 88;
const DATA_X_START = 88;
const DATA_X_END = 720;
const LABEL_BG = "hsl(220 15% 96%)";
const GRID_STROKE = "hsl(220 15% 88%)";
const GRID_DASH = "3 3";

interface MasterTick {
  ms: number;
  label: string;
  offset: number;
}

function buildMasterTicks(minMs: number, maxMs: number): MasterTick[] {
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || maxMs <= minMs) return [];

  const durationDays = (maxMs - minMs) / 86400000;
  const intervalDays = durationDays <= 7 ? 1 : durationDays <= 35 ? 7 : 14;
  const intervalMs = intervalDays * 86400000;
  const firstTick = Math.ceil(minMs / intervalMs) * intervalMs;

  const ticks: MasterTick[] = [];
  for (let t = firstTick; t <= maxMs; t += intervalMs) {
    ticks.push({
      ms: t,
      label: new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      offset: (t - minMs) / (maxMs - minMs),
    });
  }
  return ticks;
}

function buildMockTicks(): MasterTick[] {
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return labels.map((label, i) => ({
    ms: i,
    label,
    offset: i / (labels.length - 1),
  }));
}

const Index = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(0);
  const [visibleLayers, setVisibleLayers] = useState<Record<DataLayerKey, boolean>>({
    sensor: true,
    cardioVisits: true,
    gpVisits: true,
    drugAlerts: true,
    labResults: true,
    imaging: true,
    notes: true,
  });
  const [activeNav, setActiveNav] = useState("Timeline");


  const isRealPatient = selectedPatient === 0;
  const { data: manifest } = useQuery({
    queryKey: ["manifest"],
    queryFn: fetchManifest,
    enabled: isRealPatient,
    staleTime: 300_000,
    retry: false,
  });
  const minMs = manifest?.timeBounds.minStartMs ?? 0;
  const maxMs = manifest?.timeBounds.maxEndMs ?? 0;
  const hasRealSensor = isRealPatient && !!manifest;
  const masterTicks = hasRealSensor ? buildMasterTicks(minMs, maxMs) : buildMockTicks();
  const showEveryTickLabel = masterTicks.length <= 12;
  const xTicksMs = hasRealSensor ? masterTicks.map((t) => t.ms) : [];
  const timelineGridX = masterTicks.map((t) => DATA_X_START + t.offset * (DATA_X_END - DATA_X_START));
  const timeRangeLabel = hasRealSensor
    ? `${new Date(minMs).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${new Date(maxMs).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : "Jan 2024 – Mar 2025";

  const toggleLayer = (key: DataLayerKey) => {
    setVisibleLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen w-full bg-sky-50 flex items-center justify-center p-6">
      <div className="w-full max-w-[1440px] flex bg-white rounded-2xl border border-border/60 overflow-hidden shadow-sm">
        <PatientSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
          selectedPatient={selectedPatient}
          onSelectPatient={setSelectedPatient}
          visibleLayers={visibleLayers}
          onToggleLayer={toggleLayer}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <PatientHeader activeNav={activeNav} onNavChange={setActiveNav} selectedPatient={selectedPatient} />

          <div className="flex-1 overflow-auto relative">
            {/* ── Timeline axis header ── */}
            <div className="flex border-b border-border/60" style={{ background: "linear-gradient(180deg, hsl(220 20% 98%) 0%, hsl(220 18% 96%) 100%)" }}>
              <div
                className="flex-shrink-0 border-r border-border/60 flex items-end justify-center pb-1.5"
                style={{ width: LABEL_COL_W, background: LABEL_BG }}
              >
                <span className="text-[9px] font-medium tracking-wide uppercase text-muted-foreground/70">{timeRangeLabel}</span>
              </div>
              <div className="relative flex-1 h-10">
                {/* Subtle background gridlines */}
                {masterTicks.map((tick) => (
                  <div
                    key={`master-grid-${tick.label}-${tick.offset}`}
                    className="absolute top-0 bottom-0 w-px"
                    style={{
                      left: `${tick.offset * 100}%`,
                      background: "hsl(220 15% 86% / 0.5)",
                    }}
                  />
                ))}
                {/* Tick marks at bottom */}
                {masterTicks.map((tick) => (
                  <div
                    key={`master-tick-${tick.label}-${tick.offset}`}
                    className="absolute bottom-0 w-px"
                    style={{
                      left: `${tick.offset * 100}%`,
                      height: 6,
                      background: "hsl(220 15% 72%)",
                    }}
                  />
                ))}
                {/* Labels */}
                {masterTicks.map((tick, idx) => (
                  (showEveryTickLabel || idx % 2 === 0) && (
                  <span
                    key={`master-label-${tick.label}-${tick.offset}`}
                    className="absolute top-2 text-[10px] font-semibold tracking-wide"
                    style={{
                      left: `${tick.offset * 100}%`,
                      transform: "translateX(-50%)",
                      color: "hsl(220 15% 48%)",
                    }}
                  >
                    {tick.label}
                  </span>
                  )
                ))}
                {/* Accent line at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, hsl(220 60% 65% / 0.15) 0%, hsl(220 60% 65% / 0.35) 50%, hsl(220 60% 65% / 0.15) 100%)" }} />
              </div>
            </div>

            <div className="dashboard-sensor-stack">
              <SensorCharts selectedPatient={selectedPatient} xTicks={xTicksMs} domain={hasRealSensor ? [minMs, maxMs] : undefined} />
            </div>
            <Timeline
              visibleLayers={visibleLayers}
              selectedPatient={selectedPatient}
              gridX={timelineGridX}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
