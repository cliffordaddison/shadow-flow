import { useState } from 'react';

export interface MetricPill {
  label: string;
  value: string;
  valueClass: string;
  desc: string;
}

interface TrainingNavbarProps {
  readonly modeIcon: string;
  readonly modeLabel: string;
  /** 1–2 key metrics for navbar (e.g. Unique words, Today) */
  readonly navbarMetrics: MetricPill[];
  /** All metrics for Progress modal */
  readonly allMetrics: MetricPill[];
  /** Label for the stats button on mobile (e.g. "Stats", "Courses") */
  readonly progressButtonLabel?: string;
}

function MetricPillChip({
  label,
  value,
  valueClass,
  title,
}: Readonly<{
  label: string;
  value: string;
  valueClass: string;
  title: string;
}>) {
  return (
    <div
      title={title}
      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 shrink-0"
    >
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">
        {label}
      </span>
      <span className={`text-xs font-bold ${valueClass} whitespace-nowrap`}>{value}</span>
    </div>
  );
}

export function TrainingNavbar({
  modeIcon,
  modeLabel,
  navbarMetrics,
  allMetrics,
  progressButtonLabel = 'Stats',
}: Readonly<TrainingNavbarProps>) {
  const [progressModalOpen, setProgressModalOpen] = useState(false);

  return (
    <>
      <header className="min-h-[52px] flex-shrink-0 border-b border-slate-200 dark:border-slate-800 bg-[#f6f7f8] dark:bg-slate-900 flex items-center justify-between gap-2 px-3 sm:px-4 md:px-6 lg:px-8 sticky top-0 z-10">
        <div className="flex-1 min-w-0" />
        <div className="flex justify-center shrink-0 flex-1 min-w-0">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 sm:px-4 py-2 rounded-full shadow-sm min-w-0 max-w-full">
            <h2 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 sm:gap-2 text-center whitespace-normal break-words leading-tight">
              <span className="material-symbols-outlined text-sm sm:text-base shrink-0">{modeIcon}</span>
              <span>{modeLabel}</span>
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 justify-end flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setProgressModalOpen(true)}
            className="lg:hidden px-2.5 sm:px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shrink-0"
          >
            {progressButtonLabel}
          </button>
          <div className="hidden lg:flex items-center gap-2 justify-end">
            {navbarMetrics.map(({ label, value, valueClass, desc }) => (
              <MetricPillChip key={label} label={label} value={value} valueClass={valueClass} title={desc} />
            ))}
          </div>
        </div>
      </header>

      {progressModalOpen && (
        <dialog
          open
          aria-label="Your progress"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 border-0 w-full max-w-none h-full max-h-none m-0"
        >
          <button
            type="button"
            aria-label="Close dialog"
            onClick={() => setProgressModalOpen(false)}
            className="absolute inset-0 w-full h-full cursor-pointer"
            tabIndex={-1}
          />
          <div
            className="relative z-10 bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-800"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Your progress</h3>
              <button
                type="button"
                onClick={() => setProgressModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
                aria-label="Close"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {allMetrics.map(({ label, value, valueClass, desc }) => (
                <div
                  key={label}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50"
                >
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
                  <p className={`text-lg font-bold mt-1 ${valueClass}`}>{value}</p>
                  <p className="text-xs text-slate-500 mt-1">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
