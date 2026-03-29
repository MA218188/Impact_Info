import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DataLayerKey } from "@/pages/Index";
import { fetchManifest } from "@/lib/api";
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
  selectedPatient: number;
  gridX?: number[];
}

// Mock x-axis (Jan–Dec for draft patients)
const GRID_X = [55, 146, 204, 262, 320, 378, 436, 494, 552, 610, 668, 720];
const LABEL_COL_W = 55;
const LABEL_FILL = "hsl(220 15% 96%)";
const LABEL_TEXT = "#5f5e57";
const TRACK_DIVIDER = "hsl(220 15% 86%)";
const GRID_STROKE = "hsl(220 15% 88%)";
const GRID_DASH = "3 3";

const LANE_TOP = {
  visits: 8,
  alerts: 79,
  medications: 134,
  labs: 224,
  imaging: 314,
  notes: 384,
};
const SVG_H = 480;

const LANE_CENTER = {
  visits: LANE_TOP.visits + 22,
  alerts: LANE_TOP.alerts + 16,
  medications: LANE_TOP.medications + 34,
  labs: LANE_TOP.labs + 34,
  imaging: LANE_TOP.imaging + 24,
  notes: LANE_TOP.notes + 30,
};

// SVG x range for data
const X_START = 88;
const X_END = 720;
const X_WIDTH = X_END - X_START;

const CARDIO_VISITS = [
  { x: 105, date: "Jan 15, 2024", notes: "Routine follow-up. ECG normal sinus rhythm. BP 138/82." },
  { x: 286, date: "Apr 10, 2024", notes: "Stable. Continue current meds. Watch renal function closely." },
  { x: 540, date: "Sep 22, 2024", notes: "Dizziness reported. K+ rising. Consider stopping spironolactone." },
] as const;

const GP_VISITS = [
  { x: 160, date: "Feb 8, 2024", notes: "Ankle oedema noted. Referred to cardiology. Adjusted diuretic." },
  { x: 366, date: "Jun 5, 2024", notes: "Fatigue increasing. Started spironolactone 25mg." },
  { x: 610, date: "Oct 18, 2024", notes: "Urgent: review meds. K+ elevated. Coordinating with cardiology." },
] as const;

const EGFR_POINTS = [
  { x: 117, y: LANE_TOP.labs + 25, value: "68", label: "eGFR — Estimated Glomerular Filtration Rate. Normal >60. Measures kidney function." },
  { x: 300, y: LANE_TOP.labs + 30, value: "64", label: "eGFR — Declining from 68. Mild impairment." },
  { x: 460, y: LANE_TOP.labs + 35, value: "61", label: "eGFR — Borderline. Approaching CKD Stage 3." },
  { x: 636, y: LANE_TOP.labs + 42, value: "57", label: "eGFR — Below 60. CKD Stage 3a. Urgent review." },
] as const;

const IMAGING_EVENTS = [
  { x: 155, label: "Echo", sub: "Feb" },
  { x: 456, label: "CXR", sub: "Jul" },
  { x: 630, label: "CT", sub: "Oct" },
] as const;

const NOTE_EVENTS = [
  { x: 123, fill: "#E1F5EE", stroke: "#0F6E56", textColor: "#085041", label: "dyspnoea on exertion", noteIndex: 0 },
  { x: 195, fill: "#FAEEDA", stroke: "#854F0B", textColor: "#633806", label: "ankle oedema", noteIndex: 1 },
  { x: 304, fill: "#E1F5EE", stroke: "#0F6E56", textColor: "#085041", label: "stable, watch renal", noteIndex: 2 },
  { x: 400, fill: "#FAEEDA", stroke: "#854F0B", textColor: "#633806", label: "fatigue · spiro", noteIndex: 3 },
  { x: 558, fill: "#E1F5EE", stroke: "#0F6E56", textColor: "#085041", label: "dizzy · K+ rising", noteIndex: 4 },
  { x: 645, fill: "#FAEEDA", stroke: "#854F0B", textColor: "#633806", label: "review meds", noteIndex: 5 },
] as const;

