import { useState, useEffect, useRef } from 'react';
import { TrainingNavbar } from '@/components/layout/TrainingNavbar';
import { getAllFileMetadata, removeFileMetadata } from '@/store/files';
import { getSentenceIdsByFileId, removeSentencesByFileId } from '@/store/sentences';
import { removeCourse, getLessonsForCourse } from '@/store/courses';
import { removeReviewStatesBySentenceIds } from '@/store/reviewStates';
import { removeSentenceMasteryBySentenceIds } from '@/store/sentenceMastery';
import { pruneWordStatsBySentenceIds } from '@/store/wordStats';
import { resetAllData, resetProgressOnly } from '@/store/reset';
import { useStore } from '@/store/useStore';
import { saveSettings } from '@/store/settings';
import type { LearningSettings } from '@/types';
import { LessonPicker } from '@/components/LessonPicker';

export function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [localLearning, setLocalLearning] = useState<LearningSettings>(settings.learning);
  const [saved, setSaved] = useState(false);
  const [filesRefresh, setFilesRefresh] = useState(0);
  const files = getAllFileMetadata();
  const speedValueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setLocalLearning(settings.learning);
  }, [settings.learning]);

  const SETTINGS_NAVBAR_METRICS = [
    { label: 'Courses', value: String(files.length), valueClass: 'text-primary', desc: 'Imported courses.' },
  ];

  const handleSave = () => {
    setSettings((prev) => ({ ...prev, learning: localLearning }));
    saveSettings({ ...settings, learning: localLearning });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const setCurrentCourseId = useStore((s) => s.setCurrentCourseId);
  const setCurrentLessonId = useStore((s) => s.setCurrentLessonId);
  const clearListenRepeatStateForLessonIds = useStore((s) => s.clearListenRepeatStateForLessonIds);

  const handleResetProgressOnly = () => {
    if (!globalThis.confirm('Clear all progress (reviews, SRS) but keep courses and sentences? The app will reload.')) return;
    void resetProgressOnly();
  };

  const handleFullReset = () => {
    if (!globalThis.confirm('Clear all data: courses, sentences, and progress will be removed. This cannot be undone. The app will reload.')) return;
    void resetAllData();
  };

  const handleDeleteCourse = async (fileId: string) => {
    if (!globalThis.confirm('Delete this course and all its sentences?')) return;
    const lessonIds = getLessonsForCourse(fileId).map((l) => l.id);
    const sentenceIds = new Set(getSentenceIdsByFileId(fileId));
    await removeReviewStatesBySentenceIds(sentenceIds);
    removeSentenceMasteryBySentenceIds(sentenceIds);
    await pruneWordStatsBySentenceIds(sentenceIds);
    await removeSentencesByFileId(fileId);
    await removeCourse(fileId);
    removeFileMetadata(fileId);
    clearListenRepeatStateForLessonIds(lessonIds);
    const currentCourseId = useStore.getState().currentCourseId;
    if (currentCourseId === fileId) {
      setCurrentCourseId(null);
      setCurrentLessonId(null);
    }
    setFilesRefresh((r) => r + 1);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TrainingNavbar
        modeIcon="settings"
        modeLabel="Settings"
        navbarMetrics={SETTINGS_NAVBAR_METRICS}
        allMetrics={SETTINGS_NAVBAR_METRICS}
        progressButtonLabel="Data"
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pb-16 max-w-4xl mx-auto w-full space-y-10 sm:space-y-12">
        <section>
          <div className="mb-6 border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">school</span>
              {' '}
              Current lesson
            </h3>
            <p className="text-sm text-slate-500 mt-1">Choose the lesson used for Listen &amp; Repeat, Speaking, and Writing.</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6">
            <LessonPicker />
          </div>
        </section>

        <section>
          <div className="mb-6 border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">volume_up</span>
              {' '}
              Audio Settings
            </h3>
            <p className="text-sm text-slate-500 mt-1">Configure text-to-speech and playback.</p>
          </div>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <label htmlFor="settings-playback-speed" className="text-sm font-medium text-slate-700 dark:text-slate-300 pt-2">Playback Speed</label>
              <div className="md:col-span-2">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-medium text-slate-500 w-8 text-right">0.5</span>
                  <input
                    id="settings-playback-speed"
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={Number.isFinite(Number(localLearning.ttsSpeed)) ? localLearning.ttsSpeed : 1}
                    onChange={(e) => setLocalLearning((l) => ({ ...l, ttsSpeed: Number(e.target.value) }))}
                    className="flex-1 min-w-0 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-primary"
                    aria-label="Playback speed"
                  />
                  <span className="text-xs font-medium text-slate-500 w-8">2.0</span>
                  <span
                    ref={speedValueRef}
                    className="shrink-0 min-w-[3rem] text-sm font-semibold text-primary text-right tabular-nums"
                    aria-live="polite"
                  >
                    {Number.isFinite(Number(localLearning.ttsSpeed)) ? `${Number(localLearning.ttsSpeed).toFixed(1)}×` : '—'}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <label htmlFor="settings-default-repeats" className="text-sm font-medium text-slate-700 dark:text-slate-300 pt-2">Default Repeats</label>
              <div className="md:col-span-2 flex items-center gap-3">
                <input
                  id="settings-default-repeats"
                  type="number"
                  min={1}
                  max={10}
                  value={localLearning.exposureRepeatCount}
                  onChange={(e) => setLocalLearning((l) => ({ ...l, exposureRepeatCount: Math.max(1, Math.min(10, Number(e.target.value))) }))}
                  className="w-16 text-center border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm p-2 text-slate-900 dark:text-slate-100"
                />
                <span className="text-xs text-slate-500">times per sentence (Listen & Repeat)</span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-6 border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">timer</span>
              {' '}
              Training Settings
            </h3>
            <p className="text-sm text-slate-500 mt-1">Timing and SRS.</p>
          </div>
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 pt-2" id="settings-timing-profile-label">Timing Profile</span>
              <fieldset className="md:col-span-2 border-0 p-0 m-0" aria-labelledby="settings-timing-profile-label">
                <div className="grid grid-cols-3 gap-3">
                  {(['beginner', 'intermediate', 'advanced'] as const).map((profile) => (
                    <button
                      key={profile}
                      type="button"
                      onClick={() => setLocalLearning((l) => ({ ...l, timingProfile: profile }))}
                      className={`flex flex-col items-center justify-center p-3 border-2 rounded-xl transition-colors ${
                        (localLearning.timingProfile ?? 'intermediate') === profile
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-sm font-semibold capitalize">{profile}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <label htmlFor="settings-srs-balanced" className="text-sm font-medium text-slate-700 dark:text-slate-300 pt-2">SRS Algorithm</label>
              <div className="md:col-span-2 space-y-3" role="radiogroup">
                {(['balanced', 'aggressive', 'relaxed'] as const).map((srs) => (
                  <label
                    key={srs}
                    className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <input
                      type="radio"
                      id={srs === 'balanced' ? 'settings-srs-balanced' : undefined}
                      name="srs"
                      checked={(localLearning.srsMultiplier ?? 'balanced') === srs}
                      onChange={() => setLocalLearning((l) => ({ ...l, srsMultiplier: srs }))}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-slate-900 dark:text-white capitalize">{srs}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 sm:gap-4 pt-4">
          <button
            type="button"
            onClick={handleSave}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-blue-600 transition-colors shadow-sm shadow-blue-500/30"
          >
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>

        <section>
          <div className="mb-6 border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">restart_alt</span>
              {' '}
              Data Reset
            </h3>
            <p className="text-sm text-slate-500 mt-1">Clear cached or imported data. The app will reload after each action.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleResetProgressOnly}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Reset progress only
            </button>
            <button
              type="button"
              onClick={handleFullReset}
              className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            >
              Clear all data
            </button>
          </div>
        </section>

        <section key={filesRefresh}>
          <div className="mb-6 border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">database</span>
              {' '}
              Data Management
            </h3>
            <p className="text-sm text-slate-500 mt-1">Manage imported courses.</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Course Name</th>
                    <th className="px-6 py-3">Import Date</th>
                    <th className="px-6 py-3">Size</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {files.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{f.name}</td>
                      <td className="px-6 py-4">{new Date(f.uploadedAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4">{f.sentenceCount} sentences</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteCourse(f.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                          aria-label="Delete"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {files.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                        No courses imported yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
