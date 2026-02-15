/**
 * Review state store: per-sentence, per-mode (listen/speak/write). SM-2 style.
 * Lazy: default state created on first access; persisted only when modified.
 */

import type { ReviewState, ReviewMode } from '@/types';
import * as db from './db';

const STORAGE_KEY = 'shadowflow-review-states';

const stateMap = new Map<string, ReviewState>();

const today = (): string => new Date().toISOString().slice(0, 10);

function key(sentenceId: string, mode: ReviewMode): string {
  return `${sentenceId}:${mode}`;
}

function defaultState(sentenceId: string, mode: ReviewMode): ReviewState {
  return {
    sentenceId,
    mode,
    interval: 0,
    due: today(),
    ease: 2.5,
    repetitions: 0,
    lapses: 0,
  };
}

function load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as ReviewState[];
    if (Array.isArray(parsed)) {
      stateMap.clear();
      parsed.forEach((s) => stateMap.set(key(s.sentenceId, s.mode), s));
    }
  } catch (_) {}
}

function save(): void {
  try {
    const arr = Array.from(stateMap.values());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (_) {}
}

export async function initFromDB(): Promise<void> {
  try {
    const data = await db.getAll<ReviewState>('reviewStates');
    stateMap.clear();
    if (Array.isArray(data)) {
      data.forEach((s) => stateMap.set(key(s.sentenceId, s.mode), s));
    }
  } catch (_) {}
}

export function initFromLocalStorage(): void {
  load();
}

/** Append review states to in-memory map only (after transaction put). */
export function appendReviewStatesToMemory(states: ReviewState[]): void {
  for (const s of states) {
    stateMap.set(key(s.sentenceId, s.mode), { ...s });
  }
}

export function getReviewState(sentenceId: string, mode: ReviewMode): ReviewState {
  const k = key(sentenceId, mode);
  const existing = stateMap.get(k);
  if (existing != null) return existing;
  const def = defaultState(sentenceId, mode);
  stateMap.set(k, def);
  return def;
}

export function setReviewState(state: ReviewState): void {
  stateMap.set(key(state.sentenceId, state.mode), { ...state });
  if (db.getUseIndexedDB()) {
    db.put('reviewStates', [state.sentenceId, state.mode], state).catch(() => {});
  } else {
    save();
  }
}

export function setReviewStatesBatch(states: ReviewState[]): void {
  for (const s of states) {
    stateMap.set(key(s.sentenceId, s.mode), { ...s });
  }
  if (db.getUseIndexedDB() && states.length > 0) {
    db.putMany('reviewStates', states).catch(() => {});
  } else if (states.length > 0) {
    save();
  }
}

export async function setReviewStatesBatchAsync(states: ReviewState[]): Promise<void> {
  for (const s of states) {
    stateMap.set(key(s.sentenceId, s.mode), { ...s });
  }
  if (db.getUseIndexedDB() && states.length > 0) {
    await db.putMany('reviewStates', states);
  } else if (states.length > 0) {
    save();
  }
}

export function getReviewStatesForSentence(sentenceId: string): ReviewState[] {
  const modes: ReviewMode[] = ['listen', 'speak', 'write'];
  return modes.map((mode) => getReviewState(sentenceId, mode));
}

export function getDueReviews(mode: ReviewMode, limit?: number): ReviewState[] {
  const now = new Date().toISOString().slice(0, 10);
  const due = Array.from(stateMap.values()).filter(
    (s) => s.mode === mode && s.due <= now
  );
  due.sort((a, b) => a.due.localeCompare(b.due));
  return limit ? due.slice(0, limit) : due;
}

export function getNewSentences(mode: ReviewMode, _limit?: number): string[] {
  const sentenceIds = new Set<string>();
  for (const s of stateMap.values()) {
    if (s.mode === mode) sentenceIds.add(s.sentenceId);
  }
  return []; // Caller must intersect with sentence list; we don't have sentence store here
}

/** Clear in-memory review states (used by reset/delete before reload). */
export function clearReviewStatesInMemory(): void {
  stateMap.clear();
}

/** Remove all review states for the given sentence IDs (cascade when sentences are deleted). */
export async function removeReviewStatesBySentenceIds(sentenceIds: Set<string>): Promise<void> {
  const toDelete: [string, ReviewMode][] = [];
  for (const state of stateMap.values()) {
    if (sentenceIds.has(state.sentenceId)) toDelete.push([state.sentenceId, state.mode]);
  }
  for (const [sentenceId, mode] of toDelete) {
    stateMap.delete(key(sentenceId, mode));
  }
  if (db.getUseIndexedDB() && toDelete.length > 0) {
    await Promise.all(
      toDelete.map(([sentenceId, mode]) => db.deleteKey('reviewStates', [sentenceId, mode]))
    );
  } else if (toDelete.length > 0) {
    save();
  }
}
