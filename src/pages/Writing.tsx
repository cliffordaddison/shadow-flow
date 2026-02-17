import { useRef, useEffect, useState, useCallback, type ReactNode } from 'react';
import { TrainingNavbar } from '@/components/layout/TrainingNavbar';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { LessonHeader } from '@/components/layout/LessonHeader';
import { useWritingSession } from '@/engine/writing';
import { getProgressSnapshot } from '@/engine/metrics';
import { getAllSentences, getSentencesByLessonId } from '@/store/sentences';
import { getReviewState } from '@/store/reviewStates';
import { useStore } from '@/store/useStore';
import { getCourse, getLesson } from '@/store/courses';
import { LessonCompletionDialog } from '@/components/LessonCompletionDialog';
import { AccentKeyboard } from '@/components/AccentKeyboard';

function DiffWordSpan({ item }: Readonly<{ item: { word: string; status: 'correct' | 'missing' | 'wrong' } }>) {
  if (item.status === 'correct') {
    return <span>{item.word} </span>;
  }
  if (item.status === 'missing') {
    return <span className="text-primary font-semibold underline decoration-2">[{item.word}] </span>;
  }
  return <span className="line-through text-red-600 dark:text-red-400">{item.word} </span>;
}

function renderWritingEmptyState(currentLessonId: string | null): ReactNode {
  if (currentLessonId) {
    return (
      <div className="text-center text-slate-500 dark:text-slate-400">
        <p>No sentences due for writing.</p>
        <p className="mt-2 text-sm">Complete Listen & Repeat and Speaking first.</p>
      </div>
    );
  }
  return (
    <div className="text-center text-slate-500 dark:text-slate-400">
      <p>No lesson selected.</p>
      <p className="mt-2 text-sm">Upload a course and select a lesson.</p>
    </div>
  );
}

