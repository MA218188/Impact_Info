import { Search, User } from "lucide-react";

const patients = [
  { name: "Müller, Hans-Georg", age: 64, dept: "Cardiology", color: "bg-alert-coral", active: true },
  { name: "Bauer, Ingrid", age: 71, dept: "Oncology", color: "bg-onco", active: false },
  { name: "Schneider, Klaus", age: 58, dept: "Neurology", color: "bg-neuro", active: false },
  { name: "Fischer, Maria", age: 45, dept: "Endocrinology", color: "bg-endocrine", active: false },
  { name: "Weber, Thomas", age: 77, dept: "Cardiology", color: "bg-cardio", active: false },
  { name: "Klein, Sabine", age: 52, dept: "Rheumatology", color: "bg-rheumatology", active: false },
];

const dataLayers = [
  { label: "Sensor / wearable", color: "bg-sapphire" },
  { label: "Cardiology visits", color: "bg-teal-data" },
  { label: "GP visits", color: "bg-gold" },
  { label: "Drug alerts", color: "bg-alert-coral" },
  { label: "Lab results", color: "bg-cardio" },
  { label: "Imaging", color: "bg-muted-foreground" },
];

const PatientSidebar = () => {
  return (
    <aside className="w-60 flex-shrink-0 flex flex-col gap-4">
      {/* Search */}
      <div className="glass-panel rounded-xl p-2">
        <div className="glass-inset rounded-lg flex items-center gap-2 px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search patients…"
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
          />
        </div>
      </div>

      {/* Patient list */}
      <div className="glass-panel rounded-xl p-2 flex-1">
        <div className="space-y-1">
          {patients.map((p) => (
            <div
              key={p.name}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                p.active
                  ? "bg-primary/8 border border-primary/15"
                  : "hover:bg-secondary/50"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${p.color} flex-shrink-0`} />
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${p.active ? "text-foreground" : "text-foreground/80"}`}>
                  {p.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {p.age} · {p.dept}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data layers */}
      <div className="glass-panel rounded-xl p-3">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">
          Data Layers
        </h3>
        <div className="space-y-1.5">
          {dataLayers.map((l) => (
            <div key={l.label} className="flex items-center gap-2.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
              <span className="text-[11px] text-foreground/70">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};

export default PatientSidebar;
