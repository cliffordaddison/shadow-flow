import { useEffect } from 'react';
import { TrainingNavbar } from '@/components/layout/TrainingNavbar';
import { LessonHeader } from '@/components/layout/LessonHeader';
import { useListenRepeatSession } from '@/engine/listenRepeat';
import { cancelTTS } from '@/engine/tts';
import { getProgressSnapshot } from '@/engine/metrics';
import { useStore } from '@/store/useStore';
import { getCourse } from '@/store/courses';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';

export function ListenRepeat() {
  const currentLessonId = useStore((s) => s.currentLessonId);
  const session = useListenRepeatSession(currentLessonId);
  useScreenWakeLock();

  useEffect(() => {
    return () => {
      cancelTTS();
    };
  }, []);
  const snapshot = getProgressSnapshot('listen');

  const LISTEN_NAVBAR_METRICS = [
    { label: 'Unique words', value: String(snapshot.uniqueWords), valueClass: 'text-primary', desc: 'Distinct French words across all your lessons.' },
    { label: 'Today', value: `+${snapshot.wordsSeenToday}`, valueClass: 'text-emerald-600 dark:text-emerald-400', desc: 'Seen today in any mode.' },
  ];

  const LISTEN_ALL_METRICS = LISTEN_NAVBAR_METRICS;

  const currentCourseId = useStore((s) => s.currentCourseId);
  const course = currentCourseId ? getCourse(currentCourseId) : null;
  const courseName = course?.name ?? '—';
  const lessonName = session.lesson?.name ?? '—';
  const progressValue = session.totalSentences > 0
    ? `${session.currentIndex} / ${session.totalSentences}`
    : '—';
  const progressPct = session.totalSentences > 0 ? (session.currentIndex / session.totalSentences) * 100 : 0;
  const playCountDisplay = Math.min(session.repeatIndex + 1, session.repeatCount);
  const playCountRingPct = session.repeatCount > 0 ? (playCountDisplay / session.repeatCount) * 100 : 0;

  return (
    <>
      <TrainingNavbar
        modeIcon="headphones"
        modeLabel="Listen & Repeat"
        navbarMetrics={LISTEN_NAVBAR_METRICS}
        allMetrics={LISTEN_ALL_METRICS}
        progressButtonLabel="Stats"
      />
      <LessonHeader
        courseName={courseName}
        lessonName={lessonName}
        progressLabel="Position"
        progressValue={progressValue}
        metrics={[]}
      />
      <div className="flex-1 min-h-0 p-6 md:p-8 flex flex-col items-center justify-center max-w-5xl mx-auto w-full overflow-y-auto">
        <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-x-hidden overflow-y-hidden flex flex-col h-auto min-h-[400px] sm:min-h-[500px]">
          <div className="flex-1 p-4 sm:p-10 flex flex-col items-center justify-center relative min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
            <div className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 flex flex-wrap items-center justify-between gap-2 sm:gap-4 min-w-0 overflow-hidden">
              <span className="px-2 sm:px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] sm:text-xs font-bold rounded-full uppercase tracking-wider border border-indigo-100 dark:border-indigo-800/50 shrink-0">
                Play: {playCountDisplay}/{session.repeatCount}
              </span>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
                <button
                  type="button"
                  onClick={() => session.stopPlayback()}
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold border transition-colors shrink-0 ${
                    session.isPlaying
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 hover:bg-red-200 dark:hover:bg-red-900/50'
                      : 'invisible pointer-events-none bg-transparent border-transparent'
                  }`}
                  aria-hidden={!session.isPlaying}
                >
                  <span className="material-symbols-outlined text-sm sm:text-base">stop</span>
                  <span className="hidden sm:inline">Stop</span>
                </button>
                <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 min-w-0">
                  <input
                    type="checkbox"
                    checked={session.autoAdvance}
                    onChange={(e) => session.setAutoAdvance(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary shrink-0"
                  />
                  <span className="text-[10px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 truncate">Auto-advance</span>
                </label>
              </div>
            </div>
            {session.currentSentence ? (
              <>
                <div className="text-center space-y-3 sm:space-y-6 mb-6 sm:mb-12 max-w-2xl w-full px-2 mt-14">
                  <h3 className="text-[clamp(0.875rem,2.5vw+0.5rem,2rem)] sm:text-[clamp(1.125rem,4vw+0.75rem,3rem)] font-bold text-slate-900 dark:text-white leading-tight tracking-tight break-words hyphens-none">
                    {session.currentSentence.french}
                  </h3>
                  <p className="text-[clamp(0.75rem,2vw+0.4rem,1.25rem)] sm:text-[clamp(0.875rem,2.5vw+0.5rem,1.5rem)] text-slate-400 dark:text-slate-500 font-normal break-words hyphens-none">
                    {session.currentSentence.english}
                  </p>
                </div>
                <div className="relative flex items-center justify-center gap-3 sm:gap-6 mb-4 w-full max-w-md shrink-0">
                  <button
                    type="button"
                    onClick={() => session.prevSentence()}
                    disabled={!session.currentSentence || session.currentIndex <= 1}
                    className="size-12 rounded-full border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-40 disabled:pointer-events-none transition-all shrink-0"
                    aria-label="Previous"
                  >
                    <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 0" }}>skip_previous</span>
                  </button>
                  <div className="relative flex items-center justify-center shrink-0">
                    <svg className="w-32 h-32 md:w-40 md:h-40" viewBox="0 0 100 100">
                      <circle
                        className="text-slate-100 dark:text-slate-800"
                        cx="50"
                        cy="50"
                        fill="transparent"
                        r="45"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <circle
                        className="text-primary progress-ring-circle"
                        cx="50"
                        cy="50"
                        fill="transparent"
                        r="45"
                        stroke="currentColor"
                        strokeDasharray="283"
                        strokeDashoffset={283 - (playCountRingPct / 100) * 283}
                        strokeLinecap="round"
                        strokeWidth="4"
                      />
                    </svg>
                    <button
                      type="button"
                      disabled={session.isPlaying}
                      onClick={() => session.playCurrent()}
                      className="absolute size-20 md:size-24 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-blue-600 hover:scale-105 active:scale-95 transition-all group disabled:opacity-70"
                      aria-label="Play"
                    >
                      <span
                        className="material-symbols-outlined text-4xl group-hover:scale-110 transition-transform"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        play_arrow
                      </span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => session.nextSentence()}
                    disabled={!session.currentSentence || session.currentIndex >= session.totalSentences}
                    className="size-12 rounded-full border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-40 disabled:pointer-events-none transition-all shrink-0"
                    aria-label="Next"
                  >
                    <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 0" }}>skip_next</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => session.restartSession()}
                  className="absolute bottom-4 right-4 size-11 rounded-full border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all shrink-0 bg-white dark:bg-slate-900 shadow-sm"
                  aria-label="Restart from beginning"
                  title="Restart from beginning"
                >
                  <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 0" }}>restart_alt</span>
                </button>
                <span className="text-[10px] uppercase font-bold text-slate-300 dark:text-slate-600 tracking-widest mt-2">
                  Space to play
                </span>
              </>
            ) : (
              <div className="text-center text-slate-500 dark:text-slate-400">
                <p>No lesson selected or no sentences.</p>
                <p className="mt-2 text-sm">Upload a course from Upload File and select a lesson.</p>
              </div>
            )}
          </div>
          <div className="bg-slate-50/50 dark:bg-slate-800/30 px-4 sm:px-8 py-3 sm:py-4 border-t border-slate-100 dark:border-slate-800/50 shrink-0">
            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden w-full">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
