/**
 * Progress metrics: global stats, mode snapshot, today progress.
 */

import type { GlobalStats } from '@/types';
import { getWordStats, getMasteredWords } from '@/store/wordStats';
import { getMasteredSentences } from '@/store/sentenceMastery';

export function getGlobalStats(): GlobalStats {
  const all = getWordStats();
  const mastered = getMasteredWords();
  const today = new Date().toISOString().slice(0, 10);
  const wordsSeenToday = all.filter((w) => w.lastSeenAt === today).length;
  const sentencesMastered = getMasteredSentences().length;
  return {
    uniqueWords: all.length,
    wordsSeenToday,
    wordsMastered: mastered.length,
    sentencesMastered,
  };
}

export function getProgressSnapshot(_mode?: 'listen' | 'speak' | 'write'): GlobalStats {
  return getGlobalStats();
}

export function getTodayProgress(): { wordsSeenToday: number; reviewsDone: number } {
  const stats = getGlobalStats();
  return {
    wordsSeenToday: stats.wordsSeenToday,
    reviewsDone: stats.wordsSeenToday,
  };
}
