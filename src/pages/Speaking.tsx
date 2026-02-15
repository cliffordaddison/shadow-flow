import { useMemo } from 'react';
import { TrainingNavbar } from '@/components/layout/TrainingNavbar';
import { LessonHeader } from '@/components/layout/LessonHeader';
import { useSpeakingSession } from '@/engine/speaking';
import { getProgressSnapshot } from '@/engine/metrics';
import { useStore } from '@/store/useStore';
import { getCourse } from '@/store/courses';
import { getSentencesByLessonId, getAllSentences } from '@/store/sentences';
import { getReviewState } from '@/store/reviewStates';
import type { ReviewGrade } from '@/types';

function getGradeLabel(grade: ReviewGrade): string {
  if (grade === 0) return 'Again';
  if (grade === 1) return 'Good';
  return 'Easy';
}

function useSpeakingMetrics(currentLessonId: string | null) {
  return useMemo(() => {
    if (!currentLessonId) return '—';
    const lessonSentences = getSentencesByLessonId(currentLessonId);
    const total = lessonSentences.length;
    if (total === 0) return '—';
    const completed = lessonSentences.filter((s) => getReviewState(s.id, 'speak').repetitions > 0).length;
    return `${completed} / ${total}`;
  }, [currentLessonId]);
}

type SessionLike = {
  current: { english: string; french: string } | null;
  againQueueLength: number;
  isListening: boolean;
  stopListening: () => void;
  captureSpeech: () => void;
  skipSentence: () => void;
  compareResult: { passed: boolean } | null;
  suggestedGrade: ReviewGrade | null;
  autoSubmitted: boolean;
  userText: string;
  error: string | null;
  cancelAutoSubmit: () => void;
  submitGrade: (g: ReviewGrade) => void;
};

