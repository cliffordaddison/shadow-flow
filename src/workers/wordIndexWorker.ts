/**
 * Web Worker: build word index from sentences in chunks. Posts progress and result.
 * Output: array of { id, text, sentenceIds } for main thread to merge with existing and persist.
 */

import type { Sentence } from '@/types';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export type WordIndexEntry = { id: string; text: string; sentenceIds: string[] };

export type WordIndexProgress = {
  type: 'progress';
  current: number;
  total: number;
  percentage: number;
};

export type WordIndexResult = {
  type: 'result';
  entries: WordIndexEntry[];
};

export type WordIndexError = {
  type: 'error';
  message: string;
};

const CHUNK_SIZE = 200;

interface WorkerScope {
  postMessage(data: unknown): void;
  onmessage: ((e: MessageEvent) => void) | null;
}
const ctx = globalThis as unknown as WorkerScope;

ctx.onmessage = (e: MessageEvent<{ sentences: Sentence[] }>) => {
  const { sentences } = e.data;
  try {
    const byWord = new Map<string, Set<string>>();
    const total = sentences.length;
    for (let i = 0; i < total; i++) {
      const s = sentences[i];
      const words = tokenize(s.french);
      for (const w of words) {
        if (!byWord.has(w)) byWord.set(w, new Set());
        byWord.get(w)!.add(s.id);
      }
      if ((i + 1) % CHUNK_SIZE === 0 || i === total - 1) {
        const percentage = total > 0 ? ((i + 1) / total) * 100 : 0;
        ctx.postMessage({
          type: 'progress',
          current: i + 1,
          total,
          percentage,
        } satisfies WordIndexProgress);
      }
    }
    const entries: WordIndexEntry[] = Array.from(byWord.entries()).map(([text, sentenceIds]) => ({
      id: text,
      text,
      sentenceIds: Array.from(sentenceIds),
    }));
    ctx.postMessage({ type: 'result', entries } satisfies WordIndexResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ type: 'error', message } satisfies WordIndexError);
  }
};
