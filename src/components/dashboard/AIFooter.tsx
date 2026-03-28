import { Sparkles, ArrowUpRight } from "lucide-react";

const AIFooter = () => {
  return (
    <div className="px-6 py-4 flex items-start gap-4">
      <div className="ai-summary flex-1 flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60 block mb-1">AI Summary</span>
          <p className="text-xs leading-relaxed text-foreground/80">
            eGFR declining 11 pts over 12 months (68→57). Spironolactone added Jun now overlapping Ramipril — K+ at 5.4 mmol/L above safe range. GP and Cardiology both flagging symptoms since Jul. Urgent medication review indicated.
          </p>
        </div>
      </div>
      <button className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors mt-1 flex-shrink-0">
        Full report
        <ArrowUpRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default AIFooter;
