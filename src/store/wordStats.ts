/**
 * Word stats store: tokenize, index, mastery. Persist via IndexedDB or localStorage.
 *
 * Word mastery algorithm: A word is mastered when (1) at least one sentence that
 * contains it is mastered (see sentenceMastery), and (2) totalSeenCount >= MIN_WORD_SEEN.
 * So words derive from sentence mastery plus exposure; vocabulary stats and "mastered
 * words" counts use this.
 */

import type { Sentence, WordStats } from '@/types';
import { getSentence } from './sentences';
import { getSentenceMasteryStatus } from './sentenceMastery';
import * as db from './db';

const STORAGE_KEY = 'shadowflow-word-stats';
const MIN_WORD_SEEN = 3;

const wordStatsMap = new Map<string, WordStats>();

/** Retain accents; split on spaces and punctuation only. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as WordStats[];
    if (Array.isArray(parsed)) {
      wordStatsMap.clear();
      parsed.forEach((w) => wordStatsMap.set(w.id, w));
    }
  } catch (_) {}
}

function save(): void {
  try {
    const arr = Array.from(wordStatsMap.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (_) {}
}

export async function initFromDB(): Promise<void> {
  try {
    const data = await db.getAll<WordStats>('wordStats');
    wordStatsMap.clear();
    if (Array.isArray(data)) {
      data.forEach((w) => wordStatsMap.set(w.id, w));
    }
  } catch (_) {}
}

export function initFromLocalStorage(): void {
  load();
}

export function buildWordIndex(sentences: Sentence[]): void {
  const byWord = new Map<string, { sentenceIds: Set<string> }>();
  for (const s of sentences) {
    const words = tokenize(s.french);
    for (const w of words) {
      if (!byWord.has(w)) byWord.set(w, { sentenceIds: new Set() });
      byWord.get(w)!.sentenceIds.add(s.id);
    }
  }
  const toPut: WordStats[] = [];
  for (const [text, data] of byWord) {
    const id = text;
    const existing = wordStatsMap.get(id);
    const entry: WordStats = {
      id,
      text,
      sentenceIds: [...data.sentenceIds],
      totalSeenCount: existing?.totalSeenCount ?? 0,
      lastSeenAt: existing?.lastSeenAt,
      isMastered: existing?.isMastered ?? false,
    };
    wordStatsMap.set(id, entry);
    toPut.push(entry);
  }
  if (db.getUseIndexedDB() && toPut.length > 0) {
    db.putMany('wordStats', toPut).catch(() => {});
  } else if (toPut.length > 0) {
    save();
  }
}

/** Merge worker-produced word index entries with existing stats and persist. */
export function applyWordIndexEntries(entries: { id: string; text: string; sentenceIds: string[] }[]): void {
  const toPut: WordStats[] = [];
  for (const e of entries) {
    const existing = wordStatsMap.get(e.id);
    const sentenceIds = existing?.sentenceIds ?? [];
    const merged = new Set([...sentenceIds, ...e.sentenceIds]);
    const entry: WordStats = {
      id: e.id,
      text: e.text,
      sentenceIds: [...merged],
      totalSeenCount: existing?.totalSeenCount ?? 0,
      lastSeenAt: existing?.lastSeenAt,
      isMastered: existing?.isMastered ?? false,
    };
    wordStatsMap.set(e.id, entry);
    toPut.push(entry);
  }
  if (db.getUseIndexedDB() && toPut.length > 0) {
    db.putMany('wordStats', toPut).catch(() => {});
  } else if (toPut.length > 0) {
    save();
  }
}

/** Merge entries with existing and return full WordStats[] for transaction put. */
export function mergeWordIndexEntriesToStats(entries: { id: string; text: string; sentenceIds: string[] }[]): WordStats[] {
  const result: WordStats[] = [];
  for (const e of entries) {
    const existing = wordStatsMap.get(e.id);
    const sentenceIds = existing?.sentenceIds ?? [];
    const merged = new Set([...sentenceIds, ...e.sentenceIds]);
    result.push({
      id: e.id,
      text: e.text,
      sentenceIds: [...merged],
      totalSeenCount: existing?.totalSeenCount ?? 0,
      lastSeenAt: existing?.lastSeenAt,
      isMastered: existing?.isMastered ?? false,
    });
  }
  return result;
}

