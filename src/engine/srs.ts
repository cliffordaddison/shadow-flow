/**
 * Session-based SRS: grade by attempt count (1st/2nd/3rd+), schedule repeats
 * within the session (0ms / 5min / 1min). No SM-2, no day-based intervals.
 * A sentence is mastered when it reaches Easy in the current session.
 *
 * getNextSentence still provides the feed of sentences to work through per lesson,
 * but no longer enforces isLessonUnlocked when an explicit lessonId is given
 * (so navigation via Next Lesson / Skip works immediately).
 */

import type { ReviewState, ReviewGrade } from '@/types';
import { getReviewState, setReviewState } from '@/store/reviewStates';
import { getSentence, getAllSentences, getSentencesByLessonId } from '@/store/sentences';
import { getDueReviews } from '@/store/reviewStates';
import { getLesson } from '@/store/courses';
import type { ReviewMode } from '@/types';

// ─── Session grading helpers (attempt-count based) ─────────────────────────

/**
 * Derive the session grade from the attempt count within the current session.
 *   1st attempt → Easy (2)
 *   2nd attempt → Good (1)
 *   3rd+ attempt → Again (0)
 */
export function gradeByAttempt(attemptCount: number): ReviewGrade {
  if (attemptCount <= 1) return 2;
  if (attemptCount === 2) return 1;
  return 0;
}

/**
 * Return the in-session repeat delay in milliseconds for a grade.
 *   Easy  → 0  (no repeat in session – sentence is mastered)
 *   Good  → 5 minutes
 *   Again → 1 minute
 */
export function sessionDelayMs(grade: ReviewGrade): number {
  if (grade === 2) return 0;
  if (grade === 1) return 5 * 60 * 1000; // 5 min
  return 1 * 60 * 1000; // 1 min
}

// ─── ReviewState management (simplified, no SM-2 intervals) ────────────────

function getOrCreateState(sentenceId: string, mode: ReviewMode): ReviewState {
  let state = getReviewState(sentenceId, mode);
  if (!state) {
    const today = new Date().toISOString().slice(0, 10);
    state = {
      sentenceId,
      mode,
      interval: 0,
      due: today,
      ease: 2.5,
      repetitions: 0,
      lapses: 0,
    };
  }
  return state;
}

/**
 * Record a grade and persist the review state.
 * Session-based: we simply increment repetitions / lapses to keep a
 * lightweight history that other parts of the UI can read.
 *
 * IMPORTANT: After grading, we set interval=1 and due=tomorrow so that
 * getNextSentence no longer returns this sentence.  Within-session repeats
 * are handled by the scheduledQueue in speaking.ts / writing.ts.
 */
export function updateReviewState(
  sentenceId: string,
  mode: ReviewMode,
  grade: ReviewGrade
): ReviewState {
  const state = getOrCreateState(sentenceId, mode);
  const today = new Date().toISOString().slice(0, 10);
  // Push due to tomorrow so getNextSentence skips this sentence
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const next: ReviewState = {
    ...state,
    lastResult: grade,
    lastReviewedAt: today,
  };

  if (grade === 0) {
    // Again – session queue will re-show after 1 min
    next.repetitions = state.repetitions;
    next.lapses = state.lapses + 1;
  } else {
    // Good or Easy
    next.repetitions = state.repetitions + 1;
  }

  // Mark as "reviewed" so getNextSentence moves on to the next sentence
  next.interval = 1;
  next.due = tomorrowStr;
  next.ease = state.ease;

  setReviewState(next);
  return next;
}

function isLessonUnlocked(lessonId: string): boolean {
  const lesson = getLesson(lessonId);
  return !!lesson?.isUnlocked;
}

/**
 * Get next sentence for a mode.
 *
 * When an explicit `lessonId` is provided (Speaking/Writing navigating to a
 * specific lesson) we skip the unlock gate entirely – the caller already
 * decided which lesson to load.  If no lessonId is provided we still respect
 * the unlock flag for global feeds.
 */
export function getNextSentence(
  mode: ReviewMode,
  lessonId?: string
): { sentenceId: string; state: ReviewState } | null {
  // Only enforce unlock for the global (no lessonId) feed
  if (lessonId && !isLessonUnlocked(lessonId)) {
    // Still allow: explicit navigation overrides lock
  }

  const due = getDueReviews(mode, 50);
  for (const state of due) {
    const sentence = getSentence(state.sentenceId);
    if (!sentence) continue;
    // For global feed, still respect unlock
    if (!lessonId && !isLessonUnlocked(sentence.lessonId)) continue;
    if (lessonId && sentence.lessonId !== lessonId) continue;
    return { sentenceId: state.sentenceId, state };
  }

  const allForLesson = lessonId ? getSentencesByLessonId(lessonId) : getAllSentences();
  const sentences = lessonId
    ? allForLesson // explicit lesson – no unlock filter
    : allForLesson.filter((s) => isLessonUnlocked(s.lessonId));
  const today = new Date().toISOString().slice(0, 10);
  for (const s of sentences) {
    const state = getReviewState(s.id, mode);
    if (!state || (state.interval === 0 && state.due <= today)) {
      const st = getOrCreateState(s.id, mode);
      setReviewState(st);
      return { sentenceId: s.id, state: st };
    }
  }
  return null;
}

export function getOrCreateReviewState(sentenceId: string, mode: ReviewMode): ReviewState {
  return getOrCreateState(sentenceId, mode);
}
