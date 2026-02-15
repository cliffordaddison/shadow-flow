/**
 * File metadata store: categories, upload date, sheet names, sentence count.
 * Cascade delete: removing a file removes associated sentences and progress.
 */

export type FileCategory = 'Lessons' | 'Conversations' | 'Grammar' | 'Vocabulary';

export interface FileMetadata {
  id: string;
  name: string;
  category: FileCategory;
  uploadedAt: number;
  sheetNames: string[];
  sentenceCount: number;
}

const STORAGE_KEY = 'shadowflow-file-metadata';

const files: FileMetadata[] = [];

function load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as FileMetadata[];
    if (Array.isArray(parsed)) {
      files.length = 0;
      files.push(...parsed);
    }
  } catch (_) {}
}

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  } catch (_) {}
}

load();

/** Clear in-memory file metadata and persist empty (used by reset/delete before reload). */
export function clearFileMetadataInMemory(): void {
  files.length = 0;
  save();
}

export function getAllFileMetadata(): FileMetadata[] {
  return [...files];
}

export function getFileMetadata(id: string): FileMetadata | undefined {
  return files.find((f) => f.id === id);
}

export function getFilesByCategory(category: FileCategory): FileMetadata[] {
  return files.filter((f) => f.category === category);
}

function inferCategoryFromSheetNames(sheetNames: string[]): FileCategory {
  const lower = sheetNames.join(' ').toLowerCase();
  if (/\b(conversation|dialogue|dialog)\b/.test(lower)) return 'Conversations';
  if (/\b(grammar|grammaire|conjugaison)\b/.test(lower)) return 'Grammar';
  if (/\b(vocab|vocabulary|vocabulaire|mots)\b/.test(lower)) return 'Vocabulary';
  return 'Lessons';
}

/** Strip .xlsx / .xls from name for display. Exported for use at import and in UI. */
export function stripCourseNameExtension(name: string): string {
  if (!name) return name;
  return name.replace(/\.xlsx?$/i, '').trim() || name;
}

export function addFileMetadata(
  id: string,
  name: string,
  sheetNames: string[],
  sentenceCount: number,
  category?: FileCategory
): FileMetadata {
  const meta: FileMetadata = {
    id,
    name: stripCourseNameExtension(name),
    category: category ?? inferCategoryFromSheetNames(sheetNames),
    uploadedAt: Date.now(),
    sheetNames: [...sheetNames],
    sentenceCount,
  };
  files.push(meta);
  save();
  return meta;
}

export function setFileCategory(fileId: string, category: FileCategory): void {
  const f = files.find((x) => x.id === fileId);
  if (f) {
    f.category = category;
    save();
  }
}

export function removeFileMetadata(fileId: string): void {
  const i = files.findIndex((f) => f.id === fileId);
  if (i >= 0) {
    files.splice(i, 1);
    save();
  }
}
