const AIFooter = () => {
  return (
    <div className="px-5 py-2.5 border-t border-border/60 flex items-start gap-2.5 bg-secondary/30">
      <span className="text-[10px] font-medium uppercase tracking-wider text-primary bg-primary/8 px-2 py-0.5 rounded-md whitespace-nowrap mt-0.5">
        AI
      </span>
      <p className="text-xs text-muted-foreground leading-relaxed flex-1">
        eGFR declining 11 pts over 12 months (68→57). Spironolactone added Jun now overlapping Ramipril — K+ at 5.4 mmol/L above safe range. GP and Cardiology both flagging symptoms since Jul. Urgent medication review indicated.
      </p>
      <button className="text-[11px] px-2.5 py-1 rounded-lg border border-border/60 bg-white text-foreground hover:bg-secondary/50 transition-colors whitespace-nowrap">
        Full report ↗
      </button>
    </div>
  );
};

export default AIFooter;
