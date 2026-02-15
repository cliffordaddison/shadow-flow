/**
 * Web Worker: parse Excel file off the main thread. Sends progress and result.
 */

import { parseExcelFile } from '@/engine/excelParse';

export type WorkerProgress = {
  type: 'progress';
  stage: string;
  current: number;
  total: number;
  percentage: number;
};

export type WorkerResult = {
  type: 'result';
  result: import('@/engine/excelParse').ExcelImportResult;
};

export type WorkerError = {
  type: 'error';
  message: string;
};

interface WorkerScope {
  postMessage(data: unknown): void;
  onmessage: ((e: MessageEvent) => void) | null;
}
const ctx = globalThis as unknown as WorkerScope;
ctx.onmessage = (e: MessageEvent<{ data: ArrayBuffer; baseId: string; filename: string }>) => {
  const { data, baseId, filename } = e.data;
  try {
    const result = parseExcelFile(data, baseId, filename, (sheetIndex, totalSheets) => {
      const percentage = totalSheets > 0 ? (sheetIndex / totalSheets) * 20 : 0;
      ctx.postMessage({
        type: 'progress',
        stage: 'Parsing Excel file...',
        current: sheetIndex,
        total: totalSheets,
        percentage,
      } satisfies WorkerProgress);
    });
    ctx.postMessage({ type: 'result', result } satisfies WorkerResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ type: 'error', message } satisfies WorkerError);
  }
};
