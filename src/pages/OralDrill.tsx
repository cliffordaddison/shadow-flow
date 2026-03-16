import { useEffect } from 'react';
import { TrainingNavbar } from '@/components/layout/TrainingNavbar';
import { LessonHeader } from '@/components/layout/LessonHeader';
import { useOralDrillSession } from '@/engine/oralDrill';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { cancelTTS } from '@/engine/tts';

export function OralDrill() {
  const session = useOralDrillSession();
  useScreenWakeLock();

  // Cancel TTS when leaving the page
  useEffect(() => {
    return () => cancelTTS();
  }, []);

  const ORAL_NAVBAR_METRICS = [
    {
      label: 'Streak',
      value: `🔥 ${session.streak}`,
      valueClass: session.streak > 0 ? 'text-orange-500' : 'text-slate-400',
      desc: 'Consecutive correct answers.',
    },
    {
      label: 'Attempts',
      value: String(session.totalAttempts),
      valueClass: 'text-emerald-600 dark:text-emerald-400',
      desc: 'Total attempts this session.',
    },
  ];

  return (
    <>
      <TrainingNavbar
        modeIcon="campaign"
        modeLabel="Oral Drill"
        navbarMetrics={ORAL_NAVBAR_METRICS}
        allMetrics={ORAL_NAVBAR_METRICS}
        progressButtonLabel="Stats"
      />
      <LessonHeader
        courseName="Oral Drill"
        lessonName="English → French"
        progressLabel="Streak"
        progressValue={`${session.streak} 🔥`}
        metrics={[]}
      />

      <div className="flex-1 min-h-0 p-4 sm:p-8 flex flex-col items-center justify-center max-w-4xl mx-auto w-full overflow-y-auto">
        {session.isEmpty ? (
          <EmptyState />
        ) : session.currentPhrase === null ? (
          <div className="text-center text-slate-500 dark:text-slate-400">
            <p>Loading phrase…</p>
          </div>
        ) : (
          <DrillCard session={session} />
        )}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Sub-components                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="text-center text-slate-500 dark:text-slate-400 space-y-2">
      <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600">
        library_books
      </span>
      <p className="font-semibold text-slate-700 dark:text-slate-300">No phrases loaded</p>
      <p className="text-sm">Upload a course from the Upload File tab to get started.</p>
    </div>
  );
}