function SpeakingCard({ session }: Readonly<{ session: SessionLike }>) {
  return (
    <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 sm:p-8 md:p-12 mb-8 text-center relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <p className="text-slate-400 dark:text-slate-500 text-sm uppercase font-bold tracking-widest mb-6">
        Say this in French
      </p>
      <h2 className="text-[clamp(0.875rem,2.5vw+0.5rem,2rem)] sm:text-[clamp(1.125rem,4vw+0.75rem,3rem)] font-bold tracking-tight text-slate-900 dark:text-white mb-6 sm:mb-8 leading-tight break-words hyphens-none px-1">
        &quot;{session.current!.english}&quot;
      </h2>
      {session.againQueueLength > 0 && (
        <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
          Again queue: {session.againQueueLength} sentence{session.againQueueLength === 1 ? '' : 's'} to retry
        </p>
      )}
      <div className="flex flex-col items-center justify-center gap-4 mt-8">
        {session.isListening && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Speaking… Click <strong>Done speaking</strong> when finished.</p>
        )}
        {session.isListening ? (
          <button
            type="button"
            onClick={() => session.stopListening()}
            className="px-6 py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
          >
            Done speaking
          </button>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              type="button"
              onClick={() => session.captureSpeech()}
              className="relative group w-24 h-24 bg-primary text-white rounded-full flex flex-col items-center justify-center shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all duration-200 z-10"
              aria-label="Tap to speak"
            >
              <span className="material-symbols-outlined text-4xl mb-1">mic</span>
              <span className="text-[10px] font-bold uppercase tracking-wide opacity-90">
                Tap & speak
              </span>
            </button>
            <button
              type="button"
              onClick={() => session.skipSentence()}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium transition-colors"
            >
              Skip
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SpeakingCompareResult({ session }: Readonly<{ session: SessionLike }>) {
  if (!session.compareResult) return null;
  return (
    <div className="w-full max-w-2xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap justify-center gap-2 mb-2">
        <span
          className={`px-4 py-1 rounded-full text-sm font-bold flex items-center gap-2 ${
            session.compareResult.passed
              ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
          }`}
        >
          <span className="material-symbols-outlined text-base">
            {session.compareResult.passed ? 'check_circle' : 'info'}
          </span>
          {session.compareResult.passed ? 'Good!' : 'Close!'}
        </span>
        {session.suggestedGrade != null && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {session.autoSubmitted
              ? `Applied: ${getGradeLabel(session.suggestedGrade)}`
              : `Suggested: ${getGradeLabel(session.suggestedGrade)} (or override below)`}
          </span>
        )}
      </div>
      <div className="bg-white dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-8 items-start md:items-center">
        <div className="flex-1 w-full min-w-0">
          <p className="text-xs text-slate-400 font-bold uppercase mb-2">You said:</p>
          <p className="text-[clamp(0.75rem,2vw+0.4rem,1.125rem)] sm:text-[clamp(0.875rem,2.5vw+0.5rem,1.25rem)] text-slate-700 dark:text-slate-300 break-words hyphens-none">{session.userText || '—'}</p>
        </div>
        <div className="flex-1 w-full min-w-0">
          <p className="text-xs text-primary font-bold uppercase mb-2">Expected:</p>
          <p className="text-[clamp(0.75rem,2vw+0.4rem,1.125rem)] sm:text-[clamp(0.875rem,2.5vw+0.5rem,1.25rem)] text-slate-900 dark:text-white font-medium break-words hyphens-none">{session.current!.french}</p>
        </div>
      </div>
    </div>
  );
}

function SpeakingGradeFooter({ session }: Readonly<{ session: SessionLike }>) {
  return (
    <footer className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-background-dark/80 backdrop-blur-xl mt-auto shrink-0">
      <div className="max-w-2xl mx-auto flex gap-4">
        <button
          type="button"
          onClick={() => { session.cancelAutoSubmit(); session.submitGrade(0); }}
          className="flex-1 flex flex-col items-center justify-center py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-600 dark:text-slate-400 hover:text-red-500 rounded-xl transition-all border border-transparent hover:border-red-200 dark:hover:border-red-800 group"
        >
          <span className="text-lg font-bold">Again</span>
        </button>
        <button
          type="button"
          onClick={() => { session.cancelAutoSubmit(); session.submitGrade(1); }}
          className="flex-1 flex flex-col items-center justify-center py-3 px-4 bg-primary text-white shadow-lg shadow-primary/20 rounded-xl transition-all hover:brightness-110"
        >
          <span className="text-lg font-bold">Good</span>
        </button>
        <button
          type="button"
          onClick={() => { session.cancelAutoSubmit(); session.submitGrade(2); }}
          className="flex-1 flex flex-col items-center justify-center py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-green-50 dark:hover:bg-green-900/20 text-slate-600 dark:text-slate-400 hover:text-green-500 rounded-xl transition-all border border-transparent hover:border-green-200 dark:hover:border-green-800 group"
        >
          <span className="text-lg font-bold">Easy</span>
        </button>
      </div>
    </footer>
  );
}

export function Speaking() {
  const currentLessonId = useStore((s) => s.currentLessonId);
  const currentCourseId = useStore((s) => s.currentCourseId);
  const session = useSpeakingSession(currentLessonId ?? undefined);
  const snapshot = getProgressSnapshot('speak');
  const course = currentCourseId ? getCourse(currentCourseId) : null;
  const totalSentences = getAllSentences().length;

  const progressValue = useSpeakingMetrics(currentLessonId);

  const wordsMasteredValue = snapshot.uniqueWords > 0
    ? `${snapshot.wordsMastered} / ${snapshot.uniqueWords}`
    : '—';
  const sentencesMasteredValue = totalSentences > 0
    ? `${snapshot.sentencesMastered} / ${totalSentences}`
    : '—';

  const SPEAKING_NAVBAR_METRICS = [
    { label: 'Unique words', value: wordsMasteredValue, valueClass: 'text-primary', desc: 'Words mastered / total unique words.' },
    { label: 'Today', value: `+${snapshot.wordsSeenToday}`, valueClass: 'text-emerald-600 dark:text-emerald-400', desc: 'Sentences practiced today.' },
  ];

  const SPEAKING_PAGE_METRICS = [
    { label: 'Words mastered', value: wordsMasteredValue, valueClass: 'text-slate-700 dark:text-slate-300', desc: 'Words mastered / total unique words.' },
    { label: 'Sentences mastered', value: sentencesMasteredValue, valueClass: 'text-slate-700 dark:text-slate-300', desc: 'Sentences mastered / total sentences.' },
  ];

  const SPEAKING_ALL_METRICS = [...SPEAKING_NAVBAR_METRICS, ...SPEAKING_PAGE_METRICS];

  const courseName = course?.name ?? '—';
  const lessonName = session.current ? 'Speaking' : '—';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TrainingNavbar
        modeIcon="record_voice_over"
        modeLabel="Speaking"
        navbarMetrics={SPEAKING_NAVBAR_METRICS}
        allMetrics={SPEAKING_ALL_METRICS}
      />
      <LessonHeader
        courseName={courseName}
        lessonName={lessonName}
        progressLabel="Progress"
        progressValue={progressValue}
        metrics={SPEAKING_PAGE_METRICS}
      />
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center max-w-4xl mx-auto w-full px-6 py-8 overflow-y-auto">
        {session.current ? (
          <>
            <SpeakingCard session={session} />
            <SpeakingCompareResult session={session} />
            {session.error && (
              <div className="w-full max-w-2xl p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-sm">
                {session.error}
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-slate-500 dark:text-slate-400">
            <p>No sentences due for speaking.</p>
            <p className="mt-2 text-sm">Complete Listen & Repeat first or upload a course.</p>
          </div>
        )}
      </div>

      {session.current && session.compareResult && <SpeakingGradeFooter session={session} />}
    </div>
  );
}
