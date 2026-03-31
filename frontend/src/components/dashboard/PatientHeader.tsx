import { patientAllergies } from "../../data/patientAllergies";

const PATIENTS = [
  {
    name: "Müller, Hans-Georg",
    id: "#PT-00471",
    meta: "M · 64 yrs · Cardiology + Nephrology · Last seen 3 days ago",
  },
  {
    name: "Bauer, Ingrid",
    id: "#PT-00382",
    meta: "F · 71 yrs · Oncology · Last seen 1 week ago",
  },
  {
    name: "Schneider, Klaus",
    id: "#PT-00519",
    meta: "M · 58 yrs · Neurology · Last seen 5 days ago",
  },
  {
    name: "Fischer, Maria",
    id: "#PT-00274",
    meta: "F · 45 yrs · Endocrinology · Last seen 2 days ago",
  },
  {
    name: "Weber, Thomas",
    id: "#PT-00631",
    meta: "M · 77 yrs · Cardiology · Last seen today",
  },
  {
    name: "Klein, Sabine",
    id: "#PT-00447",
    meta: "F · 52 yrs · Rheumatology · Last seen 4 days ago",
  },
];

interface Props {
  activeNav: string;
  onNavChange: (nav: string) => void;
  selectedPatient: number;
}

const navItems = ["Timeline", "Medications", "Labs", "Imaging"];

const PatientHeader = ({ activeNav, onNavChange, selectedPatient }: Props) => {
  const patient = PATIENTS[selectedPatient] ?? PATIENTS[0];
  const isRealPatient = selectedPatient === 0;

  const allergies = patientAllergies[selectedPatient] ?? [];
  const severeAllergies = allergies.filter((a) => a.severity === "Severe").length;

  return (
    <div className="bg-[#F6F5F2] border-b border-border/60">
      {/* Top bar */}
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-[18px] font-medium text-foreground leading-tight">
            {patient.name} <span className="text-muted-foreground font-normal">· {patient.id}</span>
          </div>
          <div className="text-[12px] text-muted-foreground mt-1">{patient.meta}</div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`text-[11px] px-2.5 py-1 rounded-full border ${
              isRealPatient
                ? "bg-[#FDECEC] text-[#A32D2D] border-[#E9C9C9]"
                : "bg-white text-muted-foreground border-border/60"
            }`}
          >
            {isRealPatient ? "2 drug alerts" : "Draft data"}
          </div>

          <div className="flex items-center gap-1 rounded-[10px] bg-[#ECEAE5] p-1">
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
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-4 border-t border-border/60">
        <div className="px-5 py-3 border-r border-border/60">
          <div className="text-xl font-medium text-foreground leading-none">14</div>
          <div className="text-[11px] text-muted-foreground mt-1">Active medications</div>
        </div>

        <div className="px-5 py-3 border-r border-border/60">
          <div className="text-xl font-medium text-destructive leading-none">57</div>
          <div className="text-[11px] text-muted-foreground mt-1">eGFR · down 11 pts in 12 mo</div>
        </div>

        <div className="px-5 py-3 border-r border-border/60">
          <div className="text-xl font-medium text-destructive leading-none">5.4</div>
          <div className="text-[11px] text-muted-foreground mt-1">K+ mmol/L · above range</div>
        </div>

        <div className="relative group px-5 py-3">
          <div className="text-xl font-medium text-foreground leading-none">
            {allergies.length}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Allergies{severeAllergies > 0 ? ` · ${severeAllergies} severe` : ""}
          </div>

          <div className="pointer-events-none absolute right-4 top-full z-30 mt-2 w-72 rounded-xl border border-border/60 bg-white p-3 shadow-xl opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0 translate-y-1">
            <div className="text-xs font-semibold text-foreground mb-2">
              Recorded allergies
            </div>

            {allergies.length === 0 ? (
              <div className="text-[11px] text-muted-foreground">
                No known allergies recorded.
              </div>
            ) : (
              <div className="space-y-2">
                {allergies.map((allergy) => (
                  <div
                    key={allergy.name}
                    className="rounded-lg border border-border/50 px-2.5 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[12px] font-medium text-foreground">
                        {allergy.name}
                      </div>
                      <div
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          allergy.severity === "Severe"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : allergy.severity === "Moderate"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                      >
                        {allergy.severity}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {allergy.reaction}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientHeader;