import { ArrowUpRight } from "lucide-react";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const timeScales = ["1M", "3M", "12M", "3Y", "All"];

const Timeline = () => {
  return (
    <div className="flex-1 flex flex-col gap-0 min-w-0">
      {/* Time controls & month header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="glass-inset rounded-lg flex overflow-hidden">
          {timeScales.map((s, i) => (
            <button
              key={s}
              className={`px-3 py-1 text-[11px] font-medium transition-all ${
                i === 2
                  ? "bg-primary text-primary-foreground rounded-lg shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground font-medium">Jan 2024 – Mar 2025</span>
      </div>

      {/* Month labels */}
      <div className="flex px-4 border-b border-border/40">
        <div className="w-24 flex-shrink-0" />
        <div className="flex-1 flex">
          {months.map((m) => (
            <div key={m} className="flex-1 text-center">
              <span className="text-[11px] font-semibold text-muted-foreground">{m}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline rows */}
      <div className="flex-1 flex flex-col">
        {/* HR / SpO2 */}
        <TimelineRow label="HR / SpO2">
          <div className="relative w-full h-full">
            <svg className="w-full h-full" viewBox="0 0 1000 50" preserveAspectRatio="none">
              <path
                d="M0,30 C80,28 160,25 240,22 C320,19 400,18 480,20 C560,22 640,20 720,18 C800,16 880,17 1000,18"
                fill="none"
                stroke="hsl(220 70% 45%)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M0,35 C80,34 160,33 240,32 C320,31 400,32 480,33 C560,32 640,31 720,32 C800,33 880,32 1000,32"
                fill="none"
                stroke="hsl(220 70% 45% / 0.3)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray="4,4"
              />
            </svg>
            <div className="absolute left-[15%] top-1 glass-inset rounded px-1.5 py-0.5 text-[9px] font-medium text-primary">
              HR / SpO2
            </div>
          </div>
        </TimelineRow>

        {/* Visits */}
        <TimelineRow label="Visits">
          <div className="flex items-center h-full gap-0 relative w-full">
            <VisitCard left="2%" type="cardio" doctor="Dr Reiter" />
            <VisitCard left="12%" type="gp" doctor="Dr Hofer" />
            <VisitCard left="27%" type="cardio" doctor="Dr Reiter" />
            <VisitCard left="42%" type="gp" doctor="Dr Hofer" />
            <VisitCard left="72%" type="cardio" doctor="Dr Reiter" />
            <VisitCard left="85%" type="gp" doctor="Dr Hofer" />
          </div>
        </TimelineRow>

        {/* Alerts */}
        <TimelineRow label="Alerts">
          <div className="flex items-center h-full relative w-full">
            <div className="alert-card absolute" style={{ left: "52%" }}>
              Spiro + Ramipril
            </div>
            <div className="alert-card absolute" style={{ left: "68%" }}>
              <div>NSAID+ACEi</div>
              <div className="text-[9px] font-normal opacity-80">Renal risk</div>
            </div>
          </div>
        </TimelineRow>

        {/* Medications */}
        <TimelineRow label="Medications" tall>
          <div className="relative w-full h-full flex flex-col justify-center gap-1.5 py-1">
            <MedBar label="Ramipril 5mg" color="bg-sapphire/20 text-sapphire border-sapphire/30" left="0%" width="72%" />
            <div className="absolute medication-bar bg-alert-coral/15 text-alert-coral border border-alert-coral/25" style={{ left: "72%", width: "12%" }}>
              Ibuprofen
            </div>
            <MedBar label="Metformin 1000mg" color="bg-teal-data/20 text-teal-data border-teal-data/30" left="0%" width="98%" />
            <MedBar label="Spironolactone 25mg" color="bg-gold/20 text-gold border-gold/30" left="45%" width="53%" />
          </div>
        </TimelineRow>

        {/* Labs */}
        <TimelineRow label="Labs" tall>
          <div className="relative w-full h-full">
            {/* eGFR line */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 80" preserveAspectRatio="none">
              <path
                d="M50,25 L250,25 L500,35 L700,45 L950,60"
                fill="none"
                stroke="hsl(220 70% 45% / 0.3)"
                strokeWidth="1.5"
                strokeDasharray="6,4"
              />
            </svg>
            {/* Data points */}
            <LabDot value="68" left="5%" top="15%" color="bg-sapphire text-primary-foreground" />
            <LabDot value="64" left="27%" top="30%" color="bg-sapphire text-primary-foreground" />
            <LabDot value="61" left="55%" top="42%" color="bg-sapphire text-primary-foreground" />
            <LabDot value="57" left="88%" top="55%" color="bg-sapphire text-primary-foreground" />
            {/* HbA1c */}
            <div className="absolute text-[9px] font-semibold text-gold" style={{ left: "15%", top: "65%" }}>
              7.2%
            </div>
            <div className="absolute w-3 h-3 rounded-full bg-gold" style={{ left: "14%", top: "58%" }} />
            <div className="absolute text-[9px] font-semibold text-gold" style={{ left: "58%", top: "65%" }}>
              6.9%
            </div>
            <div className="absolute w-3 h-3 rounded-full bg-gold" style={{ left: "57%", top: "58%" }} />
            {/* K+ */}
            <div className="absolute flex items-center gap-1" style={{ left: "85%", top: "5%" }}>
              <span className="text-[9px] font-bold text-alert-coral">K+5.4</span>
            </div>
            <div className="absolute w-3 h-3 rounded-full bg-alert-coral animate-pulse-soft" style={{ left: "87%", top: "12%" }} />
            {/* eGFR label */}
            <div className="absolute text-[9px] font-semibold text-sapphire/60" style={{ right: "0%", top: "58%" }}>
              eGFR
            </div>
          </div>
        </TimelineRow>

        {/* Imaging */}
        <TimelineRow label="Imaging">
          <div className="flex items-center h-full relative w-full">
            <ImagingCard left="12%" label="Echo" sub="Feb" />
            <ImagingCard left="55%" label="CXR" sub="Jul" />
            <ImagingCard left="88%" label="CT" sub="Dec" />
          </div>
        </TimelineRow>

        {/* Notes */}
        <TimelineRow label="Notes">
          <div className="flex items-center h-full relative w-full">
            <NoteDiamond left="5%" label="dyspnoea on exertion" color="bg-jade" />
            <NoteDiamond left="13%" label="ankle oedema noted" color="bg-gold" />
            <NoteDiamond left="27%" label="stable, watch renal fn" color="bg-jade" />
            <NoteDiamond left="42%" label="fatigue · started spiro" color="bg-gold" />
            <NoteDiamond left="72%" label="dizziness · K+ rising" color="bg-jade" />
            <NoteDiamond left="85%" label="review meds urgently" color="bg-gold" />
          </div>
        </TimelineRow>
      </div>

      {/* Today marker */}
      <div className="absolute right-[6%] top-0 bottom-0 w-px border-l border-dashed border-alert-coral/40 pointer-events-none z-10">
        <span className="absolute bottom-1 -left-4 text-[9px] font-semibold text-alert-coral">today</span>
      </div>
    </div>
  );
};

/* Sub-components */

const TimelineRow = ({ label, children, tall }: { label: string; children: React.ReactNode; tall?: boolean }) => (
  <div className={`flex border-b border-border/30 ${tall ? "min-h-[80px]" : "min-h-[48px]"}`}>
    <div className="w-24 flex-shrink-0 flex items-center px-4">
      <span className="timeline-row-label">{label}</span>
    </div>
    <div className="flex-1 relative overflow-hidden py-1">
      {children}
    </div>
  </div>
);

const VisitCard = ({ left, type, doctor }: { left: string; type: "cardio" | "gp"; doctor: string }) => (
  <div
    className={`visit-card absolute ${
      type === "cardio"
        ? "bg-teal-data/15 text-teal-data border-teal-data/30"
        : "bg-gold/15 text-gold border-gold/30"
    }`}
    style={{ left }}
  >
    <div className="font-semibold">{type === "cardio" ? "Cardio" : "GP"}</div>
    <div className="text-[9px] opacity-80">{doctor}</div>
  </div>
);

const MedBar = ({ label, color, left, width }: { label: string; color: string; left: string; width: string }) => (
  <div
    className={`medication-bar border ${color}`}
    style={{ marginLeft: left, width }}
  >
    {label}
  </div>
);

const LabDot = ({ value, left, top, color }: { value: string; left: string; top: string; color: string }) => (
  <div className="absolute" style={{ left, top }}>
    <div className={`lab-dot ${color}`}>{value}</div>
  </div>
);

const ImagingCard = ({ left, label, sub }: { left: string; label: string; sub: string }) => (
  <div
    className="absolute glass-inset rounded-lg px-2.5 py-1.5 text-center"
    style={{ left }}
  >
    <div className="text-[10px] font-bold text-foreground">{label}</div>
    <div className="text-[8px] text-muted-foreground">{sub}</div>
  </div>
);

const NoteDiamond = ({ left, label, color }: { left: string; label: string; color: string }) => (
  <div className="absolute flex flex-col items-center gap-0.5" style={{ left }}>
    <div className={`note-diamond ${color}/60`} />
    <span className="text-[8px] text-muted-foreground whitespace-nowrap max-w-[80px] truncate">{label}</span>
  </div>
);

export default Timeline;
