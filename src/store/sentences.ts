/**
 * Sentence store: CRUD, persistence via IndexedDB or localStorage fallback.
 */

import type { Sentence, UniqueWordsStats } from '@/types';
import { getLesson } from './courses';
import * as db from './db';
import { getDueReviews, getReviewState, removeReviewStatesBySentenceIds } from './reviewStates';
import { getMasteredSentences, removeSentenceMasteryBySentenceIds } from './sentenceMastery';
import { pruneWordStatsBySentenceIds } from './wordStats';
import { updateReviewState } from '@/engine/srs';
import { trackUniqueWords } from '@/engine/uniqueWords';

const SENTENCES_KEY = 'shadowflow-sentences';

const sentences: Sentence[] = [];

function loadSentences(): void {
  try {
    const raw = localStorage.getItem(SENTENCES_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Sentence[];
    if (Array.isArray(parsed)) {
      sentences.length = 0;
      sentences.push(...parsed);
    }
  } catch (_) {}
}

function saveSentences(): void {
  try {
    localStorage.setItem(SENTENCES_KEY, JSON.stringify(sentences));
  } catch (_) {}
}

export async function initFromDB(): Promise<void> {
  try {
    const data = await db.getAll<Sentence>('sentences');
    sentences.length = 0;
    if (Array.isArray(data)) sentences.push(...data);
  } catch (_) {}
}

export function initFromLocalStorage(): void {
  loadSentences();
}

/** Append sentences to in-memory array only (after transaction put). */
export function appendSentencesToMemory(newSentences: Sentence[]): void {
  const existingIds = new Set(sentences.map((s) => s.id));
  for (const s of newSentences) {
    if (!existingIds.has(s.id)) {
      sentences.push(s);
      existingIds.add(s.id);
    }
  }
}

export function getAllSentences(): Sentence[] {
  return [...sentences];
}

export function getSentencesPage(offset: number, limit: number): Sentence[] {
  return sentences.slice(offset, offset + limit);
}

export function getSentence(id: string): Sentence | undefined {
  return sentences.find((s) => s.id === id);
}

export function getSentencesByLessonId(lessonId: string): Sentence[] {
  return sentences.filter((s) => s.lessonId === lessonId).sort((a, b) => a.index - b.index);
}

export function getDueSentences(limit?: number): Sentence[] {
  const due = getDueReviews('speak', limit);
  return due
    .map((rs) => getSentence(rs.sentenceId))
    .filter((s): s is Sentence => s != null);
}

export function getMasteredSpeakingCount(): number {
  return getMasteredSentences().length;
}

export function getUnexposedSentences(): Sentence[] {
  return sentences.filter((s) => getReviewState(s.id, 'speak').repetitions === 0);
}

export function getDueWritingSentences(): Sentence[] {
  const due = getDueReviews('write');
  return due
    .map((rs) => getSentence(rs.sentenceId))
    .filter((s): s is Sentence => s != null);
}

export function updateSpeakingResult(sentenceId: string, score: number): void {
  const grade = score >= 85 ? 2 : score >= 70 ? 1 : 0;
  updateReviewState(sentenceId, 'speak', grade as 0 | 1 | 2);
}

/** Map sentenceId -> { speakingLevel } derived from speak review state. Level 0–6 for display. */
export function getProgressMap(): Map<string, { speakingLevel: number }> {
  const map = new Map<string, { speakingLevel: number }>();
  for (const s of sentences) {
    const rs = getReviewState(s.id, 'speak');
    let level = 0;
    if (rs.repetitions >= 3 && rs.interval >= 21) level = 6;
    else if (rs.repetitions >= 1 || rs.interval > 0) {
      if (rs.interval >= 14) level = 5;
      else if (rs.interval >= 7) level = 4;
      else if (rs.interval >= 3) level = 3;
      else if (rs.interval >= 1) level = 2;
      else level = 1;
    }
    map.set(s.id, { speakingLevel: level });
  }
  return map;
}

export function getUniqueWordsStats(excludeStopwords: boolean = true): UniqueWordsStats {
  const mastered = new Set(getMasteredSentences().map((m) => m.sentenceId));
  return trackUniqueWords(sentences, mastered, excludeStopwords);
}

export function addSentences(newSentences: Sentence[]): void {
  const existingIds = new Set(sentences.map((s) => s.id));
  const toAdd: Sentence[] = [];
  for (const s of newSentences) {
    if (!existingIds.has(s.id)) {
      sentences.push(s);
      existingIds.add(s.id);
      toAdd.push(s);
    }
  }
  if (db.getUseIndexedDB() && toAdd.length > 0) {
    db.putMany('sentences', toAdd).catch(() => {});
  } else if (toAdd.length > 0) {
    saveSentences();
  }
}

export function setSentences(newSentences: Sentence[]): void {
  sentences.length = 0;
  sentences.push(...newSentences);
  if (db.getUseIndexedDB()) {
    db.clearStore('sentences')
      .then(() => (newSentences.length > 0 ? db.putMany('sentences', newSentences) : Promise.resolve()))
      .catch(() => {});
  } else {
    saveSentences();
  }
}

/** Clear in-memory sentences (used by reset/delete before reload). */
export function clearSentencesInMemory(): void {
  sentences.length = 0;
}

/** Sentence IDs for a file (for cascade delete before removeSentencesByFileId). */
export function getSentenceIdsByFileId(fileId: string): string[] {
  return sentences.filter((s) => s.sourceFileId === fileId).map((s) => s.id);
}

/** Remove sentences by sourceFileId; cascade: remove from lesson.sentenceIds, review states, word stats, sentence mastery. Returns count removed. */
export async function removeSentencesByFileId(fileId: string): Promise<number> {
  const toRemove = sentences.filter((s) => s.sourceFileId === fileId);
  const ids = new Set(toRemove.map((s) => s.id));
  await removeReviewStatesBySentenceIds(ids);
  await pruneWordStatsBySentenceIds(ids);
  removeSentenceMasteryBySentenceIds(ids);
  for (const s of toRemove) {
    const lesson = getLesson(s.lessonId);
    if (lesson && lesson.sentenceIds) {
      lesson.sentenceIds = lesson.sentenceIds.filter((id) => id !== s.id);
    }
  }
  for (let i = sentences.length - 1; i >= 0; i--) {
    if (ids.has(sentences[i].id)) sentences.splice(i, 1);
  }
  if (db.getUseIndexedDB() && toRemove.length > 0) {
    await Promise.all(toRemove.map((s) => db.deleteKey('sentences', s.id)));
  } else {
    saveSentences();
  }
  return toRemove.length;
}

export function exportToJson(): string {
  const data = {
    sentences: [...sentences],
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}
