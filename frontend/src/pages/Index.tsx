import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PatientHeader from "@/components/dashboard/PatientHeader";
import PatientSidebar from "@/components/dashboard/PatientSidebar";
import Timeline from "@/components/dashboard/Timeline";
import SensorCharts from "@/components/dashboard/SensorCharts";
import AIFooter from "@/components/dashboard/AIFooter";
import { fetchManifest } from "@/lib/api";

export type DataLayerKey = "sensor" | "cardioVisits" | "gpVisits" | "drugAlerts" | "labResults" | "imaging" | "notes";

const timeScales = ["1M", "3M", "12M", "3Y", "All"];
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
  const [activeTimeScale, setActiveTimeScale] = useState("12M");

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

          {/* Time controls — always at top */}
          <div className="flex items-center gap-2 px-5 py-2 border-b border-border/60">
            <div className="flex bg-secondary/60 rounded-lg p-[2px] gap-[1px] border border-border/60">
              {timeScales.map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveTimeScale(s)}
                  className={`text-[11px] px-2.5 py-[3px] rounded-md transition-all ${
                    activeTimeScale === s
                      ? "bg-white text-foreground font-medium border border-border/60 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <span className="text-[11px] text-muted-foreground">{timeRangeLabel}</span>
          </div>

          <div className="flex-1 overflow-auto relative">
            <div className="flex border-b border-border/60">
              <div
                className="flex-shrink-0 border-r border-border/60"
                style={{ width: LABEL_COL_W, background: LABEL_BG }}
              />
              <div className="relative flex-1 h-9">
                {masterTicks.map((tick) => (
                  <div
                    key={`master-grid-${tick.label}-${tick.offset}`}
                    className="absolute top-0 bottom-0 w-px"
                    style={{
                      left: `${tick.offset * 100}%`,
                      backgroundImage: `repeating-linear-gradient(to bottom, ${GRID_STROKE} 0 3px, transparent 3px 6px)`,
                    }}
                  />
                ))}
                {masterTicks.map((tick, idx) => (
                  (showEveryTickLabel || idx % 2 === 0) && (
                  <span
                    key={`master-label-${tick.label}-${tick.offset}`}
                    className="absolute top-2.5 text-[10.5px] font-medium text-muted-foreground"
                    style={{ left: `${tick.offset * 100}%`, transform: "translateX(-50%)" }}
                  >
                    {tick.label}
                  </span>
                  )
                ))}
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
          <AIFooter />
        </div>
      </div>
    </div>
  );
};

export default Index;
