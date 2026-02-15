/**
 * Excel parsing only: no store dependencies. Used by main thread and worker.
 */

import * as XLSX from 'xlsx';
import type { Course, Lesson, Sentence, ReviewState } from '@/types';

export interface ExcelImportResult {
  course: Course;
  lessons: Lesson[];
  sentences: Sentence[];
  reviewStates: ReviewState[];
  errors: string[];
}

const FR_COL = 0;
const ENG_COL = 1;

/** Strip .xlsx / .xls from filename for display name. */
function stripExtension(name: string): string {
  if (!name) return name;
  return name.replace(/\.xlsx?$/i, '').trim() || name;
}

function cellValue(sheet: XLSX.WorkSheet, r: number, c: number): string {
  const cell = sheet[XLSX.utils.encode_cell({ r, c })];
  const v = cell?.w ?? cell?.v;
  if (v == null) return '';
  return String(v).trim();
}

function parseSheet(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  courseId: string,
  lessonId: string,
  _order: number,
  fileId: string
): { sentences: Sentence[]; errors: string[] } {
  const sentences: Sentence[] = [];
  const errors: string[] = [];
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
  const now = Date.now();
  for (let r = 0; r <= range.e.r; r++) {
    const fr = cellValue(sheet, r, FR_COL);
    const eng = cellValue(sheet, r, ENG_COL);
    if (!fr && !eng) continue;
    if (!fr) {
      errors.push(`Sheet "${sheetName}" row ${r + 1}: missing French (column A)`);
      continue;
    }
    if (!eng) {
      errors.push(`Sheet "${sheetName}" row ${r + 1}: missing English (column B)`);
      continue;
    }
    const id = `${courseId}-${sheetName}-${r}`.replace(/\s/g, '_');
    sentences.push({
      id,
      lessonId,
      index: r,
      french: fr,
      english: eng,
      sourceFileId: fileId,
      createdAt: now,
    });
  }
  return { sentences, errors };
}

/**
 * Parse Excel file. Each sheet = one Lesson. All lessons unlocked so user can choose any lesson.
 * Creates ReviewState for each sentence × 3 modes.
 * Optional onSheetProgress(sheetIndex, totalSheets) for progress (1-based sheetIndex).
 */
export function parseExcelFile(
  data: ArrayBuffer,
  baseId: string = `excel-${Date.now()}`,
  filename: string = '',
  onSheetProgress?: (sheetIndex: number, totalSheets: number) => void
): ExcelImportResult {
  const workbook = XLSX.read(data, { type: 'array' });
  const fileId = baseId;
  const courseId = baseId;
  const now = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const course: Course = {
    id: courseId,
    name: stripExtension(filename) || `Import ${today}`,
    createdAt: now,
    lessons: [],
  };

  const lessons: Lesson[] = [];
  const allSentences: Sentence[] = [];
  const allErrors: string[] = [];

  const totalSheets = workbook.SheetNames.length;
  workbook.SheetNames.forEach((sheetName, sheetIndex) => {
    onSheetProgress?.(sheetIndex + 1, totalSheets);

    const lessonId = `${courseId}-${sheetName}`.replace(/\s/g, '_');
    const { sentences, errors } = parseSheet(
      workbook.Sheets[sheetName],
      sheetName,
      courseId,
      lessonId,
      sheetIndex,
      fileId
    );
    allSentences.push(...sentences);
    allErrors.push(...errors);

    const isUnlocked = true;
    const lesson: Lesson = {
      id: lessonId,
      courseId,
      name: sheetName,
      order: sheetIndex,
      sentenceIds: sentences.map((s) => s.id),
      isUnlocked,
    };
    lessons.push(lesson);
    course.lessons.push({
      id: lessonId,
      name: sheetName,
      order: sheetIndex,
      isUnlocked,
    });
  });

  course.lessons.sort((a, b) => a.order - b.order);

  return {
    course,
    lessons,
    sentences: allSentences,
    reviewStates: [], // Lazy: created on first access in reviewStates.getReviewState
    errors: allErrors,
  };
}