export function Writing() {
  const feedbackRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentLessonId = useStore((s) => s.currentLessonId);
  useScreenWakeLock();
  const currentCourseId = useStore((s) => s.currentCourseId);
  const session = useWritingSession(currentLessonId ?? undefined);

  const insertCharAtCursor = useCallback(
    (char: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      const value = session.userInput;
      const next = value.slice(0, start) + char + value.slice(end);
      session.setUserInput(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + char.length;
        el.setSelectionRange(pos, pos);
      });
    },
    [session.userInput, session.setUserInput]
  );
  const snapshot = getProgressSnapshot('write');
  const course = currentCourseId ? getCourse(currentCourseId) : null;
  const totalSentences = getAllSentences().length;

  const sessionComplete = Boolean(
    currentLessonId && session.sessionTotal > 0 && !session.current
  );
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  useEffect(() => {
    if (sessionComplete) setShowCompletionDialog(true);
  }, [sessionComplete]);

  const writtenValue = (() => {
    if (!currentLessonId) return '—';
    const lessonSentences = getSentencesByLessonId(currentLessonId);
    const total = lessonSentences.length;
    if (total === 0) return '—';
    const completed = lessonSentences.filter((s) => getReviewState(s.id, 'write').repetitions > 0).length;
    return `${Math.min(completed, total)} / ${total}`;
  })();

  const sessionGoalCurrent =
    totalSentences === 0 || !currentCourseId || !currentLessonId || session.sessionTotal === 0
      ? 0
      : session.uniqueIndex || 0;
  const sessionGoalTotal =
    totalSentences === 0 || !currentCourseId || !currentLessonId || session.sessionTotal === 0
      ? 0
      : session.sessionTotal;

  const setSessionGoal = useStore((s) => s.setSessionGoal);
  useEffect(() => {
    setSessionGoal(sessionGoalCurrent, sessionGoalTotal);
  }, [setSessionGoal, sessionGoalCurrent, sessionGoalTotal]);

  const wordsMasteredValue = snapshot.uniqueWords > 0
    ? `${snapshot.wordsMastered} / ${snapshot.uniqueWords}`
    : '—';
  const sentencesMasteredValue = totalSentences > 0
    ? `${snapshot.sentencesMastered} / ${totalSentences}`
    : '—';

  const WRITING_NAVBAR_METRICS = [
    { label: 'Unique words', value: wordsMasteredValue, valueClass: 'text-primary', desc: 'Words mastered / total unique words.' },
    { label: 'Words written today', value: `+${snapshot.wordsSeenToday}`, valueClass: 'text-emerald-600 dark:text-emerald-400', desc: 'Words written correctly today.' },
  ];

  const WRITING_PAGE_METRICS = [
    { label: 'Words mastered', value: wordsMasteredValue, valueClass: 'text-slate-700 dark:text-slate-300', desc: 'Words mastered / total unique words.' },
    { label: 'Sentences mastered', value: sentencesMasteredValue, valueClass: 'text-slate-700 dark:text-slate-300', desc: 'Sentences mastered / total sentences.' },
  ];

  const WRITING_ALL_METRICS = [...WRITING_NAVBAR_METRICS, ...WRITING_PAGE_METRICS];

  const courseName = course?.name ?? '—';
  const lessonName = (currentLessonId ? getLesson(currentLessonId)?.name : null) ?? '—';

  useEffect(() => {
    if (session.checked && feedbackRef.current) {
      feedbackRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [session.checked]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TrainingNavbar
        modeIcon="edit_note"
        modeLabel="Writing"
        navbarMetrics={WRITING_NAVBAR_METRICS}
        allMetrics={WRITING_ALL_METRICS}
        progressButtonLabel="Stats"
      />
      <LessonHeader
        courseName={courseName}
        lessonName={lessonName}
        progressLabel="Written"
        progressValue={writtenValue}
        metrics={WRITING_PAGE_METRICS}
      />
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center p-3 sm:p-6 md:p-12 max-w-5xl mx-auto w-full">
        {currentLessonId && session.current ? (
          <div className="w-full max-w-2xl mb-4 sm:mb-8 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden relative">
            <div className="p-4 sm:p-6 md:p-8 lg:p-12 space-y-5 sm:space-y-8">
              <div className="space-y-2 sm:space-y-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">
                  Translate this sentence
                </span>
                <h2 className="text-[clamp(0.875rem,2.5vw+0.5rem,1.5rem)] sm:text-[clamp(1rem,3vw+0.5rem,1.875rem)] font-semibold text-slate-800 dark:text-slate-100 break-words hyphens-none">
                  {session.current.english}
                </h2>
              </div>
              <div className="space-y-4">
                <label htmlFor="writing-french-input" className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
                  Type this in French
                </label>
                <textarea
                  ref={textareaRef}
                  id="writing-french-input"
                  value={session.userInput}
                  onChange={(e) => session.setUserInput(e.target.value)}
                  className="w-full min-h-[100px] sm:min-h-[140px] p-3 sm:p-5 text-[clamp(0.9375rem,2.5vw+0.5rem,1.25rem)] bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all resize-none leading-relaxed text-slate-900 dark:text-slate-100"
                  placeholder="Start typing here..."
                />
                <AccentKeyboard onInsertChar={insertCharAtCursor} />
                <div className="flex justify-between items-center pt-2 gap-3">
                  <button
                    type="button"
                    onClick={() => session.checkAnswer()}
                    className="bg-primary hover:bg-primary/90 text-white font-semibold py-2.5 sm:py-3 px-5 sm:px-8 rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center gap-2 group"
                  >
                    Check Answer
                    {' '}
                    <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">
                      arrow_forward
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => session.skipSentence()}
                    title="Mark as known and advance (I already know this)"
                    className="px-4 py-2.5 sm:py-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium transition-colors"
                  >
                    Skip (I know it)
                  </button>
                </div>
              </div>
            </div>

            {session.checked && session.compareResult && (
              <div
                ref={feedbackRef}
                className="pt-4 sm:pt-6 md:pt-8 mt-4 sm:mt-6 border-t-2 border-slate-200 dark:border-slate-700 space-y-4 sm:space-y-6 px-4 sm:px-6 md:px-8 lg:px-12 pb-4 sm:pb-6 md:pb-8 bg-slate-50/80 dark:bg-slate-800/50 rounded-b-xl"
              >
                {/* Result banner: correct vs incorrect + score */}
                <div
                  className={
                    session.compareResult.passed
                      ? 'p-3 sm:p-4 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700'
                      : 'p-3 sm:p-4 rounded-xl bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700'
                  }
                >
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="text-base sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                      {session.compareResult.passed ? (
                        <span className="text-emerald-700 dark:text-emerald-300">Correct</span>
                      ) : (
                        <span className="text-amber-800 dark:text-amber-200">Incorrect</span>
                      )}
                    </span>
                    <span className="text-sm sm:text-lg font-semibold text-slate-700 dark:text-slate-300">
                      Score: {session.compareResult.score}%
                    </span>
                    {!session.compareResult.passed && session.compareResult.suggestion && (
                      <p className="w-full text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 break-words">
                        {session.compareResult.suggestion}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Correction
                  </h4>
                  <div className="p-3 sm:p-5 rounded-lg bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 overflow-x-auto">
                    <p className="text-[clamp(0.75rem,2vw+0.4rem,1rem)] sm:text-[clamp(0.875rem,2.5vw+0.5rem,1.125rem)] font-medium leading-relaxed text-slate-900 dark:text-slate-100 break-words hyphens-none">
                      {session.diff?.map((d, i) => (
                        <DiffWordSpan key={`${i}-${d.word}-${d.status}`} item={d} />
                      ))}
                    </p>
                  </div>
                </div>
                <div className="space-y-3 sm:space-y-4 pt-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-center">
                    Rate difficulty
                  </h4>
                  {session.suggestedGrade !== null && (
                    <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 text-center">
                      Suggested: {['Again', 'Good', 'Easy'][session.suggestedGrade]} — auto-applies in 5s or tap to override
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-md mx-auto">
                    <button
                      type="button"
                      onClick={() => session.submitGrade(0)}
                      className="flex flex-col items-center gap-0.5 sm:gap-1 p-2 sm:p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all group min-w-0"
                    >
                      <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-red-600 truncate w-full text-center">
                        Again
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-slate-400">1m</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => session.submitGrade(1)}
                      className="flex flex-col items-center gap-0.5 sm:gap-1 p-2 sm:p-3 rounded-lg border-primary bg-primary/5 dark:bg-primary/20 transition-all group ring-2 ring-primary min-w-0"
                    >
                      <span className="text-xs sm:text-sm font-bold text-primary truncate w-full text-center">Good</span>
                      <span className="text-[9px] sm:text-[10px] text-primary/70">5m</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => session.submitGrade(2)}
                      className="flex flex-col items-center gap-0.5 sm:gap-1 p-2 sm:p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all group min-w-0"
                    >
                      <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-green-600 truncate w-full text-center">
                        Easy
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-slate-400">✓</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : renderWritingEmptyState(currentLessonId)}
      </div>

      {sessionComplete && (
        <LessonCompletionDialog
          open={showCompletionDialog}
          currentLessonId={currentLessonId}
          currentCourseId={currentCourseId}
          onClose={() => setShowCompletionDialog(false)}
        />
      )}
    </div>
  );
}