function timeToX(ms: number, minMs: number, maxMs: number): number {
  if (maxMs === minMs) return X_START;
  return X_START + ((ms - minMs) / (maxMs - minMs)) * X_WIDTH;
}


function generateXTicks(
  minMs: number,
  maxMs: number
): { x: number; label: string }[] {
  const durationDays = (maxMs - minMs) / 86400000;
  const intervalDays = durationDays <= 7 ? 1 : durationDays <= 35 ? 7 : 14;
  const intervalMs = intervalDays * 86400000;
  const ticks: { x: number; label: string }[] = [];
  // Snap start to nearest interval boundary
  const firstTick = Math.ceil(minMs / intervalMs) * intervalMs;
  for (let t = firstTick; t <= maxMs; t += intervalMs) {
    const d = new Date(t);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    ticks.push({ x: timeToX(t, minMs, maxMs), label });
  }
  return ticks;
}

interface NoteData {
  date: string;
  doctor: string;
  fullNote: string;
  medications: string[];
  labs: { label: string; value: string }[];
  imaging: string[];
}

const notesData: NoteData[] = [
  { date: "Jan 20, 2024", doctor: "Dr Hofer", fullNote: "Patient reports increasing dyspnoea on exertion over 2 weeks. No orthopnoea. Chest clear on auscultation. Consider echo referral.", medications: ["Ramipril 5mg", "Metformin 1000mg"], labs: [{ label: "eGFR", value: "68 mL/min" }, { label: "K+", value: "4.2 mmol/L" }], imaging: [] },
  { date: "Feb 8, 2024", doctor: "Dr Hofer", fullNote: "Bilateral ankle oedema noted. Pitting 2+. Weight up 3kg from baseline. Started furosemide 40mg. Referred cardiology.", medications: ["Ramipril 5mg", "Metformin 1000mg", "Furosemide 40mg"], labs: [{ label: "HbA1c", value: "7.2%" }], imaging: ["Echo — EF 42%, mild LV dysfunction"] },
  { date: "Apr 10, 2024", doctor: "Dr Reiter", fullNote: "Patient stable on current regime. eGFR 64 — mild decline. Continue monitoring renal function. Review in 3 months.", medications: ["Ramipril 5mg", "Metformin 1000mg", "Furosemide 40mg"], labs: [{ label: "eGFR", value: "64 mL/min" }, { label: "K+", value: "4.5 mmol/L" }], imaging: [] },
  { date: "Jun 5, 2024", doctor: "Dr Hofer", fullNote: "Fatigue worsening over past month. Started spironolactone 25mg for HF. Monitor potassium closely given concurrent Ramipril.", medications: ["Ramipril 5mg", "Metformin 1000mg", "Furosemide 40mg", "Spironolactone 25mg"], labs: [{ label: "eGFR", value: "61 mL/min" }], imaging: ["CXR — mild cardiomegaly, no pleural effusion"] },
  { date: "Sep 22, 2024", doctor: "Dr Reiter", fullNote: "Dizziness on standing. K+ 5.4 — rising trend. Consider stopping spironolactone. Check renal function urgently.", medications: ["Ramipril 5mg", "Metformin 1000mg", "Furosemide 40mg", "Spironolactone 25mg"], labs: [{ label: "eGFR", value: "57 mL/min" }, { label: "K+", value: "5.4 mmol/L" }], imaging: [] },
  { date: "Oct 18, 2024", doctor: "Dr Hofer", fullNote: "Urgent medication review. K+ elevated at 5.4. eGFR 57 — CKD Stage 3a. Coordinating with cardiology. Consider stopping spironolactone and ibuprofen.", medications: ["Ramipril 5mg", "Metformin 1000mg", "Furosemide 40mg", "Spironolactone 25mg", "Ibuprofen PRN"], labs: [{ label: "eGFR", value: "57 mL/min" }, { label: "K+", value: "5.4 mmol/L" }, { label: "HbA1c", value: "6.9%" }], imaging: ["CT Abdomen — renal cortical thinning bilateral"] },
];

