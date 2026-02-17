/**
 * Session goal card: label "SESSION GOAL", current/total (e.g. 0/50), progress bar.
 * Placed on the left side of Speaking and Writing main content.
 */

type Props = Readonly<{
  current: number;
  total: number;
}>;

export function SessionGoalCard({ current, total }: Props) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-4 shadow-sm w-full max-w-[220px] shrink-0">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          SESSION GOAL
        </span>
        <span className="text-sm font-bold text-primary">
          {current}/{total}
        </span>
      </div>
      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