function DrillCard({ session }: Readonly<{ session: ReturnType<typeof useOralDrillSession> }>) {
  const { phase } = session;

  return (
    <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col min-h-[420px] sm:min-h-[500px]">
      {/* ── Top bar ── */}
      <div className="px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Speak the French translation
        </span>
        {/* Streak pill */}
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold border ${
            session.streak > 0
              ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-500 border-orange-200 dark:border-orange-800'
              : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
          }`}
        >
          🔥 {session.streak}
        </span>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 py-8 gap-6 text-center">
        {/* English prompt (always visible) */}
        <div className="space-y-1 w-full max-w-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
            English
          </p>
          <h2 className="text-[clamp(1rem,3vw+0.5rem,1.75rem)] font-bold text-slate-900 dark:text-white leading-tight break-words hyphens-none">
            &quot;{session.currentPhrase!.english}&quot;
          </h2>
        </div>

        {/* French reveal (hidden until revealed or result shown) */}
        {(session.revealed || phase === 'result') && (
          <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">French</p>
            <p className="text-[clamp(0.9rem,2.5vw+0.5rem,1.4rem)] font-semibold text-primary break-words hyphens-none">
              {session.currentPhrase!.french}
            </p>
          </div>
        )}

        {/* Phase-specific controls */}
        {phase === 'listening' && <ListeningControls session={session} />}
        {phase === 'speaking' && <SpeakingControls session={session} />}
        {phase === 'result' && <ResultPanel session={session} />}

        {/* Error */}
        {session.error && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-2">{session.error}</p>
        )}
      </div>

      {/* ── Progress bar (attempts) ── */}
      <div className="bg-slate-50/50 dark:bg-slate-800/30 px-6 py-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>Attempts</span>
          <span>{session.totalAttempts}</span>
        </div>
        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, (session.streak / Math.max(session.totalAttempts, 1)) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Listening phase ─── */
function ListeningControls({
  session,
}: Readonly<{ session: ReturnType<typeof useOralDrillSession> }>) {
  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* TTS animation */}
      {session.isPlayingTTS ? (
        <div className="flex items-end gap-1 h-10 px-4">
          {[0.4, 0.8, 1, 0.7, 0.5].map((scale, i) => (
            <span
              key={i}
              className="w-1.5 bg-primary rounded-full animate-bounce"
              style={{ height: `${scale * 40}px`, animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      ) : (
        <span className="text-sm text-slate-500 dark:text-slate-400">
          Listen to the English phrase above
        </span>
      )}

      {/* Controls row */}
      <div className="flex flex-wrap justify-center items-center gap-3 mt-2">
        {/* Replay button */}
        <button
          type="button"
          onClick={session.replayEnglish}
          disabled={session.isPlayingTTS}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-all font-medium text-sm"
          title="Replay English phrase"
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>
            replay
          </span>
          Replay
        </button>

        {/* Mic button — starts speaking phase */}
        <button
          type="button"
          onClick={session.captureSpeech}
          disabled={session.isPlayingTTS}
          className="relative group flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all"
          aria-label="Tap to speak French"
        >
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
            mic
          </span>
          Speak French
        </button>

        {/* Reveal button */}
        {!session.revealed && (
          <button
            type="button"
            onClick={session.reveal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary transition-all font-medium text-sm"
          >
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>
              visibility
            </span>
            Reveal
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Speaking phase ─── */
function SpeakingControls({
  session,
}: Readonly<{ session: ReturnType<typeof useOralDrillSession> }>) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Pulse ring */}
      <div className="relative flex items-center justify-center">
        <span className="absolute inline-flex h-20 w-20 rounded-full bg-red-400 opacity-30 animate-ping" />
        <div className="relative w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30">
          <span
            className="material-symbols-outlined text-3xl text-white"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            mic
          </span>
        </div>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Listening… speak your French answer
      </p>
      <button
        type="button"
        onClick={session.stopListening}
        className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm transition-all"
      >
        Done speaking
      </button>
    </div>
  );
}

/* ─── Result phase ─── */
function ResultPanel({
  session,
}: Readonly<{ session: ReturnType<typeof useOralDrillSession> }>) {
  const { compareResult } = session;
  if (!compareResult) return null;

  const passed = compareResult.passed;

  return (
    <div className="w-full max-w-xl space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-400">
      {/* Result badge */}
      <div
        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${
          passed
            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700'
        }`}
      >
        <span className="material-symbols-outlined text-base">
          {passed ? 'check_circle' : 'cancel'}
        </span>
        {passed ? `Correct! +1 streak` : 'Incorrect — streak reset'}
        <span className="ml-1 font-normal opacity-70">({compareResult.score}%)</span>
      </div>

      {/* You said vs expected */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 text-left">
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">You said</p>
          <p className="text-slate-700 dark:text-slate-300 text-sm break-words">
            {session.userText || <span className="italic text-slate-400">—</span>}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase text-primary tracking-wider mb-1">Expected</p>
          <p className="text-slate-900 dark:text-white font-medium text-sm break-words">
            {session.currentPhrase!.french}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {!passed && (
          <>
            {/* Re-listen and try again */}
            <button
              type="button"
              onClick={session.replayEnglish}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-sm transition-all"
            >
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 0" }}>
                replay
              </span>
              Replay &amp; Try Again
            </button>

            {/* Mic for retry */}
            <button
              type="button"
              onClick={session.captureSpeech}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                mic
              </span>
              Try Again
            </button>
          </>
        )}
        {passed && (
          <button
            type="button"
            onClick={session.nextPhrase}
            className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/30 hover:brightness-110 active:scale-95 transition-all"
          >
            Next Phrase
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 0" }}>
              arrow_forward
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
