import type { MetricPill } from './TrainingNavbar';

interface LessonHeaderProps {
  readonly courseName: string;
  readonly lessonName: string;
  readonly progressLabel: string;
  readonly progressValue: string;
  readonly metrics: MetricPill[];
}

function MetricChip({
  label,
  value,
  valueClass,
  title,
  compact,
}: Readonly<{ label: string; value: string; valueClass: string; title: string; compact?: boolean }>) {
  return (
    <div
      title={title}
      className={`shrink-0 rounded-lg text-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800
        ${compact ? 'px-1.5 py-0.5' : 'px-2.5 py-1.5'}
      `}
    >
      <span className={`block font-semibold text-slate-400 uppercase tracking-wider ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{label}</span>
      <span className={`block font-bold ${valueClass} ${compact ? 'text-xs' : 'text-sm'}`}>{value}</span>
    </div>
  );
}

export function LessonHeader({ courseName, lessonName, progressLabel, progressValue, metrics }: Readonly<LessonHeaderProps>) {
  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 min-h-[5.5rem] md:min-h-[5rem]">
      {/* MOBILE ONLY: Compact, distinct blocks, no truncation — Course | Lesson | Progress + metrics */}
      <div className="md:hidden flex flex-col gap-2 py-2.5 px-3 min-h-[5.5rem]">
        <div className="flex items-stretch justify-center gap-2">
          <div className="flex-1 min-w-0 rounded-lg bg-slate-50/60 dark:bg-slate-800/50 px-2 py-1.5 text-center">
            <span className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Course</span>
            <span className="block text-[11px] font-semibold text-slate-800 dark:text-slate-200 break-words leading-tight">{courseName}</span>
          </div>
          <div className="w-px self-stretch bg-slate-200 dark:bg-slate-600 shrink-0" aria-hidden />
          <div className="flex-1 min-w-0 rounded-lg bg-slate-50/60 dark:bg-slate-800/50 px-2 py-1.5 text-center">
            <span className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lesson</span>
            <span className="block text-[11px] font-semibold text-slate-800 dark:text-slate-200 break-words leading-tight">{lessonName}</span>
          </div>
          <div className="w-px self-stretch bg-slate-200 dark:bg-slate-600 shrink-0" aria-hidden />
          <div className="flex-1 min-w-[56px] rounded-lg bg-slate-50/60 dark:bg-slate-800/50 px-2 py-1.5 text-center shrink-0">
            <span className="block text-[9px] font-bold text-primary/90 uppercase tracking-wider">{progressLabel}</span>
            <span className="block text-[11px] font-bold text-primary break-words leading-tight">{progressValue}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {metrics.map(({ label, value, valueClass, desc }) => (
            <MetricChip key={label} label={label} value={value} valueClass={valueClass} title={desc} compact />
          ))}
        </div>
      </div>

      {/* DESKTOP: Original inline layout — Course | Lesson | Progress + metrics on right */}
      <div className="hidden md:flex flex-wrap items-center justify-between gap-4 py-4 px-6 min-h-[5rem]">
        <div className="flex items-center gap-4">
          <div>
            <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Course</span>
            <span className="block text-sm font-bold text-slate-800 dark:text-slate-200">{courseName}</span>
          </div>
          <span className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
          <div>
            <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Lesson</span>
            <span className="block text-sm font-bold text-slate-800 dark:text-slate-200">{lessonName}</span>
          </div>
          <span className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
          <div>
            <span className="block text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{progressLabel}</span>
            <span className="block text-sm font-bold text-primary">{progressValue}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {metrics.map(({ label, value, valueClass, desc }) => (
            <MetricChip key={label} label={label} value={value} valueClass={valueClass} title={desc} />
          ))}
        </div>
      </div>
    </div>
  );
}
