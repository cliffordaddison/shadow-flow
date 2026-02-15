/**
 * Migration: old sentences + SentenceProgress → Course, Lesson, ReviewState.
 */

import type { Course, Lesson, Sentence } from '@/types';
import { addCourse, addLesson } from './courses';
import { setSentences } from './sentences';
import { setReviewState } from './reviewStates';
import { buildWordIndex } from './wordStats';

const MIGRATION_VERSION_KEY = 'shadowflow-data-version';
const CURRENT_VERSION = 2;

interface OldSentence {
  id: string;
  englishText: string;
  frenchText: string;
  sourceLesson?: string;
  sourceFileId?: string;
  createdAt: number;
}

interface OldSentenceProgress {
  sentenceId: string;
  exposedAt: number | null;
  speakingLevel: number;
  nextReviewAt: number;
  lastSpeakingScore: number | null;
  successfulRecalls: number;
  writingLevel: number;
  writingNextReviewAt: number;
  lastWritingScore: number | null;
}

function loadOldSentences(): OldSentence[] {
  try {
    const raw = localStorage.getItem('shadowflow-sentences');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OldSentence[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadOldProgress(): OldSentenceProgress[] {
  try {
    const raw = localStorage.getItem('shadowflow-sentence-progress');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OldSentenceProgress[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Map old speaking level (0-6) to approximate SM-2 interval in days. */
function levelToIntervalDays(level: number): number {
  const map: Record<number, number> = {
    0: 0,
    1: 1,
    2: 3,
    3: 7,
    4: 14,
    5: 30,
    6: 90,
  };
  return map[level] ?? 0;
}

function toISODate(ms: number): string {
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

/** Build and persist review states for one sentence during migration. */
function persistReviewStatesForSentence(
  s: Sentence,
  p: OldSentenceProgress | undefined,
  today: string
): void {
  const speakInterval = p ? levelToIntervalDays(p.speakingLevel) : 0;
  const speakDue = p?.nextReviewAt ? toISODate(p.nextReviewAt) : today;
  const writeInterval = p ? levelToIntervalDays(p.writingLevel) : 0;
  const writeDue = p?.writingNextReviewAt ? toISODate(p.writingNextReviewAt) : today;

  setReviewState({
    sentenceId: s.id,
    mode: 'speak',
    interval: speakInterval,
    due: speakDue,
    ease: 2.5,
    repetitions: p?.successfulRecalls ?? 0,
    lapses: 0,
    lastReviewedAt: p?.nextReviewAt ? toISODate(p.nextReviewAt) : undefined,
  });
  setReviewState({
    sentenceId: s.id,
    mode: 'write',
    interval: writeInterval,
    due: writeDue,
    ease: 2.5,
    repetitions: 0,
    lapses: 0,
    lastReviewedAt: p?.writingNextReviewAt ? toISODate(p.writingNextReviewAt) : undefined,
  });
  setReviewState({
    sentenceId: s.id,
    mode: 'listen',
    interval: 0,
    due: today,
    ease: 2.5,
    repetitions: 0,
    lapses: 0,
  });
}

/**
 * Migrate old sentences and progress to new model.
 * Creates default course "Imported Sentences", one lesson, new Sentence shape, ReviewStates.
 */
export function migrateOldSentencesToNewModel(): boolean {
  try {
    const version = localStorage.getItem(MIGRATION_VERSION_KEY);
    if (version === String(CURRENT_VERSION)) return false;

    const oldSentences = loadOldSentences();
    const oldProgress = loadOldProgress();
    const progressMap = new Map<string, OldSentenceProgress>();
    oldProgress.forEach((p) => progressMap.set(p.sentenceId, p));

    if (oldSentences.length === 0) {
      localStorage.setItem(MIGRATION_VERSION_KEY, String(CURRENT_VERSION));
      return false;
    }

    const courseId = `migrated-${Date.now()}`;
    const lessonId = `${courseId}-lesson-0`;
    const now = Date.now();
    const today = toISODate(now);

    const course: Course = {
      id: courseId,
      name: 'Imported Sentences',
      createdAt: new Date(now).toISOString(),
      lessons: [
        { id: lessonId, name: 'Lesson 1', order: 0, isUnlocked: true },
      ],
    };

    const lesson: Lesson = {
      id: lessonId,
      courseId,
      name: 'Lesson 1',
      order: 0,
      sentenceIds: [],
      isUnlocked: true,
    };

    const sentences: Sentence[] = oldSentences.map((s, i) => ({
      id: s.id,
      lessonId,
      index: i,
      french: s.frenchText,
      english: s.englishText,
      sourceFileId: s.sourceFileId,
      createdAt: s.createdAt,
    }));

    lesson.sentenceIds = sentences.map((s) => s.id);

    for (const s of sentences) {
      persistReviewStatesForSentence(s, progressMap.get(s.id), today);
    }

    addCourse(course);
    addLesson(lesson);
    setSentences(sentences);
    buildWordIndex(sentences);

    localStorage.setItem(MIGRATION_VERSION_KEY, String(CURRENT_VERSION));
    return true;
  } catch {
    return false;
  }
}
