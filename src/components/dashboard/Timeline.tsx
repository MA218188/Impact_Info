import { useState } from "react";
import type { DataLayerKey } from "@/pages/Index";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  visibleLayers: Record<DataLayerKey, boolean>;
  activeTimeScale: string;
  onTimeScaleChange: (scale: string) => void;
}

const timeScales = ["1M", "3M", "12M", "3Y", "All"];

const MONTHS_X = [117, 175, 233, 291, 349, 407, 465, 523, 581, 639, 694, 738];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GRID_X = [88, 146, 204, 262, 320, 378, 436, 494, 552, 610, 668, 720];

// Lane boundaries (top of each lane row)
const LANE_TOP = {
  hrSpo2: 22,
  visits: 80,
  alerts: 140,
  medications: 190,
  labs: 270,
  imaging: 350,
  notes: 410,
};
const SVG_H = 490;

const Timeline = ({ visibleLayers, activeTimeScale, onTimeScaleChange }: Props) => {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex-1 flex flex-col min-w-0">
        {/* Time controls */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-border/60">
          <div className="flex bg-secondary/60 rounded-lg p-[2px] gap-[1px] border border-border/60">
            {timeScales.map((s) => (
              <button
                key={s}
                onClick={() => onTimeScaleChange(s)}
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
          <span className="text-[11px] text-muted-foreground">Jan 2024 – Mar 2025</span>
        </div>

        {/* SVG Timeline */}
        <div className="flex-1 overflow-hidden relative">
          <svg
            className="w-full h-full"
            viewBox={`0 0 760 ${SVG_H}`}
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Lane label bg */}
            <rect x="0" y="0" width="88" height={SVG_H} fill="hsl(220 15% 96%)" opacity="0.5" />

            {/* Grid lines */}
            {GRID_X.map((x) => (
              <line key={x} x1={x} y1="22" x2={x} y2={SVG_H - 10} stroke="hsl(220 15% 90%)" strokeWidth="0.5" />
            ))}

            {/* Month labels */}
            {MONTHS.map((m, i) => (
              <text key={m} x={MONTHS_X[i]} y="14" textAnchor="middle" fontSize="10" fill="#888780" fontFamily="inherit">
                {m}
              </text>
            ))}

            {/* Lane separators */}
            {Object.values(LANE_TOP).map((y) => (
              <line key={y} x1="0" y1={y} x2="760" y2={y} stroke="hsl(220 15% 90%)" strokeWidth="0.5" />
            ))}

            {/* Lane labels — centered vertically in each lane */}
            <text x="84" y={(LANE_TOP.hrSpo2 + LANE_TOP.visits) / 2 + 4} textAnchor="end" fontSize="10" fill="#888780">HR / SpO₂</text>
            <text x="84" y={(LANE_TOP.visits + LANE_TOP.alerts) / 2 + 4} textAnchor="end" fontSize="10" fill="#888780">Visits</text>
            <text x="84" y={(LANE_TOP.alerts + LANE_TOP.medications) / 2 + 4} textAnchor="end" fontSize="10" fill="#888780">Alerts</text>
            <text x="84" y={(LANE_TOP.medications + LANE_TOP.labs) / 2 + 4} textAnchor="end" fontSize="9" fill="#888780">Medications</text>
            <text x="84" y={(LANE_TOP.labs + LANE_TOP.imaging) / 2 + 4} textAnchor="end" fontSize="10" fill="#888780">Labs</text>
            <text x="84" y={(LANE_TOP.imaging + LANE_TOP.notes) / 2 + 4} textAnchor="end" fontSize="10" fill="#888780">Imaging</text>
            <text x="84" y={(LANE_TOP.notes + SVG_H) / 2 + 4} textAnchor="end" fontSize="10" fill="#888780">Notes</text>

            {/* Today line */}
            <line x1="706" y1="22" x2="706" y2={SVG_H - 10} stroke="#A32D2D" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
            <text x="706" y={SVG_H - 2} textAnchor="middle" fontSize="9" fill="#A32D2D">today</text>

            {/* LANE 1: HR / SpO2 */}
            {visibleLayers.sensor && (
              <>
                <polyline
                  fill="none" stroke="#185FA5" strokeWidth="1.4" opacity="0.75"
                  strokeLinecap="round" strokeLinejoin="round"
                  points="88,52 108,47 128,54 148,49 175,44 196,51 220,48 242,56 262,42 285,50 305,45 320,53 342,49 362,55 378,46 400,52 420,48 436,44 460,51 477,57 494,49 516,52 540,46 558,53 580,49 602,44 620,52 640,48 660,56 680,46 706,44"
                />
                <polyline
                  fill="none" stroke="#85B7EB" strokeWidth="0.8" opacity="0.45"
                  strokeLinecap="round"
                  points="88,65 128,64 175,65 220,63 262,66 305,64 342,65 378,63 420,64 460,66 500,63 540,65 580,64 620,65 660,63 706,64"
                />
              </>
            )}

            {/* LANE 2: Visits */}
            {visibleLayers.cardioVisits && (
              <>
                <VisitRect x={105} label="Cardio" doctor="Dr Reiter" type="cardio" date="Jan 15, 2024" notes="Routine follow-up. ECG normal sinus rhythm. BP 138/82." />
                <VisitRect x={286} label="Cardio" doctor="Dr Reiter" type="cardio" date="Apr 10, 2024" notes="Stable. Continue current meds. Watch renal function closely." />
                <VisitRect x={540} label="Cardio" doctor="Dr Reiter" type="cardio" date="Sep 22, 2024" notes="Dizziness reported. K+ rising. Consider stopping spironolactone." />
              </>
            )}
            {visibleLayers.gpVisits && (
              <>
                <VisitRect x={160} label="GP" doctor="Dr Hofer" type="gp" date="Feb 8, 2024" notes="Ankle oedema noted. Referred to cardiology. Adjusted diuretic." />
                <VisitRect x={366} label="GP" doctor="Dr Hofer" type="gp" date="Jun 5, 2024" notes="Fatigue increasing. Started spironolactone 25mg." />
                <VisitRect x={610} label="GP" doctor="Dr Hofer" type="gp" date="Oct 18, 2024" notes="Urgent: review meds. K+ elevated. Coordinating with cardiology." />
              </>
            )}

            {/* LANE 3: Alerts */}
            {visibleLayers.drugAlerts && (
              <>
                <rect x="395" y={LANE_TOP.alerts + 5} width="78" height="22" rx="5" fill="#FCEBEB" stroke="#A32D2D" strokeWidth="0.8" />
                <rect x="398" y={LANE_TOP.alerts + 8} width="3" height="16" rx="1" fill="#A32D2D" />
                <text x="408" y={LANE_TOP.alerts + 20} fontSize="8" fill="#791F1F" fontWeight="500">Spiro+Ramipril</text>

                <rect x="490" y={LANE_TOP.alerts + 5} width="72" height="22" rx="5" fill="#FAEEDA" stroke="#854F0B" strokeWidth="0.8" />
                <rect x="493" y={LANE_TOP.alerts + 8} width="3" height="16" rx="1" fill="#854F0B" />
                <text x="503" y={LANE_TOP.alerts + 17} fontSize="8" fill="#633806" fontWeight="500">NSAID+ACEi</text>
                <text x="503" y={LANE_TOP.alerts + 25} fontSize="7" fill="#854F0B">Renal risk</text>
              </>
            )}

            {/* LANE 4: Medications */}
            <rect x="88" y={LANE_TOP.medications + 10} width="618" height="13" rx="3" fill="#185FA5" opacity="0.18" />
            <rect x="88" y={LANE_TOP.medications + 10} width="618" height="13" rx="3" fill="none" stroke="#185FA5" strokeWidth="0.4" opacity="0.5" />
            <text x="93" y={LANE_TOP.medications + 20} fontSize="9" fill="#0C447C">Ramipril 5mg</text>

            {visibleLayers.drugAlerts && (
              <>
                <rect x="475" y={LANE_TOP.medications + 10} width="58" height="13" rx="3" fill="#A32D2D" opacity="0.2" />
                <rect x="475" y={LANE_TOP.medications + 10} width="58" height="13" rx="3" fill="none" stroke="#A32D2D" strokeWidth="0.6" opacity="0.7" />
                <text x="480" y={LANE_TOP.medications + 20} fontSize="9" fill="#791F1F">Ibuprofen</text>
              </>
            )}

            <rect x="88" y={LANE_TOP.medications + 28} width="618" height="13" rx="3" fill="#0F6E56" opacity="0.15" />
            <rect x="88" y={LANE_TOP.medications + 28} width="618" height="13" rx="3" fill="none" stroke="#0F6E56" strokeWidth="0.4" opacity="0.5" />
            <text x="93" y={LANE_TOP.medications + 38} fontSize="9" fill="#085041">Metformin 1000mg</text>

            <rect x="400" y={LANE_TOP.medications + 46} width="306" height="13" rx="3" fill="#854F0B" opacity="0.18" />
            <rect x="400" y={LANE_TOP.medications + 46} width="306" height="13" rx="3" fill="none" stroke="#854F0B" strokeWidth="0.4" opacity="0.5" />
            <text x="405" y={LANE_TOP.medications + 56} fontSize="9" fill="#633806">Spironolactone 25mg</text>
            <circle cx="400" cy={LANE_TOP.medications + 52} r="3" fill="#854F0B" opacity="0.9" />

            {/* LANE 5: Labs */}
            {visibleLayers.labResults && (
              <>
                <LabDot cx={117} cy={LANE_TOP.labs + 25} value="68" color="#534AB7" textColor="#3C3489" label="eGFR — Estimated Glomerular Filtration Rate. Normal >60. Measures kidney function." />
                <LabDot cx={300} cy={LANE_TOP.labs + 30} value="64" color="#534AB7" textColor="#3C3489" label="eGFR — Declining from 68. Mild impairment." />
                <LabDot cx={460} cy={LANE_TOP.labs + 35} value="61" color="#534AB7" textColor="#3C3489" label="eGFR — Borderline. Approaching CKD Stage 3." />
                <LabDot cx={636} cy={LANE_TOP.labs + 42} value="57" color="#A32D2D" textColor="#791F1F" label="eGFR — Below 60. CKD Stage 3a. Urgent review." r={6} />
                <polyline fill="none" stroke="#534AB7" strokeWidth="1" strokeDasharray="3 2" opacity="0.35" points={`117,${LANE_TOP.labs + 25} 300,${LANE_TOP.labs + 30} 460,${LANE_TOP.labs + 35} 636,${LANE_TOP.labs + 42}`} />
                <text x="650" y={LANE_TOP.labs + 42} fontSize="8" fill="#A32D2D">eGFR</text>

                <LabDot cx={204} cy={LANE_TOP.labs + 50} value="" color="#854F0B" textColor="#633806" label="HbA1c 7.2% — Glycated hemoglobin. Target <7%. Average blood sugar over 3 months." r={4} />
                <text x="204" y={LANE_TOP.labs + 62} textAnchor="middle" fontSize="8" fill="#633806">7.2%</text>
                <LabDot cx={510} cy={LANE_TOP.labs + 48} value="" color="#854F0B" textColor="#633806" label="HbA1c 6.9% — Improved glycemic control. Closer to target." r={4} />
                <text x="510" y={LANE_TOP.labs + 60} textAnchor="middle" fontSize="8" fill="#633806">6.9%</text>

                <LabDot cx={636} cy={LANE_TOP.labs + 15} value="" color="#A32D2D" textColor="#791F1F" label="Potassium 5.4 mmol/L — Above normal (3.5-5.0). Risk of cardiac arrhythmia. Likely due to Spiro + Ramipril." r={4} />
                <text x="636" y={LANE_TOP.labs + 10} textAnchor="middle" fontSize="8" fill="#791F1F">K+5.4</text>
              </>
            )}

            {/* LANE 6: Imaging */}
            {visibleLayers.imaging && (
              <>
                <ImagingRect x={155} label="Echo" sub="Feb" laneTop={LANE_TOP.imaging} />
                <ImagingRect x={456} label="CXR" sub="Jul" laneTop={LANE_TOP.imaging} />
                <ImagingRect x={630} label="CT" sub="Oct" laneTop={LANE_TOP.imaging} />
              </>
            )}

            {/* LANE 7: Notes */}
            {visibleLayers.notes && (
              <>
                <NoteDiamond cx={123} fill="#E1F5EE" stroke="#0F6E56" textColor="#085041" label="dyspnoea on exertion" laneTop={LANE_TOP.notes} date="Jan 20, 2024" doctor="Dr Hofer" fullNote="Patient reports increasing dyspnoea on exertion over 2 weeks. No orthopnoea. Chest clear on auscultation. Consider echo referral." />
                <NoteDiamond cx={195} fill="#FAEEDA" stroke="#854F0B" textColor="#633806" label="ankle oedema" laneTop={LANE_TOP.notes} date="Feb 8, 2024" doctor="Dr Hofer" fullNote="Bilateral ankle oedema noted. Pitting 2+. Weight up 3kg from baseline. Started furosemide 40mg. Referred cardiology." />
                <NoteDiamond cx={304} fill="#E1F5EE" stroke="#0F6E56" textColor="#085041" label="stable, watch renal" laneTop={LANE_TOP.notes} date="Apr 10, 2024" doctor="Dr Reiter" fullNote="Patient stable on current regime. eGFR 64 — mild decline. Continue monitoring renal function. Review in 3 months." />
                <NoteDiamond cx={400} fill="#FAEEDA" stroke="#854F0B" textColor="#633806" label="fatigue · spiro" laneTop={LANE_TOP.notes} date="Jun 5, 2024" doctor="Dr Hofer" fullNote="Fatigue worsening over past month. Started spironolactone 25mg for HF. Monitor potassium closely given concurrent Ramipril." />
                <NoteDiamond cx={558} fill="#E1F5EE" stroke="#0F6E56" textColor="#085041" label="dizzy · K+ rising" laneTop={LANE_TOP.notes} date="Sep 22, 2024" doctor="Dr Reiter" fullNote="Dizziness on standing. K+ 5.4 — rising trend. Consider stopping spironolactone. Check renal function urgently." />
                <NoteDiamond cx={645} fill="#FAEEDA" stroke="#854F0B" textColor="#633806" label="review meds" laneTop={LANE_TOP.notes} date="Oct 18, 2024" doctor="Dr Hofer" fullNote="Urgent medication review. K+ elevated at 5.4. eGFR 57 — CKD Stage 3a. Coordinating with cardiology. Consider stopping spironolactone and ibuprofen." />
              </>
            )}
          </svg>
        </div>
      </div>
    </TooltipProvider>
  );
};

/* ---------- Sub-components ---------- */

const VisitRect = ({
  x, label, doctor, type, date, notes,
}: {
  x: number; label: string; doctor: string; type: "cardio" | "gp"; date: string; notes: string;
}) => {
  const w = type === "cardio" ? 36 : 30;
  const bg = type === "cardio" ? "#E1F5EE" : "#FAEEDA";
  const border = type === "cardio" ? "#0F6E56" : "#854F0B";
  const textDark = type === "cardio" ? "#085041" : "#633806";
  const textLight = type === "cardio" ? "#0F6E56" : "#854F0B";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <g className="cursor-pointer">
          <rect x={x} y={86} width={w} height={30} rx={6} fill={bg} stroke={border} strokeWidth={0.8} />
          <text x={x + w / 2} y={99} textAnchor="middle" fontSize="9" fill={textDark} fontWeight="500">{label}</text>
          <text x={x + w / 2} y={109} textAnchor="middle" fontSize="8" fill={textLight}>{doctor}</text>
        </g>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] p-3">
        <p className="text-xs font-semibold text-foreground mb-1">{label} — {doctor}</p>
        <p className="text-[11px] text-muted-foreground mb-1">{date}</p>
        <p className="text-[11px] text-foreground/80 mb-2">{notes}</p>
        <Dialog>
          <DialogTrigger asChild>
            <button className="text-[11px] text-primary font-medium hover:underline">
              View full report →
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{label} Visit — {doctor}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div><span className="font-medium">Date:</span> {date}</div>
              <div><span className="font-medium">Summary:</span> {notes}</div>
              <div className="border-t pt-3 space-y-2">
                <p className="font-medium">Structured Data</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-secondary/50 rounded-lg p-2"><span className="text-muted-foreground">BP:</span> 138/82 mmHg</div>
                  <div className="bg-secondary/50 rounded-lg p-2"><span className="text-muted-foreground">HR:</span> 72 bpm</div>
                  <div className="bg-secondary/50 rounded-lg p-2"><span className="text-muted-foreground">SpO₂:</span> 97%</div>
                  <div className="bg-secondary/50 rounded-lg p-2"><span className="text-muted-foreground">Weight:</span> 84 kg</div>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3 text-xs">
                  <p className="font-medium mb-1">Clinical Notes</p>
                  <p className="text-muted-foreground">{notes} Patient advised on medication compliance. Follow-up scheduled in 6 weeks.</p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </TooltipContent>
    </Tooltip>
  );
};

