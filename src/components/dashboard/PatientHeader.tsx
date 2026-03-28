import { TrendingDown, ArrowUpRight, AlertTriangle } from "lucide-react";

interface Props {
  activeNav: string;
  onNavChange: (nav: string) => void;
}

const navItems = ["Timeline", "Medications", "Labs", "Imaging"];

const PatientHeader = ({ activeNav, onNavChange }: Props) => {
  return (
    <header className="flex flex-col border-b border-border/60">
      {/* Top bar */}
      <div className="h-14 px-5 flex items-center gap-3.5">
        <div>
          <div className="text-sm font-medium text-foreground">
            Müller, Hans-Georg{" "}
            <span className="text-muted-foreground font-normal">&nbsp;·&nbsp;#PT-00471</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            M · 64 yrs · Cardiology + Nephrology · Last seen 3 days ago
          </div>
        </div>
        <div className="w-px h-7 bg-border/60" />
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-destructive/8 border border-destructive/15">
          <div className="w-1.5 h-1.5 rounded-full bg-destructive" />
          <span className="text-[11px] font-medium text-destructive">2 drug alerts</span>
        </div>
        <div className="flex-1" />
        <div className="flex bg-secondary/60 rounded-[10px] p-[3px] gap-0.5 border border-border/60">
          {navItems.map((item) => (
            <button
              key={item}
              onClick={() => onNavChange(item)}
              className={`text-[11px] px-2.5 py-1 rounded-[7px] transition-all ${
                activeNav === item
                  ? "bg-white text-foreground font-medium border border-border/60 shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-3 border-t border-border/60">
        <div className="px-5 py-3 border-r border-border/60">
          <div className="text-xl font-medium text-foreground leading-none">14</div>
          <div className="text-[11px] text-muted-foreground mt-1">Active medications</div>
        </div>
        <div className="px-5 py-3 border-r border-border/60">
          <div className="text-xl font-medium text-destructive leading-none">57</div>
          <div className="text-[11px] text-muted-foreground mt-1">eGFR · down 11 pts in 12 mo</div>
        </div>
        <div className="px-5 py-3">
          <div className="text-xl font-medium text-destructive leading-none">5.4</div>
          <div className="text-[11px] text-muted-foreground mt-1">K+ mmol/L · above range</div>
        </div>
      </div>
    </header>
  );
};

export default PatientHeader;
