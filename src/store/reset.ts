/**
 * Data reset and backup: reset all, clear progress, export/import.
 */

import { getAllSentences } from './sentences';
import { getAllFileMetadata } from './files';
import { getGlobalStats } from '@/engine/metrics';
import type { Sentence } from '@/types';
import * as db from './db';
import * as courses from './courses';
import * as sentences from './sentences';
import * as reviewStates from './reviewStates';
import * as wordStats from './wordStats';
import * as sentenceMastery from './sentenceMastery';
import * as files from './files';
import { useStore } from './useStore';

const SENTENCES_KEY = 'shadowflow-sentences';
const REVIEW_STATES_KEY = 'shadowflow-review-states';
const WORD_STATS_KEY = 'shadowflow-word-stats';
const SENTENCE_MASTERY_KEY = 'shadowflow-sentence-mastery';
const COURSES_KEY = 'shadowflow-courses';
const LESSONS_KEY = 'shadowflow-lessons';
const FILE_METADATA_KEY = 'shadowflow-file-metadata';
const VERSION_KEY = 'shadowflow-data-version';

const IDB_STORE_NAMES: db.StoreName[] = ['courses', 'lessons', 'sentences', 'reviewStates', 'wordStats'];

export interface DataStats {
  sentenceCount: number;
  fileCount: number;
  uniqueWordsLearned: number;
}

export function getDataStats(): DataStats {
  const sentences = getAllSentences();
  const files = getAllFileMetadata();
  const stats = getGlobalStats();
  return {
    sentenceCount: sentences.length,
    fileCount: files.length,
    uniqueWordsLearned: stats.wordsMastered,
  };
}

/** Internal: clear all stores and in-memory caches. Caller is responsible for reload. */
async function clearAllStoresAndMemory(): Promise<void> {
  if (db.getUseIndexedDB()) {
    const database = await db.openDB();
    if (database) {
      for (const storeName of IDB_STORE_NAMES) {
        await db.clearStore(storeName);
      }
    }
    courses.clearCoursesAndLessonsInMemory();
    sentences.clearSentencesInMemory();
    reviewStates.clearReviewStatesInMemory();
    wordStats.clearWordStatsInMemory();
    sentenceMastery.clearSentenceMasteryInMemory();
    files.clearFileMetadataInMemory();
  }
  localStorage.removeItem(SENTENCES_KEY);
  localStorage.removeItem(REVIEW_STATES_KEY);
  localStorage.removeItem(WORD_STATS_KEY);
  localStorage.removeItem(SENTENCE_MASTERY_KEY);
  localStorage.removeItem(COURSES_KEY);
  localStorage.removeItem(LESSONS_KEY);
  localStorage.removeItem(FILE_METADATA_KEY);
  localStorage.removeItem(VERSION_KEY);
  useStore.getState().resetTrainingState();
}

/** Clear all app data from localStorage and, when using IndexedDB, from IDB and in-memory caches. */
export async function resetAllData(): Promise<void> {
  try {
    await clearAllStoresAndMemory();
  } catch (err) {
    console.error('resetAllData failed', err);
  } finally {
    globalThis.location.reload();
  }
}

/** Clear progress only; keep sentences, courses, lessons, file metadata. */
export async function resetProgressOnly(): Promise<void> {
  try {
    if (db.getUseIndexedDB()) {
      const database = await db.openDB();
      if (database) {
        await db.clearStore('reviewStates');
        await db.clearStore('wordStats');
      }
      reviewStates.clearReviewStatesInMemory();
      wordStats.clearWordStatsInMemory();
      sentenceMastery.clearSentenceMasteryInMemory();
    }
    localStorage.setItem(REVIEW_STATES_KEY, '[]');
    localStorage.setItem(WORD_STATS_KEY, '[]');
    localStorage.setItem(SENTENCE_MASTERY_KEY, '[]');
  } catch (err) {
    console.error('resetProgressOnly failed', err);
  } finally {
    globalThis.location.reload();
  }
}

/** Remove all sentences, progress, courses, lessons, file metadata. */
export async function deleteAllFiles(): Promise<void> {
  try {
    await clearAllStoresAndMemory();
  } catch (err) {
    console.error('deleteAllFiles failed', err);
  } finally {
    globalThis.location.reload();
  }
}

export interface ExportPayload {
  version: number;
  exportedAt: string;
  sentences: Sentence[];
  fileMetadata: ReturnType<typeof getAllFileMetadata>;
}

/** Export data as JSON and trigger download. */
export function exportData(): void {
  const sentences = getAllSentences();
  const fileMetadata = getAllFileMetadata();
  const payload: ExportPayload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    sentences,
    fileMetadata,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shadowflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Restore from backup JSON. Returns error message or null on success. Reloads page on success. */
export async function importData(file: File): Promise<string | null> {
  try {
    const raw = await file.text();
    const payload = JSON.parse(raw) as ExportPayload;
    if (!payload.sentences || !Array.isArray(payload.sentences)) {
      return 'Invalid backup: missing sentences array';
    }
    localStorage.setItem(SENTENCES_KEY, JSON.stringify(payload.sentences));
    if (payload.fileMetadata && Array.isArray(payload.fileMetadata)) {
      localStorage.setItem(FILE_METADATA_KEY, JSON.stringify(payload.fileMetadata));
    }
    globalThis.location.reload();
    return null;
  } catch (e) {
    if (e instanceof Error) return e.message;
    return 'Invalid backup file';
  }
}
