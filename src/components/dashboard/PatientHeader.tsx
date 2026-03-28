import { Menu, TrendingDown, AlertTriangle, ArrowUpRight } from "lucide-react";

const PatientHeader = () => {
  return (
    <header className="glass-panel-strong rounded-t-2xl px-6 py-4">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors">
            <Menu className="w-5 h-5 text-foreground/70" />
          </button>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Patients
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">
                Müller, Hans-Georg
              </h1>
              <span className="text-sm text-muted-foreground">· #PT-00471</span>
            </div>
            <p className="text-xs text-muted-foreground">
              M · 64 yrs · Cardiology + Nephrology · Last seen 3 days ago
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-alert-coral/10 border border-alert-coral/20">
            <AlertTriangle className="w-3.5 h-3.5 text-alert-coral" />
            <span className="text-xs font-semibold text-alert-coral">2 drug alerts</span>
          </div>
        </div>

        <nav className="flex items-center gap-6">
          {["Timeline", "Medications", "Labs", "Imaging"].map((item, i) => (
            <button
              key={item}
              className={`text-sm font-medium transition-colors ${
                i === 0
                  ? "text-primary border-b-2 border-primary pb-0.5"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-12 mt-4 pt-4 border-t border-border/50">
        <div>
          <div className="metric-value">14</div>
          <p className="text-xs text-muted-foreground mt-0.5">Active medications</p>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="metric-value">57</span>
            <div className="flex items-center gap-1 text-alert-coral">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs font-semibold">↓11</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">eGFR · down 11 pts in 12 mo</p>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="metric-value">5.4</span>
            <div className="flex items-center gap-1 text-alert-coral">
              <ArrowUpRight className="w-4 h-4" />
              <span className="text-xs font-semibold">↑</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">K+ mmol/L · above range</p>
        </div>
      </div>
    </header>
  );
};

export default PatientHeader;
