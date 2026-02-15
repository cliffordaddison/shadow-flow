/**
 * Sentence library: list sentences, import Excel, file categorization, delete with cascade.
 */

import { useState, useCallback, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { getAllSentences, getProgressMap, getSentenceIdsByFileId, removeSentencesByFileId } from '@/store/sentences';
import { getAllFileMetadata, addFileMetadata, removeFileMetadata, setFileCategory, type FileCategory, type FileMetadata } from '@/store/files';
import { removeCourse, getLessonsForCourse, getLesson } from '@/store/courses';
import { removeReviewStatesBySentenceIds } from '@/store/reviewStates';
import { removeSentenceMasteryBySentenceIds } from '@/store/sentenceMastery';
import { pruneWordStatsBySentenceIds } from '@/store/wordStats';
import { parseExcelFile, persistExcelImport } from '@/engine/excelImport';
import { MASTERY_LEVEL_NAMES } from '@/types';

const CATEGORIES: (FileCategory | 'All')[] = ['All', 'Lessons', 'Conversations', 'Grammar', 'Vocabulary'];

function FileCard({
  file,
  isOpen,
  fileSentences,
  progressMap,
  onToggle,
  onCategoryChange,
  onDelete,
  refresh,
}: Readonly<{
  file: FileMetadata;
  isOpen: boolean;
  fileSentences: { id: string; english: string; french: string }[];
  progressMap: Map<string, { speakingLevel: number }>;
  onToggle: () => void;
  onCategoryChange: (fileId: string, category: FileCategory) => void;
  onDelete: (fileId: string, name: string) => void;
  refresh: () => void;
}>) {
  const sentenceCount = fileSentences.length;
  return (
    <div
      style={{
        background: 'var(--sf-bg-card)',
        border: '1px solid var(--sf-border)',
        borderRadius: 12,
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          cursor: 'pointer',
          width: '100%',
          border: 'none',
          background: 'transparent',
          textAlign: 'left',
        }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--sf-primary)' }}>folder_open</span>
          <div>
            <div style={{ fontWeight: 600 }}>{file.name}</div>
            <div style={{ fontSize: 12, color: 'var(--sf-text-dim)' }}>
              {file.sentenceCount} sentences · {file.sheetNames.join(', ')} · {new Date(file.uploadedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={file.category}
            onChange={(e) => {
              onCategoryChange(file.id, e.target.value as FileCategory);
              refresh();
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--sf-border)',
              background: 'var(--sf-bg-elevated)',
              color: 'var(--sf-text)',
              fontSize: 12,
            }}
          >
            {CATEGORIES.filter((c) => c !== 'All').map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(file.id, file.name);
            }}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--sf-error)',
              color: 'white',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Delete
          </button>
        </div>
      </button>
      {isOpen && (
        <div style={{ padding: '0 16px 12px', borderTop: '1px solid var(--sf-border)' }}>
          {fileSentences.slice(0, 20).map((s) => {
            const p = progressMap.get(s.id);
            const levelName = p ? MASTERY_LEVEL_NAMES[p.speakingLevel] ?? 'New' : 'New';
            return (
              <div
                key={s.id}
                style={{
                  padding: '10px 0',
                  borderBottom: '1px solid var(--sf-border-muted)',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{s.english}</div>
                <div style={{ color: 'var(--sf-text-muted)', marginBottom: 4 }}>{s.french}</div>
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'var(--sf-bg-elevated)',
                    color: 'var(--sf-text-muted)',
                    marginRight: 8,
                  }}
                >
                  {levelName}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: 'rgba(19,91,236,0.15)',
                    color: 'var(--sf-primary)',
                  }}
                >
                  {file.category}
                </span>
              </div>
            );
          })}
          {sentenceCount > 20 && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--sf-text-dim)' }}>
              +{sentenceCount - 20} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function SentenceLibrary() {
  const { setLearningView } = useStore();
  const [sentences, setSentences] = useState(getAllSentences());
  const [fileList, setFileList] = useState(getAllFileMetadata());
  const [categoryFilter, setCategoryFilter] = useState<FileCategory | 'All'>('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ count: number; errors: string[]; filename?: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ fileId: string; name: string } | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const progressMap = getProgressMap();

  const refresh = useCallback(() => {
    setSentences(getAllSentences());
    setFileList(getAllFileMetadata());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !/\.(xlsx|xls)$/i.test(file.name)) {
      setError('Please select an Excel file (.xlsx or .xls).');
      return;
    }
    setError(null);
    setImportResult(null);
    setLoading(true);
    setImportStatus(`Importing ${file.name}…`);
    try {
      const buf = await file.arrayBuffer();
      const baseId = `excel-${Date.now()}`;
      const result = parseExcelFile(buf, baseId, file.name);
      const { sentences: newSentences, errors } = result;
      await persistExcelImport(result);
      addFileMetadata(
        result.course.id,
        file.name,
        result.lessons.map((l) => l.name),
        result.sentences.length
      );
      setImportResult({ count: newSentences.length, errors, filename: file.name });
      setImportStatus(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setImportStatus(null);
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const handleDeleteFile = useCallback((fileId: string, name: string) => {
    setDeleteConfirm({ fileId, name });
  }, []);

  const setCurrentCourseId = useStore((s) => s.setCurrentCourseId);
  const setCurrentLessonId = useStore((s) => s.setCurrentLessonId);
  const clearListenRepeatStateForLessonIds = useStore((s) => s.clearListenRepeatStateForLessonIds);

  const toggleExpandedFile = useCallback((fileId: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    const fileId = deleteConfirm.fileId;
    const lessonIds = getLessonsForCourse(fileId).map((l) => l.id);
    const sentenceIds = new Set(getSentenceIdsByFileId(fileId));
    await removeReviewStatesBySentenceIds(sentenceIds);
    removeSentenceMasteryBySentenceIds(sentenceIds);
    await pruneWordStatsBySentenceIds(sentenceIds);
    await removeSentencesByFileId(fileId);
    await removeCourse(fileId);
    removeFileMetadata(fileId);
    clearListenRepeatStateForLessonIds(lessonIds);
    if (useStore.getState().currentCourseId === fileId) {
      setCurrentCourseId(null);
      setCurrentLessonId(null);
    }
    setDeleteConfirm(null);
    refresh();
  }, [deleteConfirm, refresh, setCurrentCourseId, setCurrentLessonId, clearListenRepeatStateForLessonIds]);

  const filteredSentences = search.trim()
    ? sentences.filter(
        (s) =>
          s.english.toLowerCase().includes(search.toLowerCase()) ||
          s.french.toLowerCase().includes(search.toLowerCase()) ||
          (getLesson(s.lessonId)?.name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : sentences;
  const getFileForSentence = (s: { sourceFileId?: string }) =>
    s.sourceFileId ? fileList.find((f) => f.id === s.sourceFileId) : null;

  return (
    <main style={{ flex: 1, overflow: 'auto', background: 'var(--sf-bg)', padding: 24 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Sentence Library</h2>
          <button
            type="button"
            onClick={() => setLearningView('dashboard')}
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              border: '1px solid var(--sf-border)',
              background: 'var(--sf-bg-elevated)',
              color: 'var(--sf-text)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Back to Dashboard
          </button>
        </div>

        <div
          style={{
            background: 'var(--sf-bg-card)',
            border: '1px solid var(--sf-border)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Import Excel</h3>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--sf-text-muted)' }}>
            Upload an Excel file with French in column A and English in column B. Multiple sheets = multiple lessons.
          </p>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 20px',
              background: 'var(--sf-primary)',
              color: 'white',
              borderRadius: 10,
              cursor: loading ? 'wait' : 'pointer',
              fontWeight: 600,
            }}
          >
            <span className="material-symbols-outlined">upload_file</span>
            {loading ? 'Importing…' : 'Choose Excel file'}
            <input type="file" accept=".xlsx,.xls" onChange={onFileSelect} style={{ display: 'none' }} disabled={loading} />
          </label>
          {importStatus && <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--sf-text-muted)' }}>{importStatus}</p>}
          {error && <p style={{ margin: '12px 0 0', color: 'var(--sf-error)', fontSize: 14 }}>{error}</p>}
          {importResult && (
            <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--sf-text-muted)' }}>
              Imported {importResult.count} sentences{importResult.filename ? ` from ${importResult.filename}` : ''}.
              {importResult.errors.length > 0 && ` ${importResult.errors.length} row(s) had issues.`}
            </p>
          )}
        </div>

        <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sf-text-muted)' }}>Category:</span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid var(--sf-border)',
                background: categoryFilter === cat ? 'var(--sf-primary)' : 'var(--sf-bg-elevated)',
                color: categoryFilter === cat ? 'white' : 'var(--sf-text-muted)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="Search by lesson name or sentence…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            maxWidth: 400,
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid var(--sf-border)',
            background: 'var(--sf-bg-elevated)',
            color: 'var(--sf-text)',
            fontSize: 14,
            marginBottom: 20,
          }}
        />

        {fileList.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Files by category</h3>
            {(categoryFilter === 'All' ? CATEGORIES.filter((c) => c !== 'All') : [categoryFilter]).map((cat) => {
              const filesInCat = fileList.filter((f) => f.category === cat);
              if (filesInCat.length === 0 && categoryFilter !== 'All') return null;
              if (filesInCat.length === 0) return null;
              return (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: 'var(--sf-text-muted)', textTransform: 'uppercase' }}>
                    {cat}
                  </h4>
                  {filesInCat.map((f) => (
                    <FileCard
                      key={f.id}
                      file={f}
                      isOpen={expandedFiles.has(f.id)}
                      fileSentences={sentences.filter((s) => s.sourceFileId === f.id)}
                      progressMap={progressMap}
                      onToggle={() => toggleExpandedFile(f.id)}
                      onCategoryChange={setFileCategory}
                      onDelete={handleDeleteFile}
                      refresh={refresh}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}

        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>
          Sentences ({filteredSentences.length}){search ? ' (filtered)' : ''}
        </h3>
        <div style={{ maxHeight: 400, overflow: 'auto', border: '1px solid var(--sf-border)', borderRadius: 12 }}>
          {filteredSentences.length === 0 ? (
            <p style={{ padding: 24, color: 'var(--sf-text-muted)', textAlign: 'center' }}>
              {search ? 'No sentences match your search.' : 'No sentences yet. Import an Excel file above.'}
            </p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {filteredSentences.slice(0, 200).map((s) => {
                const p = progressMap.get(s.id);
                const levelName = p ? MASTERY_LEVEL_NAMES[p.speakingLevel] ?? 'New' : 'New';
                const fileMeta = getFileForSentence(s);
                return (
                  <li
                    key={s.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--sf-border)',
                      fontSize: 14,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{s.english}</div>
                    <div style={{ color: 'var(--sf-text-muted)', marginBottom: 4 }}>{s.french}</div>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'var(--sf-bg-elevated)',
                        color: 'var(--sf-text-muted)',
                        marginRight: 8,
                      }}
                    >
                      {levelName}
                    </span>
                    {fileMeta && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'rgba(19,91,236,0.15)',
                          color: 'var(--sf-primary)',
                        }}
                      >
                        {fileMeta.category}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {filteredSentences.length > 200 && (
            <p style={{ padding: 12, textAlign: 'center', color: 'var(--sf-text-muted)', fontSize: 13 }}>
              Showing first 200 of {filteredSentences.length}
            </p>
          )}
        </div>
      </div>

      {deleteConfirm && (
        <dialog
          open
          aria-labelledby="delete-dialog-title"
          aria-modal
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 24,
            width: '100%',
            height: '100%',
            margin: 0,
            border: 'none',
          }}
        >
          <button
            type="button"
            aria-label="Close dialog"
            onClick={() => setDeleteConfirm(null)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              background: 'var(--sf-bg-card)',
              border: '1px solid var(--sf-border)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 400,
            }}
          >
            <h3 id="delete-dialog-title" style={{ margin: '0 0 12px' }}>Delete file?</h3>
            <p style={{ margin: '0 0 20px', color: 'var(--sf-text-muted)', fontSize: 14 }}>
              &quot;{deleteConfirm.name}&quot; and all its sentences will be removed. Progress for those sentences will be lost. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: '1px solid var(--sf-border)',
                  background: 'var(--sf-bg-elevated)',
                  color: 'var(--sf-text)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                style={{
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'var(--sf-error)',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </dialog>
      )}
    </main>
  );
}
