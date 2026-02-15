/**
 * SM-2 style SRS: updateReviewState(grade), due date, next sentence.
 */

import type { ReviewState, ReviewGrade } from '@/types';
import { getReviewState, setReviewState } from '@/store/reviewStates';
import { getSentence, getAllSentences, getSentencesByLessonId } from '@/store/sentences';
import { getDueReviews } from '@/store/reviewStates';
import { getLesson } from '@/store/courses';
import type { ReviewMode } from '@/types';

const INITIAL_EASE = 2.5;
const MIN_EASE = 1.3;

export function calculateDueDate(intervalDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + intervalDays);
  return d.toISOString().slice(0, 10);
}

export function isDue(dueDate: string): boolean {
  const due = new Date(dueDate).setHours(0, 0, 0, 0);
  const now = new Date().setHours(0, 0, 0, 0);
  return due <= now;
}

function getOrCreateState(sentenceId: string, mode: ReviewMode): ReviewState {
  let state = getReviewState(sentenceId, mode);
  if (!state) {
    const today = new Date().toISOString().slice(0, 10);
    state = {
      sentenceId,
      mode,
      interval: 0,
      due: today,
      ease: INITIAL_EASE,
      repetitions: 0,
      lapses: 0,
    };
  }
  return state;
}

/**
 * SM-2 style: Grade 0 = Again, 1 = Good, 2 = Easy.
 * Again: repetitions=0, lapses+=1, interval=1, ease = max(1.3, ease - 0.2)
 * Good: repetitions+=1, interval (1→3→interval*ease), ease = max(1.3, ease - 0.1)
 * Easy: repetitions+=1, same interval, ease += 0.1
 */
export function updateReviewState(
  sentenceId: string,
  mode: ReviewMode,
  grade: ReviewGrade
): ReviewState {
  const state = getOrCreateState(sentenceId, mode);
  const today = new Date().toISOString().slice(0, 10);
  const next: ReviewState = {
    ...state,
    lastResult: grade,
    lastReviewedAt: today,
  };

  if (grade === 0) {
    next.repetitions = 0;
    next.lapses = state.lapses + 1;
    next.interval = 1;
    next.ease = Math.max(MIN_EASE, state.ease - 0.2);
    next.due = calculateDueDate(1);
  } else {
    next.repetitions = state.repetitions + 1;
    if (state.repetitions === 0) {
      next.interval = grade === 2 ? 4 : 1;
    } else if (state.repetitions === 1) {
      next.interval = grade === 2 ? 6 : 3;
    } else {
      const mult = grade === 2 ? 1.3 : 1;
      next.interval = Math.round(state.interval * state.ease * mult);
    }
    next.ease = grade === 2 ? state.ease + 0.1 : Math.max(MIN_EASE, state.ease - 0.1);
    next.due = calculateDueDate(next.interval);
  }

  setReviewState(next);
  return next;
}

function isLessonUnlocked(lessonId: string): boolean {
  const lesson = getLesson(lessonId);
  return !!lesson?.isUnlocked;
}

/**
 * Get next sentence for a mode: due first, then new (no state or interval=0).
 * Only returns sentences whose lesson is unlocked.
 */
export function getNextSentence(
  mode: ReviewMode,
  lessonId?: string
): { sentenceId: string; state: ReviewState } | null {
  if (lessonId && !isLessonUnlocked(lessonId)) return null;

  const due = getDueReviews(mode, 50);
  for (const state of due) {
    const sentence = getSentence(state.sentenceId);
    if (!sentence) continue;
    if (!isLessonUnlocked(sentence.lessonId)) continue;
    if (lessonId && sentence.lessonId !== lessonId) continue;
    return { sentenceId: state.sentenceId, state };
  }
  const allForLesson = lessonId ? getSentencesByLessonId(lessonId) : getAllSentences();
  const sentences = allForLesson.filter((s) => isLessonUnlocked(s.lessonId));
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
