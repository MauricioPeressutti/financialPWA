export function GoalRing({ pct, reached }: { pct: number; reached: boolean }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const off = C * (1 - Math.min(1, Math.max(0, pct) / 100));
  return (
    <div className="relative size-[168px]">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="var(--border)"
          strokeWidth="9"
        />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={reached ? "#10b981" : "var(--primary)"}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={C.toFixed(2)}
          strokeDashoffset={off.toFixed(2)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[1.7rem] font-bold tabular-nums">
          {Math.round(pct)}%
        </span>
        <span className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">
          del objetivo
        </span>
      </div>
    </div>
  );
}