/** Append word stats to in-memory map only (after transaction put). */
export function appendWordStatsToMemory(entries: { id: string; text: string; sentenceIds: string[] }[]): void {
  for (const e of entries) {
    const existing = wordStatsMap.get(e.id);
    const sentenceIds = existing?.sentenceIds ?? [];
    const merged = new Set([...sentenceIds, ...e.sentenceIds]);
    wordStatsMap.set(e.id, {
      id: e.id,
      text: e.text,
      sentenceIds: [...merged],
      totalSeenCount: existing?.totalSeenCount ?? 0,
      lastSeenAt: existing?.lastSeenAt,
      isMastered: existing?.isMastered ?? false,
    });
  }
}

/** Set isMastered when any linked sentence is mastered and totalSeenCount >= MIN_WORD_SEEN. */
function recomputeWordMastery(wordId: string): void {
  const w = wordStatsMap.get(wordId);
  if (!w) return;
  const anyLinkedMastered = (w.sentenceIds ?? []).some((sid) => getSentenceMasteryStatus(sid));
  const isMastered = anyLinkedMastered && w.totalSeenCount >= MIN_WORD_SEEN;
  if (w.isMastered === isMastered) return;
  w.isMastered = isMastered;
  if (isMastered) w.lastSeenAt = new Date().toISOString().slice(0, 10);
  if (db.getUseIndexedDB()) {
    db.put('wordStats', wordId, w).catch(() => {});
  } else {
    save();
  }
}

/** Recompute mastery for all words in a sentence (e.g. when sentence becomes mastered). */
export function recomputeWordMasteryForSentence(sentenceId: string): void {
  const sentence = getSentence(sentenceId);
  if (!sentence) return;
  const words = tokenize(sentence.french);
  for (const w of words) recomputeWordMastery(w);
}

export function updateWordStats(sentenceId: string, _mode: 'listen' | 'speak' | 'write'): void {
  const sentence = getSentence(sentenceId);
  if (!sentence) return;
  const words = tokenize(sentence.french);
  const today = new Date().toISOString().slice(0, 10);
  for (const w of words) {
    const id = w;
    const existing = wordStatsMap.get(id);
    const sentenceIds = existing?.sentenceIds ?? [];
    if (!sentenceIds.includes(sentenceId)) sentenceIds.push(sentenceId);
    const entry: WordStats = {
      id,
      text: w,
      sentenceIds,
      totalSeenCount: (existing?.totalSeenCount ?? 0) + 1,
      lastSeenAt: today,
      isMastered: existing?.isMastered ?? false,
    };
    wordStatsMap.set(id, entry);
    if (db.getUseIndexedDB()) {
      db.put('wordStats', id, entry).catch(() => {});
    }
  }
  for (const w of words) recomputeWordMastery(w);
  if (!db.getUseIndexedDB()) save();
}

export function getWordStats(): WordStats[] {
  return Array.from(wordStatsMap.values());
}

export function getMasteredWords(): WordStats[] {
  return Array.from(wordStatsMap.values()).filter((w) => w.isMastered);
}

export function setWordMastered(wordId: string, mastered: boolean): void {
  const w = wordStatsMap.get(wordId);
  if (w) {
    w.isMastered = mastered;
    if (mastered) w.lastSeenAt = new Date().toISOString().slice(0, 10);
    if (db.getUseIndexedDB()) {
      db.put('wordStats', wordId, w).catch(() => {});
    } else {
      save();
    }
  }
}

/** Clear in-memory word stats (used by reset/delete before reload). */
export function clearWordStatsInMemory(): void {
  wordStatsMap.clear();
}

/** Remove deleted sentence IDs from word stats; remove words that end up with no sentences (cascade when sentences are deleted). */
export async function pruneWordStatsBySentenceIds(sentenceIds: Set<string>): Promise<void> {
  const toRemove: string[] = [];
  const toUpdate: WordStats[] = [];
  for (const w of wordStatsMap.values()) {
    const ids = (w.sentenceIds ?? []).filter((id) => !sentenceIds.has(id));
    if (ids.length === 0) toRemove.push(w.id);
    else if (ids.length !== (w.sentenceIds ?? []).length) {
      w.sentenceIds = ids;
      toUpdate.push(w);
    }
  }
  for (const id of toRemove) wordStatsMap.delete(id);
  for (const w of toUpdate) wordStatsMap.set(w.id, w);
  if (db.getUseIndexedDB() && (toRemove.length > 0 || toUpdate.length > 0)) {
    await Promise.all([
      ...toRemove.map((id) => db.deleteKey('wordStats', id)),
      ...toUpdate.map((w) => db.put('wordStats', w.id, w)),
    ]);
  } else if (toRemove.length > 0 || toUpdate.length > 0) {
    save();
  }
}
