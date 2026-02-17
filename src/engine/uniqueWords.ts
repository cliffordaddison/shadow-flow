/**
 * Unique word tracker: tokenize French only (s.french), optional stopwords, milestones.
 * English (s.english) is never counted. Uses masteredSentenceIds (from wordStats/sentenceMastery).
 */

import type { UniqueWordsStats, Sentence } from '@/types';

export const MILESTONES = [100, 300, 500, 1000, 2000, 3000, 5000, 10000];

const FRENCH_STOPWORDS = new Set(
  [
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'est', 'en', 'au', 'aux',
    'ce', 'cette', 'ces', 'son', 'sa', 'ses', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
    'notre', 'nos', 'votre', 'vos', 'leur', 'leurs', 'qui', 'que', 'quoi', 'dont',
    'où', 'à', 'pour', 'dans', 'sur', 'avec', 'sans', 'sous', 'par', 'chez', 'vers',
    'mais', 'ou', 'donc', 'or', 'ni', 'car', 'ne', 'pas', 'plus', 'tout', 'tous',
    'toute', 'toutes', 'autre', 'autres', 'même', 'mêmes', 'être', 'avoir', 'faire',
    'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'je', 'tu', 'cest', 'il y a',
  ].map((w) => w.toLowerCase())
);

export function tokenizeFrench(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function filterStopwords(words: string[], excludeStopwords: boolean = true): string[] {
  if (!excludeStopwords) return words;
  return words.filter((w) => !FRENCH_STOPWORDS.has(w));
}

export function getUniqueWordsFromMastered(
  sentences: Sentence[],
  masteredSentenceIds: Set<string>,
  excludeStopwords: boolean = true
): Set<string> {
  const unique = new Set<string>();
  for (const s of sentences) {
    if (!masteredSentenceIds.has(s.id)) continue;
    const words = tokenizeFrench(s.french);
    filterStopwords(words, excludeStopwords).forEach((w) => unique.add(w));
  }
  return unique;
}

export function checkMilestone(count: number): number | null {
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    if (count >= MILESTONES[i]) return MILESTONES[i];
  }
  return null;
}

export function getNextMilestone(count: number): number {
  for (const m of MILESTONES) {
    if (count < m) return m;
  }
  return MILESTONES.at(-1) ?? MILESTONES[0];
}

function categorizeWords(words: Set<string>): Record<string, number> {
  const byCategory: Record<string, number> = { short: 0, medium: 0, long: 0 };
  words.forEach((w) => {
    if (w.length <= 4) byCategory.short++;
    else if (w.length <= 8) byCategory.medium++;
    else byCategory.long++;
  });
  return byCategory;
}

export function getWordFrequency(
  sentences: Sentence[],
  masteredSentenceIds: Set<string>,
  excludeStopwords: boolean = true
): Map<string, number> {
  const freq = new Map<string, number>();
  for (const s of sentences) {
    if (!masteredSentenceIds.has(s.id)) continue;
    const words = filterStopwords(tokenizeFrench(s.french), excludeStopwords);
    words.forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1));
  }
  return freq;
}

export function wordDifficulty(word: string, freq: Map<string, number>): number {
  const count = freq.get(word) ?? 0;
  const maxFreq = Math.max(1, ...freq.values());
  const rarity = 1 - count / maxFreq;
  return Math.round((word.length / 10) * 50 + rarity * 50);
}

export function getVocabularyGrowthData(
  sentences: Sentence[],
  masteredSentenceIds: Set<string>,
  excludeStopwords: boolean = true,
  days: number = 30
): Array<{ date: string; count: number }> {
  const unique = getUniqueWordsFromMastered(sentences, masteredSentenceIds, excludeStopwords);
  const total = unique.size;
  const result: Array<{ date: string; count: number }> = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    result.push({ date: dateStr, count: total });
  }
  return result;
}

export function trackUniqueWords(
  sentences: Sentence[],
  masteredSentenceIds: Set<string>,
  excludeStopwords: boolean = true
): UniqueWordsStats {
  const unique = getUniqueWordsFromMastered(sentences, masteredSentenceIds, excludeStopwords);
  const total = unique.size;
  const milestoneReached = checkMilestone(total);
  const nextMilestone = getNextMilestone(total);
  getWordFrequency(sentences, masteredSentenceIds, excludeStopwords);
  const recentWords = Array.from(unique).slice(-10).reverse();
  const growthData = getVocabularyGrowthData(sentences, masteredSentenceIds, excludeStopwords, 30);
  return {
    totalUniqueWords: total,
    byCategory: categorizeWords(unique),
    milestoneReached: milestoneReached ?? null,
    nextMilestone,
    wordsThisWeek: total,
    recentWords: recentWords.length ? recentWords : undefined,
    growthData,
  };
}
