import { useState } from "react";
import PatientHeader from "@/components/dashboard/PatientHeader";
import PatientSidebar from "@/components/dashboard/PatientSidebar";
import Timeline from "@/components/dashboard/Timeline";
import AIFooter from "@/components/dashboard/AIFooter";

export type DataLayerKey = "sensor" | "cardioVisits" | "gpVisits" | "drugAlerts" | "labResults" | "imaging" | "notes";

const Index = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  const toggleLayer = (key: DataLayerKey) => {
    setVisibleLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen w-full bg-sky-50 flex items-center justify-center p-6">
      <div className="w-full max-w-[1440px] h-[780px] flex bg-white rounded-2xl border border-border/60 overflow-hidden shadow-sm">
        <PatientSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
          visibleLayers={visibleLayers}
          onToggleLayer={toggleLayer}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <PatientHeader activeNav={activeNav} onNavChange={setActiveNav} />
          <div className="flex-1 overflow-auto relative">
            <Timeline
              visibleLayers={visibleLayers}
              activeTimeScale={activeTimeScale}
              onTimeScaleChange={setActiveTimeScale}
            />
          </div>
          <AIFooter />
        </div>
      </div>
    </div>
  );
};

export default Index;
