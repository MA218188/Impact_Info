import { useState } from "react";
import { Search, Menu, User, Check } from "lucide-react";
import type { DataLayerKey } from "@/pages/Index";

const patients = [
  { name: "Müller, Hans-Georg", age: 64, dept: "Cardiology", color: "#A32D2D", active: true },
  { name: "Bauer, Ingrid", age: 71, dept: "Oncology", color: "#185FA5", active: false },
  { name: "Schneider, Klaus", age: 58, dept: "Neurology", color: "#0F6E56", active: false },
  { name: "Fischer, Maria", age: 45, dept: "Endocrinology", color: "#854F0B", active: false },
  { name: "Weber, Thomas", age: 77, dept: "Cardiology", color: "#534AB7", active: false },
  { name: "Klein, Sabine", age: 52, dept: "Rheumatology", color: "#993556", active: false },
];

const dataLayers: { key: DataLayerKey; label: string; color: string }[] = [
  { key: "sensor", label: "Sensor / wearable", color: "#185FA5" },
  { key: "cardioVisits", label: "Cardiology visits", color: "#0F6E56" },
  { key: "gpVisits", label: "GP visits", color: "#854F0B" },
  { key: "drugAlerts", label: "Drug alerts", color: "#A32D2D" },
  { key: "labResults", label: "Lab results", color: "#534AB7" },
  { key: "imaging", label: "Imaging", color: "#888780" },
  { key: "notes", label: "Notes", color: "#0F6E56" },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  visibleLayers: Record<DataLayerKey, boolean>;
  onToggleLayer: (key: DataLayerKey) => void;
}

const PatientSidebar = ({ collapsed, onToggle, visibleLayers, onToggleLayer }: Props) => {
  const [activePatient, setActivePatient] = useState(0);
  const [search, setSearch] = useState("");

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside
      className={`flex-shrink-0 flex flex-col border-r border-border/60 bg-secondary/40 transition-all duration-250 ease-in-out overflow-hidden ${
        collapsed ? "w-12 min-w-12" : "w-[220px] min-w-[220px]"
      }`}
    >
      {/* Toggle */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border/60">
        <button
          onClick={onToggle}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white transition-colors text-muted-foreground flex-shrink-0"
        >
          <Menu className="w-3.5 h-3.5" />
        </button>
        {!collapsed && (
          <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Patients
          </span>
        )}
      </div>

      {!collapsed && (
        <>
          {/* Search */}
          <div className="px-2.5 pt-2.5 pb-1.5 relative">
            <Search className="absolute left-[18px] top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search patients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-[30px] rounded-lg border border-border/60 bg-white text-xs text-foreground pl-7 pr-2.5 outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Patient list */}
          <div className="flex-1 overflow-y-auto px-1.5 py-1">
            {filtered.map((p, i) => (
              <div
                key={p.name}
                onClick={() => setActivePatient(i)}
                className={`flex items-start gap-1.5 px-2 py-2 rounded-[10px] cursor-pointer mb-0.5 transition-colors ${
                  i === activePatient
                    ? "bg-white border border-border/60"
                    : "hover:bg-white/60"
                }`}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[5px]"
                  style={{ background: p.color }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.age} · {p.dept}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Data layers */}
          <div className="px-2.5 py-2.5 border-t border-border/60">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-1.5">
              Data layers
            </p>
            {dataLayers.map((l) => (
              <div
                key={l.key}
                onClick={() => onToggleLayer(l.key)}
                className="flex items-center gap-2 py-1 px-0.5 cursor-pointer group"
              >
                <div
                  className={`w-[7px] h-[7px] rounded-sm flex-shrink-0 transition-opacity ${
                    visibleLayers[l.key] ? "opacity-100" : "opacity-25"
                  }`}
                  style={{ background: l.color }}
                />
                <span
                  className={`text-[11px] transition-opacity ${
                    visibleLayers[l.key]
                      ? "text-foreground/70"
                      : "text-muted-foreground/40 line-through"
                  }`}
                >
                  {l.label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
};

export default PatientSidebar;
