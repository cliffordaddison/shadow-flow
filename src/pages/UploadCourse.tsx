import { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrainingNavbar } from '@/components/layout/TrainingNavbar';
import { parseExcelFile, persistExcelImport, type ExcelImportResult, type PersistProgress } from '@/engine/excelImport';
import { addFileMetadata, getAllFileMetadata, stripCourseNameExtension } from '@/store/files';
import { useStore } from '@/store/useStore';

type ProgressState = { stage: string; current: number; total: number; percentage: number } | null;

export function UploadCourse() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const navigate = useNavigate();
  const [preview, setPreview] = useState<ExcelImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [recoverableError, setRecoverableError] = useState<string | null>(null);
  const [reducedMode, setReducedMode] = useState(false);
  const fileCount = getAllFileMetadata().length;
  const setCurrentCourseId = useStore((s) => s.setCurrentCourseId);
  const setCurrentLessonId = useStore((s) => s.setCurrentLessonId);

  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL('@/workers/excelWorker.ts', import.meta.url),
        { type: 'module' }
      );
    } catch {
      workerRef.current = null;
    }
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const UPLOAD_NAVBAR_METRICS = [
    { label: 'Courses', value: String(fileCount), valueClass: 'text-primary', desc: 'Imported courses.' },
    { label: 'Last import', value: '—', valueClass: 'text-emerald-600 dark:text-emerald-400', desc: 'Most recent upload.' },
  ];

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    setRecoverableError(null);
    setPreview(null);
    setProgress(null);
    if (!file) return;

    setProgress({ stage: 'Parsing Excel file...', current: 0, total: 1, percentage: 0 });

    const baseId = `excel-${Date.now()}`;

    const onResult = (result: ExcelImportResult) => {
      setProgress(null);
      setPreview(result);
    };

    const onParseError = (message: string) => {
      setProgress(null);
      setError(message);
    };

    const bufferPromise = file.arrayBuffer().catch((err) => {
      throw err instanceof Error ? err : new Error(String(err));
    });

    if (workerRef.current) {
      const worker = workerRef.current;
      const onMessage = (ev: MessageEvent<{ type: string; result?: ExcelImportResult; message?: string; stage?: string; current?: number; total?: number; percentage?: number }>) => {
        const msg = ev.data;
        if (msg.type === 'progress' && msg.stage != null && msg.percentage != null) {
          setProgress({
            stage: msg.stage,
            current: msg.current ?? 0,
            total: msg.total ?? 1,
            percentage: msg.percentage,
          });
        } else if (msg.type === 'result' && msg.result) {
          worker.removeEventListener('message', onMessage);
          onResult(msg.result);
        } else if (msg.type === 'error') {
          worker.removeEventListener('message', onMessage);
          onParseError(msg.message ?? 'Parse failed');
        }
      };
      worker.addEventListener('message', onMessage);
      bufferPromise.then((data) => {
        worker.postMessage({ data, baseId, filename: file.name });
      }).catch((err) => {
        worker.removeEventListener('message', onMessage);
        setProgress(null);
        setError(err instanceof Error ? err.message : 'Failed to read file');
      });
    } else {
      bufferPromise.then((data) => {
        try {
          const result = parseExcelFile(data, baseId, file.name, (sheetIndex, totalSheets) => {
            setProgress({
              stage: 'Parsing Excel file...',
              current: sheetIndex,
              total: totalSheets,
              percentage: totalSheets > 0 ? (sheetIndex / totalSheets) * 20 : 0,
            });
          });
          setProgress(null);
          setPreview(result);
        } catch (err) {
          setProgress(null);
          setError(err instanceof Error ? err.message : 'Failed to parse file');
        }
      }).catch((err) => {
        setProgress(null);
        setError(err instanceof Error ? err.message : 'Failed to read file');
      });
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!preview || isImporting) return;
    setError(null);
    setRecoverableError(null);
    setIsImporting(true);
    setProgress({ stage: 'Starting...', current: 0, total: 1, percentage: 0 });

    try {
      await persistExcelImport(
        preview,
        (p: PersistProgress) => {
          setProgress({ stage: p.stage, current: p.current, total: p.total, percentage: p.percentage });
        },
        { skipWordIndex: reducedMode }
      );
      addFileMetadata(
        preview.course.id,
        stripCourseNameExtension(preview.course.name),
        preview.lessons.map((l) => l.name),
        preview.sentences.length
      );
      setCurrentCourseId(preview.course.id);
      const firstLesson = preview.lessons[0];
      if (firstLesson) setCurrentLessonId(firstLesson.id);
      setProgress(null);
      navigate('/listen');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRecoverableError(message);
      setError(message);
      setProgress(null);
    } finally {
      setIsImporting(false);
    }
  }, [preview, isImporting, reducedMode, navigate, setCurrentCourseId, setCurrentLessonId]);

  const clearPreview = useCallback(() => {
    setPreview(null);
    setError(null);
    setRecoverableError(null);
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const isBusy = progress !== null || isImporting;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TrainingNavbar
        modeIcon="cloud_upload"
        modeLabel="Upload File"
        navbarMetrics={UPLOAD_NAVBAR_METRICS}
        allMetrics={UPLOAD_NAVBAR_METRICS}
        progressButtonLabel="Courses"
      />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-10">
          <header className="mb-10">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Upload Excel Course
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400 text-lg">
              Import your curriculum from a spreadsheet.
            </p>
          </header>

          <div className="mb-8 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400">
                <span className="material-symbols-outlined">table_chart</span>
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                  File Preparation Guide
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Your .xlsx file must be formatted correctly: Column A = French, Column B = English.
                </p>
              </div>
            </div>
          </div>

          <div className={`relative group mb-12 ${isBusy ? 'pointer-events-none opacity-70' : ''}`}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              disabled={isBusy}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
              aria-label="Select Excel file"
            />
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-6 py-20 transition-all group-hover:border-primary group-hover:bg-blue-50/50 dark:group-hover:bg-slate-800/50">
              <div className="size-20 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-primary mb-2 group-hover:scale-110 transition-transform duration-300">
                <span className="material-symbols-outlined text-4xl">cloud_upload</span>
              </div>
              <div className="text-center space-y-1">
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  Drag & drop your file here
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Supported format: .xlsx</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-lg shadow-sm group-hover:border-primary group-hover:text-primary transition-colors cursor-pointer"
              >
                Select File
              </button>
            </div>
          </div>

          {progress !== null && (
            <div className="mb-6 p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {progress.stage}
              </p>
              <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(100, progress.percentage)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {progress.total > 0 ? `${progress.current} / ${progress.total}` : ''} — {Math.round(progress.percentage)}%
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300">
              {error}
              {recoverableError && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setError(null); setRecoverableError(null); handleImport(); }}
                    className="px-3 py-1.5 text-sm font-bold bg-red-100 dark:bg-red-900/40 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}

          {preview && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-end justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Import Preview</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {preview.sentences.length} sentences in {preview.lessons.length} sheet(s).
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold uppercase tracking-wider">
                  <span className="size-2 rounded-full bg-green-500 animate-pulse" />
                  {' '}
                  Ready to Import
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-lg">
                <div className="p-6 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-lg bg-green-600 text-white flex items-center justify-center">
                      <span className="material-symbols-outlined">description</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white">{stripCourseNameExtension(preview.course.name)}</h4>
                      <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                        <span>{preview.lessons.length} Sheets</span>
                        <span className="size-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <span>{preview.sentences.length} Sentences</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearPreview}
                    disabled={isImporting}
                    className="flex items-center justify-center size-9 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50"
                    title="Remove File"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {preview.lessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center size-8 rounded bg-primary/10 text-primary">
                          <span className="material-symbols-outlined text-lg">tab</span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{lesson.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {lesson.sentenceIds.length} sentences
                          </p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-green-500">check_circle</span>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                  <label className="flex items-center gap-3 mb-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reducedMode}
                      onChange={(e) => setReducedMode(e.target.checked)}
                      disabled={isImporting}
                      className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      Reduced mode (skip word index) — faster import, less storage; word stats can be built later.
                    </span>
                  </label>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={clearPreview}
                      disabled={isImporting}
                      className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleImport}
                      disabled={isImporting}
                      className="px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-lg">publish</span>
                      {isImporting ? 'Importing...' : 'Import Course'}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
          <div className="h-20" />
        </div>
      </div>
    </div>
  );
}
