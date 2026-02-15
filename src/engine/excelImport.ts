/**
 * Excel import: batched persistence, chunked processing, performance tracking.
 * Re-exports parseExcelFile from excelParse (worker uses excelParse directly).
 */

import type { Sentence } from '@/types';
import { addCourse, addLesson, appendCourseAndLessonsToMemory, removeCourse } from '@/store/courses';
import { addSentences, appendSentencesToMemory, getSentenceIdsByFileId, removeSentencesByFileId } from '@/store/sentences';
import { appendReviewStatesToMemory, removeReviewStatesBySentenceIds, setReviewStatesBatchAsync } from '@/store/reviewStates';
import { removeSentenceMasteryBySentenceIds } from '@/store/sentenceMastery';
import {
  applyWordIndexEntries,
  appendWordStatsToMemory,
  mergeWordIndexEntriesToStats,
  pruneWordStatsBySentenceIds,
} from '@/store/wordStats';
import * as db from '@/store/db';
import { stripCourseNameExtension } from '@/store/files';
import type { ExcelImportResult } from './excelParse';

export type { ExcelImportResult } from './excelParse';

export interface PersistProgress {
  stage: string;
  current: number;
  total: number;
  percentage: number;
}

export interface PersistOptions {
  skipWordIndex?: boolean;
}

const REVIEW_STATE_CHUNK_SIZE = 1000;
const WORD_INDEX_CHUNK_SIZE = 200;

export { parseExcelFile } from './excelParse';

async function persistInChunks<T>(
  items: T[],
  persistFn: (chunk: T[]) => Promise<void>,
  chunkSize: number,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const total = items.length;
  for (let i = 0; i < total; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await persistFn(chunk);
    onProgress?.(Math.min(i + chunk.length, total), total);
  }
}

function isQuotaExceeded(err: unknown): boolean {
  const name = err instanceof Error ? err.name : String(err);
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Chunked main-thread word index (fallback when worker unavailable). Yields with requestIdleCallback/setTimeout. */
async function buildWordIndexChunked(
  sentences: Sentence[],
  onProgress?: (current: number, total: number, percentage: number) => void
): Promise<{ id: string; text: string; sentenceIds: string[] }[]> {
  const byWord = new Map<string, Set<string>>();
  const total = sentences.length;
  for (let i = 0; i < total; i += WORD_INDEX_CHUNK_SIZE) {
    const chunk = sentences.slice(i, i + WORD_INDEX_CHUNK_SIZE);
    for (const s of chunk) {
      const words = tokenize(s.french);
      for (const w of words) {
        if (!byWord.has(w)) byWord.set(w, new Set());
        byWord.get(w)!.add(s.id);
      }
    }
    const current = Math.min(i + WORD_INDEX_CHUNK_SIZE, total);
    onProgress?.(current, total, total > 0 ? (current / total) * 100 : 0);
    await new Promise<void>((r) => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => r(), { timeout: 50 });
      } else {
        setTimeout(r, 0);
      }
    });
  }
  return Array.from(byWord.entries()).map(([text, sentenceIds]) => ({
    id: text,
    text,
    sentenceIds: Array.from(sentenceIds),
  }));
}

/** Build word index async: try worker first, then chunked main-thread fallback. */
async function buildWordIndexAsync(
  sentences: Sentence[],
  onProgress?: (progress: PersistProgress) => void
): Promise<{ id: string; text: string; sentenceIds: string[] }[]> {
  const report = (stage: string, current: number, total: number, percentage: number) => {
    onProgress?.({ stage, current, total, percentage });
  };
  if (sentences.length === 0) return [];

  try {
    const worker = new Worker(new URL('@/workers/wordIndexWorker.ts', import.meta.url), {
      type: 'module',
    });
    return await new Promise((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<{ type: string; entries?: { id: string; text: string; sentenceIds: string[] }[]; current?: number; total?: number; percentage?: number; message?: string }>) => {
        const msg = e.data;
        if (msg.type === 'progress' && msg.current != null && msg.total != null) {
          report('Building word index...', msg.current, msg.total, msg.percentage ?? 0);
        } else if (msg.type === 'result' && msg.entries) {
          worker.terminate();
          resolve(msg.entries);
        } else if (msg.type === 'error') {
          worker.terminate();
          reject(new Error(msg.message ?? 'Word index failed'));
        }
      };
      worker.onerror = () => {
        worker.terminate();
        reject(new Error('Word index worker failed'));
      };
      worker.postMessage({ sentences });
    });
  } catch {
    return buildWordIndexChunked(sentences, (current, total, percentage) => {
      report('Building word index...', current, total, percentage);
    });
  }
}

