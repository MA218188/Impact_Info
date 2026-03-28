import bgDesktop from "@/assets/bg-desktop.jpg";
import PatientHeader from "@/components/dashboard/PatientHeader";
import PatientSidebar from "@/components/dashboard/PatientSidebar";
import Timeline from "@/components/dashboard/Timeline";
import AIFooter from "@/components/dashboard/AIFooter";

const Index = () => {
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-6"
      style={{
        backgroundImage: `url(${bgDesktop})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="w-full max-w-[1440px] flex gap-4">
        <PatientSidebar />
        <div className="flex-1 glass-panel-strong rounded-2xl flex flex-col overflow-hidden min-w-0 relative">
          <PatientHeader />
          <div className="flex-1 overflow-auto relative">
            <Timeline />
          </div>
          <AIFooter />
        </div>
      </div>
    </div>
  );
};

export default Index;