const Timeline = ({ visibleLayers, selectedPatient, gridX }: Props) => {
  const [selectedNote, setSelectedNote] = useState<NoteData | null>(null);
  const isRealPatient = selectedPatient === 0;

  // Fetch real sensor data only for Müller (patient 0)
  const { data: manifest } = useQuery({
    queryKey: ["manifest"],
    queryFn: fetchManifest,
    enabled: isRealPatient,
    staleTime: 300_000,
    retry: false,
  });
  // Compute derived values for real data
  const minMs = manifest?.timeBounds.minStartMs ?? 0;
  const maxMs = manifest?.timeBounds.maxEndMs ?? 0;
  const hasRealSensor = isRealPatient && !!manifest;

  const xTicks = hasRealSensor ? generateXTicks(minMs, maxMs) : null;
  const verticalGridX = gridX?.length
    ? gridX
    : xTicks?.map((t) => t.x) ?? GRID_X;
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col min-w-0">
        {/* SVG Timeline */}
        <div className="w-full">
          <svg
            className="block w-full"
            viewBox={`0 0 760 ${SVG_H}`}
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Lane label bg */}
            <rect x="0" y="0" width={LABEL_COL_W} height={SVG_H} fill={LABEL_FILL} />

            {/* Grid lines */}
            {verticalGridX.map((x) => (
              <line
                key={x}
                x1={x}
                y1={0}
                x2={x}
                y2={SVG_H}
                stroke={GRID_STROKE}
                strokeWidth="0.9"
                strokeDasharray={GRID_DASH}
              />
            ))}

            {/* Maintain a continuous y-axis label seam across stacked sections */}
            <line x1={LABEL_COL_W} y1={0} x2={LABEL_COL_W} y2={SVG_H} stroke={TRACK_DIVIDER} strokeWidth="1" />

            {/* Lane separators */}
            {Object.values(LANE_TOP).map((y) => (
              <line key={y} x1="0" y1={y} x2="760" y2={y} stroke={TRACK_DIVIDER} strokeWidth="0.8" />
            ))}

            {/* Lane labels */}
            <text x={LABEL_COL_W / 2} y={(LANE_TOP.visits + LANE_TOP.alerts) / 2 + 4} textAnchor="middle" fontSize="8" fill={LABEL_TEXT} fontWeight="600">Visits</text>
            <text x={LABEL_COL_W / 2} y={(LANE_TOP.alerts + LANE_TOP.medications) / 2 + 4} textAnchor="middle" fontSize="8" fill={LABEL_TEXT} fontWeight="600">Alerts</text>
            <text x={LABEL_COL_W / 2} y={(LANE_TOP.medications + LANE_TOP.labs) / 2 + 4} textAnchor="middle" fontSize="8" fill={LABEL_TEXT} fontWeight="600">Medications</text>
            <text x={LABEL_COL_W / 2} y={(LANE_TOP.labs + LANE_TOP.imaging) / 2 + 4} textAnchor="middle" fontSize="8" fill={LABEL_TEXT} fontWeight="600">Labs</text>
            <text x={LABEL_COL_W / 2} y={(LANE_TOP.imaging + LANE_TOP.notes) / 2 + 4} textAnchor="middle" fontSize="8" fill={LABEL_TEXT} fontWeight="600">Imaging</text>
            <text x={LABEL_COL_W / 2} y={(LANE_TOP.notes + SVG_H) / 2 + 4} textAnchor="middle" fontSize="8" fill={LABEL_TEXT} fontWeight="600">Notes</text>

            {/* Today line (only meaningful for mock data) */}
            {!hasRealSensor && (
              <>
                <line x1="706" y1={LANE_TOP.visits} x2="706" y2={SVG_H - 10} stroke="#A32D2D" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
                <text x="706" y={SVG_H - 2} textAnchor="middle" fontSize="9" fill="#A32D2D">today</text>
              </>
            )}

            {/* LANE 1: Visits */}
            {visibleLayers.cardioVisits && (
              <>
                <polyline
                  fill="none"
                  stroke="#0F6E56"
                  strokeWidth="1"
                  strokeDasharray="3 2"
                  opacity="0.3"
                  points={CARDIO_VISITS.map((v) => `${v.x + 18},${LANE_CENTER.visits}`).join(" ")}
                />
                {CARDIO_VISITS.map((visit) => (
                  <VisitRect
                    key={`cardio-${visit.x}`}
                    x={visit.x}
                    label="Cardio"
                    doctor="Dr Reiter"
                    type="cardio"
                    date={visit.date}
                    notes={visit.notes}
                  />
                ))}
              </>
            )}
            {visibleLayers.gpVisits && (
              <>
                <polyline
                  fill="none"
                  stroke="#854F0B"
                  strokeWidth="1"
                  strokeDasharray="3 2"
                  opacity="0.3"
                  points={GP_VISITS.map((v) => `${v.x + 15},${LANE_CENTER.visits + 6}`).join(" ")}
                />
                {GP_VISITS.map((visit) => (
                  <VisitRect
                    key={`gp-${visit.x}`}
                    x={visit.x}
                    label="GP"
                    doctor="Dr Hofer"
                    type="gp"
                    date={visit.date}
                    notes={visit.notes}
                  />
                ))}
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
                {/* Left-side anchors so lab trends start with the same visual language as medication bars */}
                <rect x={X_START} y={LANE_TOP.labs + 18} width="84" height="14" rx="3" fill="#2B6CB0" opacity="0.16" />
                <rect x={X_START} y={LANE_TOP.labs + 18} width="84" height="14" rx="3" fill="none" stroke="#2B6CB0" strokeWidth="0.45" opacity="0.55" />
                <text x={X_START + 6} y={LANE_TOP.labs + 28} fontSize="8.5" fill="#1E4E85">eGFR trend</text>

                <rect x={X_START} y={LANE_TOP.labs + 44} width="84" height="14" rx="3" fill="#854F0B" opacity="0.14" />
                <rect x={X_START} y={LANE_TOP.labs + 44} width="84" height="14" rx="3" fill="none" stroke="#854F0B" strokeWidth="0.45" opacity="0.5" />
                <text x={X_START + 6} y={LANE_TOP.labs + 54} fontSize="8.5" fill="#633806">HbA1c</text>

                {EGFR_POINTS.map((p, idx) => (
                  <LabDot
                    key={`egfr-${p.x}`}
                    cx={p.x}
                    cy={p.y}
                    value={p.value}
                    color={idx === EGFR_POINTS.length - 1 ? "#A32D2D" : "#2B6CB0"}
                    textColor={idx === EGFR_POINTS.length - 1 ? "#791F1F" : "#1E4E85"}
                    label={p.label}
                    r={idx === EGFR_POINTS.length - 1 ? 6 : 5}
                  />
                ))}
                <polyline
                  fill="none"
                  stroke="#2B6CB0"
                  strokeWidth="1.1"
                  strokeDasharray="3 2"
                  opacity="0.4"
                  points={`${X_START},${EGFR_POINTS[0].y} ${EGFR_POINTS.map((p) => `${p.x},${p.y}`).join(" ")}`}
                />
                <circle cx={X_START} cy={EGFR_POINTS[0].y} r="3" fill="#2B6CB0" opacity="0.8" />
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
                <polyline
                  fill="none"
                  stroke="hsl(220 11% 56%)"
                  strokeWidth="1"
                  strokeDasharray="3 2"
                  opacity="0.35"
                  points={IMAGING_EVENTS.map((event) => `${event.x + 19},${LANE_CENTER.imaging}`).join(" ")}
                />
                {IMAGING_EVENTS.map((event) => (
                  <ImagingRect key={`img-${event.x}`} x={event.x} label={event.label} sub={event.sub} laneTop={LANE_TOP.imaging} />
                ))}
              </>
            )}

            {/* LANE 7: Notes — clickable diamonds */}
            {visibleLayers.notes && (
              <>
                <polyline
                  fill="none"
                  stroke="hsl(220 11% 52%)"
                  strokeWidth="1"
                  strokeDasharray="3 2"
                  opacity="0.35"
                  points={NOTE_EVENTS.map((event) => `${event.x},${LANE_CENTER.notes - 8}`).join(" ")}
                />
                {NOTE_EVENTS.map((event) => (
                  <NoteDiamond
                    key={`note-${event.x}`}
                    cx={event.x}
                    fill={event.fill}
                    stroke={event.stroke}
                    textColor={event.textColor}
                    label={event.label}
                    laneTop={LANE_TOP.notes}
                    onClick={() => setSelectedNote(notesData[event.noteIndex])}
                  />
                ))}
              </>
            )}
          </svg>
        </div>

        {/* Note detail dialog — rendered outside SVG */}
        <Dialog open={!!selectedNote} onOpenChange={(open) => { if (!open) setSelectedNote(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Clinical Note — {selectedNote?.doctor}</DialogTitle>
            </DialogHeader>
            {selectedNote && (
              <div className="space-y-4 text-sm">
                <div className="flex gap-4">
                  <div><span className="font-medium">Date:</span> {selectedNote.date}</div>
                  <div><span className="font-medium">Provider:</span> {selectedNote.doctor}</div>
                </div>

                <div className="border-t pt-3">
                  <p className="font-medium mb-1">Clinical Note</p>
                  <p className="text-muted-foreground">{selectedNote.fullNote}</p>
                </div>

                <div className="border-t pt-3">
                  <p className="font-medium mb-2">Medications at Time of Note</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNote.medications.map((med) => (
                      <span key={med} className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">{med}</span>
                    ))}
                  </div>
                </div>

                {selectedNote.labs.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="font-medium mb-2">Lab Results</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {selectedNote.labs.map((lab) => (
                        <div key={lab.label} className="bg-secondary/50 rounded-lg p-2">
                          <span className="text-muted-foreground">{lab.label}:</span> {lab.value}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedNote.imaging.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="font-medium mb-2">Imaging</p>
                    <div className="space-y-1 text-xs">
                      {selectedNote.imaging.map((img) => (
                        <div key={img} className="bg-secondary/30 rounded-lg p-2 text-muted-foreground">{img}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
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
  const ry = LANE_TOP.visits + 6;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <g className="cursor-pointer">
          <rect x={x} y={ry} width={w} height={30} rx={6} fill={bg} stroke={border} strokeWidth={0.8} />
          <text x={x + w / 2} y={ry + 13} textAnchor="middle" fontSize="9" fill={textDark} fontWeight="500">{label}</text>
          <text x={x + w / 2} y={ry + 23} textAnchor="middle" fontSize="8" fill={textLight}>{doctor}</text>
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
  cx, fill, stroke, textColor, label, laneTop, onClick,
}: {
  cx: number; fill: string; stroke: string; textColor: string; label: string; laneTop: number; onClick: () => void;
}) => {
  const dy = laneTop + 12;
  return (
    <g className="cursor-pointer" onClick={onClick}>
      <polygon points={`${cx},${dy} ${cx + 6},${dy + 7} ${cx},${dy + 14} ${cx - 6},${dy + 7}`} fill={fill} stroke={stroke} strokeWidth={0.8} />
      <line x1={cx} y1={dy + 14} x2={cx} y2={dy + 22} stroke={stroke} strokeWidth={0.5} strokeDasharray="2 2" opacity={0.5} />
      <text x={cx} y={dy + 32} textAnchor="middle" fontSize="7.5" fill={textColor}>{label}</text>
    </g>
  );
};

export default Timeline;