/**
 * Persist import result: single transaction when IndexedDB; else batched + cleanup on failure.
 * Lazy review states: no bulk review state creation (getReviewState creates on first access).
 * Reduced mode (skipWordIndex): skips word indexing.
 */
export async function persistExcelImport(
  result: ExcelImportResult,
  onProgress?: (progress: PersistProgress) => void,
  options?: PersistOptions
): Promise<void> {
  const report = (stage: string, current: number, total: number, percentage: number) => {
    onProgress?.({ stage, current, total, percentage });
  };
  const skipWordIndex = options?.skipWordIndex ?? false;
  const courseId = result.course.id;
  const courseToPersist = {
    ...result.course,
    name: stripCourseNameExtension(result.course.name),
  };

  performance.mark('excel-persist-start');

  try {
    if (db.getUseIndexedDB()) {
      report('Building word index...', 0, 1, 5);
      const wordIndexEntries = skipWordIndex
        ? []
        : await buildWordIndexAsync(result.sentences, (p) =>
            report(p.stage, p.current, p.total, 5 + (p.percentage / 100) * 35)
          );
      const wordStatsForTx =
        wordIndexEntries.length > 0 ? mergeWordIndexEntriesToStats(wordIndexEntries) : [];

      report('Saving to database...', 0, 1, 45);
      await db.runTransaction(
        ['courses', 'lessons', 'sentences', 'reviewStates', 'wordStats'],
        (tx) => {
          tx.put('courses', courseToPersist.id, courseToPersist);
          for (const l of result.lessons) {
            tx.put('lessons', l.id, l);
          }
          if (result.sentences.length > 0) {
            tx.putMany('sentences', result.sentences);
          }
          if (result.reviewStates.length > 0) {
            tx.putMany('reviewStates', result.reviewStates);
          }
          if (wordStatsForTx.length > 0) {
            tx.putMany('wordStats', wordStatsForTx);
          }
        }
      );

      appendCourseAndLessonsToMemory(result.course, result.lessons);
      appendSentencesToMemory(result.sentences);
      if (result.reviewStates.length > 0) {
        appendReviewStatesToMemory(result.reviewStates);
      }
      if (wordIndexEntries.length > 0) {
        appendWordStatsToMemory(wordIndexEntries);
      }
    } else {
      report('Saving course and lessons...', 0, 5, 5);
      addCourse(courseToPersist);
      for (const l of result.lessons) {
        addLesson(l);
      }
      report('Saving sentences...', 1, 5, 25);
      addSentences(result.sentences);

      if (result.reviewStates.length > 0) {
        const reviewTotal = result.reviewStates.length;
        report('Creating review states...', 0, reviewTotal, 40);
        await persistInChunks(
          result.reviewStates,
          async (chunk) => setReviewStatesBatchAsync(chunk),
          REVIEW_STATE_CHUNK_SIZE,
          (current, total) =>
            report('Creating review states...', current, total, 40 + (current / total) * 35)
        );
      }

      if (!skipWordIndex) {
        report('Building word index...', 0, 1, 80);
        const wordIndexEntries = await buildWordIndexAsync(result.sentences, (p) =>
          report(p.stage, p.current, p.total, 80 + (p.percentage / 100) * 15)
        );
        if (wordIndexEntries.length > 0) {
          applyWordIndexEntries(wordIndexEntries);
        }
      }
    }

    report('Finalizing import...', 1, 1, 100);
    performance.mark('excel-persist-end');
    performance.measure('excel-persist', 'excel-persist-start', 'excel-persist-end');
  } catch (err) {
    performance.mark('excel-persist-end');
    if (!db.getUseIndexedDB()) {
      try {
        const sentenceIds = new Set(getSentenceIdsByFileId(courseId));
        await removeReviewStatesBySentenceIds(sentenceIds);
        removeSentenceMasteryBySentenceIds(sentenceIds);
        await pruneWordStatsBySentenceIds(sentenceIds);
        await removeSentencesByFileId(courseId);
        await removeCourse(courseId);
      } catch {
        // Ignore cleanup errors when removing course on failure
      }
    }
    if (isQuotaExceeded(err)) {
      throw new Error(
        'Storage quota exceeded. Try removing old courses or use reduced mode (skip word index) to import with less data.'
      );
    }
    throw err;
  }
}