const LabDot = ({
  cx, cy, value, color, textColor, label, r = 5,
}: {
  cx: number; cy: number; value: string; color: string; textColor: string; label: string; r?: number;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <g className="cursor-pointer">
        <circle cx={cx} cy={cy} r={r} fill={color} />
        {value && (
          <text x={cx} y={cy - r - 2} textAnchor="middle" fontSize="9" fill={textColor}>{value}</text>
        )}
      </g>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-[240px]">
      <p className="text-xs text-foreground">{label}</p>
    </TooltipContent>
  </Tooltip>
);

const ImagingRect = ({ x, label, sub, laneTop }: { x: number; label: string; sub: string; laneTop: number }) => (
  <g>
    <rect x={x} y={laneTop + 10} width={38} height={28} rx={5} fill="hsl(220 15% 96%)" stroke="hsl(220 15% 85%)" strokeWidth={0.5} />
    <text x={x + 19} y={laneTop + 23} textAnchor="middle" fontSize="9" fill="#666" fontWeight="500">{label}</text>
    <text x={x + 19} y={laneTop + 33} textAnchor="middle" fontSize="7" fill="#999">{sub}</text>
  </g>
);

const NoteDiamond = ({
  cx, fill, stroke, textColor, label, laneTop, date, doctor, fullNote,
}: {
  cx: number; fill: string; stroke: string; textColor: string; label: string; laneTop: number; date: string; doctor: string; fullNote: string;
}) => {
  const [open, setOpen] = useState(false);
  const dy = laneTop + 12;

  return (
    <>
      <g className="cursor-pointer" onClick={() => setOpen(true)}>
        <polygon points={`${cx},${dy} ${cx + 6},${dy + 7} ${cx},${dy + 14} ${cx - 6},${dy + 7}`} fill={fill} stroke={stroke} strokeWidth={0.8} />
        <line x1={cx} y1={dy + 14} x2={cx} y2={dy + 22} stroke={stroke} strokeWidth={0.5} strokeDasharray="2 2" opacity={0.5} />
        <text x={cx} y={dy + 32} textAnchor="middle" fontSize="7.5" fill={textColor}>{label}</text>
      </g>

      {open && (
        <foreignObject x="0" y="0" width="1" height="1" overflow="visible">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Clinical Note — {doctor}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div><span className="font-medium">Date:</span> {date}</div>
                <div><span className="font-medium">Provider:</span> {doctor}</div>
                <div className="border-t pt-3">
                  <p className="font-medium mb-2">Note</p>
                  <p className="text-muted-foreground">{fullNote}</p>
                </div>
                <div className="border-t pt-3 space-y-2">
                  <p className="font-medium">Related Data</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-secondary/50 rounded-lg p-2"><span className="text-muted-foreground">BP:</span> 138/82 mmHg</div>
                    <div className="bg-secondary/50 rounded-lg p-2"><span className="text-muted-foreground">HR:</span> 72 bpm</div>
                    <div className="bg-secondary/50 rounded-lg p-2"><span className="text-muted-foreground">eGFR:</span> 64 mL/min</div>
                    <div className="bg-secondary/50 rounded-lg p-2"><span className="text-muted-foreground">K+:</span> 4.8 mmol/L</div>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-3 text-xs">
                    <p className="font-medium mb-1">Active Medications at Time of Note</p>
                    <p className="text-muted-foreground">Ramipril 5mg · Metformin 1000mg · Furosemide 40mg</p>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </foreignObject>
      )}
    </>
  );
};

export default Timeline;
