/**
 * Inline playback speed control: − [speed]× +. Updates app-wide settings.learning.ttsSpeed (0.5–2).
 */

import { useStore } from '@/store/useStore';
import { defaultLearningSettings } from '@/types';

const MIN = 0.5;
const MAX = 2;
const STEP = 0.1;

export function PlaybackSpeedControl() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const ttsSpeed = Number.isFinite(Number(settings.learning?.ttsSpeed))
    ? Number(settings.learning!.ttsSpeed)
    : defaultLearningSettings.ttsSpeed;
  const clamped = Math.max(MIN, Math.min(MAX, ttsSpeed));
  const display = clamped.toFixed(1);

  const change = (delta: number) => {
    const next = Math.max(MIN, Math.min(MAX, Math.round((clamped + delta) * 10) / 10));
    setSettings((s) => ({
      ...s,
      learning: { ...(s.learning ?? defaultLearningSettings), ttsSpeed: next },
    }));
  };

  return (
    <div className="flex items-center gap-0.5 sm:gap-2 shrink-0" role="group" aria-label="Playback speed">
      <button
        type="button"
        onClick={() => change(-STEP)}
        disabled={clamped <= MIN}
        className="size-7 sm:size-9 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        aria-label="Decrease speed"
      >
        <span className="material-symbols-outlined text-base sm:text-xl">remove</span>
      </button>
      <span className="min-w-[2.25rem] sm:min-w-[3.5rem] text-center text-[10px] sm:text-xs font-bold tabular-nums text-slate-700 dark:text-slate-300">
        {display}×
      </span>
      <button
        type="button"
        onClick={() => change(STEP)}
        disabled={clamped >= MAX}
        className="size-7 sm:size-9 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        aria-label="Increase speed"
      >
        <span className="material-symbols-outlined text-base sm:text-xl">add</span>
      </button>
    </div>
  );
}
