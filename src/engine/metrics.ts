/**
 * Progress metrics: global stats, mode snapshot, mode-specific daily stats.
 * Daily stats stored in localStorage: shadowflow-listen-today, shadowflow-speak-today, shadowflow-write-today.
 */

import type { GlobalStats } from '@/types';
import { getWordStats, getMasteredWords } from '@/store/wordStats';
import { getMasteredSentences } from '@/store/sentenceMastery';

const LISTEN_TODAY_KEY = 'shadowflow-listen-today';
const SPEAK_TODAY_KEY = 'shadowflow-speak-today';
const WRITE_TODAY_KEY = 'shadowflow-write-today';

type DailyEntry = { date: string; sentenceIds: string[]; wordIds: string[] };

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadDaily(key: string): DailyEntry {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { date: getToday(), sentenceIds: [], wordIds: [] };
    const parsed = JSON.parse(raw) as DailyEntry;
    const today = getToday();
    if (parsed.date !== today) return { date: today, sentenceIds: [], wordIds: [] };
    return {
      date: parsed.date,
      sentenceIds: Array.isArray(parsed.sentenceIds) ? parsed.sentenceIds : [],
      wordIds: Array.isArray(parsed.wordIds) ? parsed.wordIds : [],
    };
  } catch {
    return { date: getToday(), sentenceIds: [], wordIds: [] };
  }
}

function saveDaily(key: string, entry: DailyEntry): void {
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

export function getListenStats(): number {
  const entry = loadDaily(LISTEN_TODAY_KEY);
  return entry.sentenceIds.length;
}

export function getSpeakingStats(): number {
  const entry = loadDaily(SPEAK_TODAY_KEY);
  return entry.wordIds.length;
}

export function getWritingStats(): number {
  const entry = loadDaily(WRITE_TODAY_KEY);
  return entry.wordIds.length;
}

export function addListenSentenceToday(sentenceId: string): void {
  const entry = loadDaily(LISTEN_TODAY_KEY);
  if (!entry.sentenceIds.includes(sentenceId)) {
    entry.sentenceIds.push(sentenceId);
    saveDaily(LISTEN_TODAY_KEY, entry);
  }
}

export function addSpeakWordsToday(wordIds: string[]): void {
  const entry = loadDaily(SPEAK_TODAY_KEY);
  const set = new Set(entry.wordIds);
  for (const id of wordIds) set.add(id);
  entry.wordIds = [...set];
  saveDaily(SPEAK_TODAY_KEY, entry);
}

export function addWriteWordsToday(wordIds: string[]): void {
  const entry = loadDaily(WRITE_TODAY_KEY);
  const set = new Set(entry.wordIds);
  for (const id of wordIds) set.add(id);
  entry.wordIds = [...set];
  saveDaily(WRITE_TODAY_KEY, entry);
}

export function getGlobalStats(): GlobalStats {
  const all = getWordStats();
  const mastered = getMasteredWords();
  const today = getToday();
  const wordsSeenToday = all.filter((w) => w.lastSeenAt === today).length;
  const sentencesMastered = getMasteredSentences().length;
  return {
    uniqueWords: all.length,
    wordsSeenToday,
    wordsMastered: mastered.length,
    sentencesMastered,
  };
}

export function getProgressSnapshot(mode?: 'listen' | 'speak' | 'write'): GlobalStats {
  const all = getWordStats();
  const mastered = getMasteredWords();
  const sentencesMastered = getMasteredSentences().length;
  const today = getToday();
  let wordsSeenToday: number;
  if (mode === 'listen') wordsSeenToday = getListenStats();
  else if (mode === 'speak') wordsSeenToday = getSpeakingStats();
  else if (mode === 'write') wordsSeenToday = getWritingStats();
  else wordsSeenToday = all.filter((w) => w.lastSeenAt === today).length;
  return {
    uniqueWords: all.length,
    wordsSeenToday,
    wordsMastered: mastered.length,
    sentencesMastered,
  };
}

export function getTodayProgress(): { wordsSeenToday: number; reviewsDone: number } {
  const stats = getGlobalStats();
  return {
    wordsSeenToday: stats.wordsSeenToday,
    reviewsDone: stats.wordsSeenToday,
  };
}
