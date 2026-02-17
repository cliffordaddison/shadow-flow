/**
 * Sentence mastery store — session-based mastery.
 *
 * A sentence is considered mastered when it reaches "Easy" grade in the
 * current session (i.e. the user gets it right on the first attempt, or
 * reaches Easy after retries within the session). Each mastery event
 * increments a persistent mastery count (+1).
 *
 * There is NO 21-day interval requirement — mastery is immediate within
 * the session.
 */

import type { SentenceMastery as SentenceMasteryType, DifficultyPath } from '@/types';

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
  } catch (_) { }
}

function save(): void {
  try {
    const arr = Array.from(masteryMap.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (_) { }
}

load();

function deriveDifficulty(attemptCount: number): DifficultyPath {
  if (attemptCount <= 1) return 'easy';
  if (attemptCount === 2) return 'good';
  return 'difficult';
}

/**
 * Mark a sentence as mastered (session-based).
 *
 * Called when the user grades a sentence Easy in the current session.
 * Each call increments the persistent mastery count by 1.
 *
 * @param sentenceId  The sentence that was mastered
 * @param grade       The ReviewGrade (0=Again, 1=Good, 2=Easy)
 * @param attemptCount  The number of attempts in this session for this sentence
 */
export function updateSentenceMastery(
  sentenceId: string,
  grade?: number,
  attemptCount?: number
): void {
  const existing = masteryMap.get(sentenceId);
  const today = new Date().toISOString().slice(0, 10);

  // If a grade is provided and it's Easy (2), mark as mastered immediately
  // If no grade is provided, fall back to the old simple check (backward compat)
  const isEasy = grade === 2;

  const currentDifficulty = attemptCount != null
    ? deriveDifficulty(attemptCount)
    : existing?.currentDifficulty ?? 'difficult';

  const currentCount = existing?.transitionCount ?? 0;

  if (isEasy || grade === undefined) {
    // Mark as mastered (or stay mastered) and increment count
    const newCount = (grade === 2 || grade === undefined) ? currentCount + 1 : currentCount;
    const isMastered = isEasy || (grade === undefined ? (existing?.isMastered ?? false) : false);

    if (
      existing?.isMastered === isMastered &&
      existing?.currentDifficulty === currentDifficulty &&
      existing?.transitionCount === newCount
    ) {
      return; // no change
    }

    masteryMap.set(sentenceId, {
      sentenceId,
      isMastered,
      masteredAt: isMastered ? today : existing?.masteredAt,
      currentDifficulty,
      transitionCount: newCount,
    });
    save();
  } else {
    // Grade is Again or Good but not Easy — sentence is not yet mastered this session
    // Just update difficulty/count for tracking
    if (
      existing?.currentDifficulty === currentDifficulty &&
      !existing?.isMastered
    ) {
      return; // no meaningful change
    }

    masteryMap.set(sentenceId, {
      sentenceId,
      isMastered: false,
      masteredAt: existing?.masteredAt,
      currentDifficulty,
      transitionCount: currentCount,
    });
    save();
  }
}

/**
 * Directly mark a sentence as mastered with a specific attempt count.
 * Used by speaking/writing session when a sentence is graded Easy.
 */
export function markSentenceMasteredInSession(sentenceId: string, attemptCount: number): void {
  const existing = masteryMap.get(sentenceId);
  const today = new Date().toISOString().slice(0, 10);
  const currentCount = (existing?.transitionCount ?? 0) + 1;
  const difficulty = deriveDifficulty(attemptCount);

  masteryMap.set(sentenceId, {
    sentenceId,
    isMastered: true,
    masteredAt: today,
    currentDifficulty: difficulty,
    transitionCount: currentCount,
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
