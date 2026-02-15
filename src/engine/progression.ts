/**
 * Lesson completion and unlock next.
 */

import { getLesson, unlockNextLesson } from '@/store/courses';
import { getSentencesByLessonId } from '@/store/sentences';
import { getSentenceMasteryStatus } from '@/store/sentenceMastery';

const LISTEN_COMPLETED_KEY = 'shadowflow-listen-completed';

function getListenCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(LISTEN_COMPLETED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function checkLessonCompletion(lessonId: string): {
  listen: boolean;
  speak: boolean;
  write: boolean;
  overall: boolean;
} {
  const lesson = getLesson(lessonId);
  if (!lesson) return { listen: false, speak: false, write: false, overall: false };
  const sentences = getSentencesByLessonId(lessonId);
  const listenCompleted = getListenCompleted();

  let listenOk = true;
  let speakOk = true;
  let writeOk = true;

  for (const s of sentences) {
    if (!listenCompleted.has(s.id)) listenOk = false;
    // Mastery: ≥3 reps and interval ≥21 days for speak or write (per sentenceMastery rules)
    const mastered = getSentenceMasteryStatus(s.id);
    if (!mastered) speakOk = false;
    if (!mastered) writeOk = false;
  }

  const overall = listenOk && speakOk && writeOk;
  return { listen: listenOk, speak: speakOk, write: writeOk, overall };
}

export function isLessonComplete(lessonId: string): boolean {
  return checkLessonCompletion(lessonId).overall;
}

export function unlockNextLessonAfterComplete(lessonId: string): void {
  const result = checkLessonCompletion(lessonId);
  if (result.overall) {
    unlockNextLesson(lessonId);
  }
}
