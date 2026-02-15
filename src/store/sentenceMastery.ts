/**
 * Sentence mastery store.
 *
 * Mastery algorithm: A sentence is considered mastered when either Speaking OR Writing
 * has repetitions >= 3 and interval >= 21 days (SRS). When you grade a sentence (Again/Good/Easy)
 * or use Skip (I know it), review state is updated and updateSentenceMastery() is called.
 * Lesson completion uses this: all sentences in a lesson must be mastered (plus Listen
 * completed) before you can switch to another lesson.
 */

import type { SentenceMastery as SentenceMasteryType } from '@/types';
import { getReviewStatesForSentence } from './reviewStates';

const STORAGE_KEY = 'shadowflow-sentence-mastery';

const masteryMap = new Map<string, SentenceMasteryType>();

function load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as SentenceMasteryType[];
    if (Array.isArray(parsed)) {
      masteryMap.clear();
      parsed.forEach((m) => masteryMap.set(m.sentenceId, m));
    }
  } catch (_) {}
}

function save(): void {
  try {
    const arr = Array.from(masteryMap.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (_) {}
}

load();

export function updateSentenceMastery(sentenceId: string): void {
  const states = getReviewStatesForSentence(sentenceId);
  const speak = states.find((s) => s.mode === 'speak');
  const write = states.find((s) => s.mode === 'write');
  const minReps = 3;
  const minIntervalDays = 21;

  const speakOk = speak && speak.repetitions >= minReps && speak.interval >= minIntervalDays;
  const writeOk = write && write.repetitions >= minReps && write.interval >= minIntervalDays;
  const isMastered = !!(speakOk || writeOk);

  const existing = masteryMap.get(sentenceId);
  if (existing?.isMastered === isMastered) return;

  const today = new Date().toISOString().slice(0, 10);
  masteryMap.set(sentenceId, {
    sentenceId,
    isMastered,
    masteredAt: isMastered ? today : undefined,
  });
  save();
}

export function getMasteredSentences(): SentenceMasteryType[] {
  return Array.from(masteryMap.values()).filter((m) => m.isMastered);
}

export function getSentenceMasteryStatus(sentenceId: string): boolean {
  return masteryMap.get(sentenceId)?.isMastered ?? false;
}

/** Clear in-memory sentence mastery and persist empty (used by reset/delete before reload). */
export function clearSentenceMasteryInMemory(): void {
  masteryMap.clear();
  save();
}

/** Remove mastery entries for the given sentence IDs (cascade when sentences are deleted). */
export function removeSentenceMasteryBySentenceIds(sentenceIds: Set<string>): void {
  let changed = false;
  for (const id of sentenceIds) {
    if (masteryMap.has(id)) {
      masteryMap.delete(id);
      changed = true;
    }
  }
  if (changed) save();
}
