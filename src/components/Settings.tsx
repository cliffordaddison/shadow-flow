/**
 * Settings modal: Learning (SRS & Phases), Data Management (reset/backup), theme, TTS voice, etc.
 */

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { saveSettings } from '@/store/settings';
import { getDataStats, resetAllData, resetProgressOnly, deleteAllFiles, exportData, importData } from '@/store/reset';
import { isWebSpeechSynthesisSupported, isWebSpeechRecognitionSupported } from '@/utils/browserCompat';
import type { AppSettings } from '@/types';
import { defaultLearningSettings } from '@/types';
import { LessonPicker } from '@/components/LessonPicker';

export function Settings() {
  const { settings, setSettings, setSettingsOpen } = useStore();
  const learn = settings.learning ?? defaultLearningSettings;
  const stats = getDataStats();
  const [resetConfirm, setResetConfirm] = useState<'none' | 'all' | 'progress' | 'files'>('none');
  const [resetCheckbox, setResetCheckbox] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleSave = () => {
    saveSettings(settings);
    setSettingsOpen(false);
  };

  const inputStyle: React.CSSProperties = {
    padding: '12px 14px',
    borderRadius: 10,
    border: '1px solid var(--sf-border)',
    background: 'var(--sf-bg-elevated)',
    color: 'var(--sf-text)',
    fontSize: 16,
    minWidth: 0,
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 0',
    borderBottom: '1px solid var(--sf-border)',
  };

  return (
    <dialog
      open
      aria-labelledby="settings-title"
      aria-modal
      className="settings-backdrop"
      style={{ border: 'none', margin: 0, padding: 0, width: '100%', maxWidth: 'none', height: '100%', maxHeight: 'none' }}
      onClick={() => setSettingsOpen(false)}
      onKeyDown={(e) => e.key === 'Escape' && setSettingsOpen(false)}
    >
      <div className="settings-modal" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <header className="settings-header">
          <h2 id="settings-title" style={{ margin: 0, fontSize: 'clamp(1.125rem, 4vw, 1.25rem)', fontWeight: 700, color: 'var(--sf-text)' }}>
            Settings
          </h2>
          <div className="settings-header-actions">
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="settings-btn settings-btn-secondary"
            >
              Cancel
            </button>
            <button type="button" onClick={handleSave} className="settings-btn settings-btn-primary">
              Save
            </button>
          </div>
        </header>

        <div className="settings-body">
          <section className="settings-section">
            <h3 className="settings-section-title">
              <span className="material-symbols-outlined" style={{ color: 'var(--sf-primary)' }}>school</span>
              {' '}
              Learning
            </h3>
            <div className="settings-card">
              <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--sf-text-muted)' }}>
                Choose the lesson used for Listen &amp; Repeat, Speaking, and Writing.
              </p>
              <LessonPicker />
            </div>
            <div className="settings-card">
              <label style={rowStyle}>
                <span className="settings-label">TTS speed</span>
                <input
                  type="number"
                  min={0.75}
                  max={1.5}
                  step={0.05}
                  value={learn.ttsSpeed}
                  onChange={(e) =>
                    setSettings((s: AppSettings) => ({
                      ...s,
                      learning: { ...(s.learning ?? defaultLearningSettings), ttsSpeed: Number(e.target.value) },
                    }))
                  }
                  style={{ ...inputStyle, width: 88 }}
                />
              </label>
              <label style={{ ...rowStyle, borderBottom: 'none' }}>
                <span className="settings-label">Similarity threshold (%)</span>
                <input
                  type="number"
                  min={75}
                  max={95}
                  step={5}
                  value={learn.similarityThreshold}
                  onChange={(e) =>
                    setSettings((s: AppSettings) => ({
                      ...s,
                      learning: { ...(s.learning ?? defaultLearningSettings), similarityThreshold: Number(e.target.value) },
                    }))
                  }
                  style={{ ...inputStyle, width: 88 }}
                />
              </label>
            </div>
            <div className="settings-card">
              <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--sf-text-muted)' }}>
                TTS and STT use the Web Speech API. Chrome or Edge recommended for best results. On phones, TTS quality depends on the device—if it sounds robotic, try adjusting TTS speed or use a different browser.
              </p>
              {(!isWebSpeechSynthesisSupported() || !isWebSpeechRecognitionSupported()) && (
                <p style={{ margin: '8px 0 0', padding: 0, fontSize: 12, color: 'var(--sf-warning)' }}>
                  {!isWebSpeechSynthesisSupported() && !isWebSpeechRecognitionSupported() && 'Web Speech TTS and recognition are not supported in this browser.'}
                  {isWebSpeechSynthesisSupported() && !isWebSpeechRecognitionSupported() && 'Web Speech recognition is not supported in this browser.'}
                  {!isWebSpeechSynthesisSupported() && isWebSpeechRecognitionSupported() && 'Web Speech TTS is not supported in this browser.'}
                </p>
              )}
            </div>
            <div className="settings-card">
              <p style={{ margin: 0, fontSize: 13, color: 'var(--sf-text-muted)' }}>
                <strong>How progress works:</strong> A sentence is mastered after you rate it Good/Easy enough times (or use Skip). Words become mastered when their sentences are mastered. Complete Listen &amp; Repeat, then Speaking/Writing (or skip) for each sentence to finish a lesson. You must finish the current lesson before switching to another.
              </p>
            </div>
            <div className="settings-card">
              <label style={rowStyle}>
                <span className="settings-label">Exposure TTS repeat (1–10)</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={learn.exposureRepeatCount}
                  onChange={(e) =>
                    setSettings((s: AppSettings) => ({
                      ...s,
                      learning: { ...(s.learning ?? defaultLearningSettings), exposureRepeatCount: Number(e.target.value) },
                    }))
                  }
                  style={{ ...inputStyle, width: 88 }}
                />
              </label>
              <label style={rowStyle}>
                <span className="settings-label">Max speaking attempts</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={learn.maxSpeakingAttempts}
                  onChange={(e) =>
                    setSettings((s: AppSettings) => ({
                      ...s,
                      learning: { ...(s.learning ?? defaultLearningSettings), maxSpeakingAttempts: Number(e.target.value) },
                    }))
                  }
                  style={{ ...inputStyle, width: 88 }}
                />
              </label>
              <label style={rowStyle}>
                <span className="settings-label">Daily review goal</span>
                <input
                  type="number"
                  min={5}
                  max={50}
                  step={5}
                  value={learn.dailyReviewGoal}
                  onChange={(e) =>
                    setSettings((s: AppSettings) => ({
                      ...s,
                      learning: { ...(s.learning ?? defaultLearningSettings), dailyReviewGoal: Number(e.target.value) },
                    }))
                  }
                  style={{ ...inputStyle, width: 88 }}
                />
              </label>
              <label style={rowStyle}>
                <span className="settings-label">Daily new sentences goal</span>
                <input
                  type="number"
                  min={5}
                  max={50}
                  step={5}
                  value={learn.dailyNewGoal}
                  onChange={(e) =>
                    setSettings((s: AppSettings) => ({
                      ...s,
                      learning: { ...(s.learning ?? defaultLearningSettings), dailyNewGoal: Number(e.target.value) },
                    }))
                  }
                  style={{ ...inputStyle, width: 88 }}
                />
              </label>
              <label style={rowStyle}>
                <span className="settings-label">Daily shadowing reps goal</span>
                <input
                  type="number"
                  min={100}
                  max={2000}
                  step={100}
                  value={learn.dailyShadowingRepsGoal}
                  onChange={(e) =>
                    setSettings((s: AppSettings) => ({
                      ...s,
                      learning: { ...(s.learning ?? defaultLearningSettings), dailyShadowingRepsGoal: Number(e.target.value) },
                    }))
                  }
                  style={{ ...inputStyle, width: 88 }}
                />
              </label>
              <label style={{ ...rowStyle, borderBottom: 'none', gap: 12 }}>
                <input
                  type="checkbox"
                  checked={learn.passivePlaylistEnabled}
                  onChange={(e) =>
                    setSettings((s: AppSettings) => ({
                      ...s,
                      learning: { ...(s.learning ?? defaultLearningSettings), passivePlaylistEnabled: e.target.checked },
                    }))
                  }
                  style={{ accentColor: 'var(--sf-primary)', width: 20, height: 20, flexShrink: 0 }}
                />
                <span className="settings-label" style={{ flex: 1 }}>Enable passive audio playlist</span>
              </label>
              <label style={{ ...rowStyle, borderBottom: 'none', gap: 12 }}>
                <span className="settings-label" style={{ flex: 1 }}>Accent sensitivity (100 = strict)</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={learn.accentInsensitive ? 0 : 100}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setSettings((s: AppSettings) => ({
                      ...s,
                      learning: { ...(s.learning ?? defaultLearningSettings), accentInsensitive: v < 50 },
                    }));
                  }}
                  style={{ width: 120, accentColor: 'var(--sf-primary)' }}
                  aria-label="Accent sensitivity"
                />
              </label>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">
              <span className="material-symbols-outlined" style={{ color: 'var(--sf-primary)' }}>shortcut</span>
              Shortcuts
            </h3>
            <div className="settings-card settings-shortcuts">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--sf-border)' }}>
                <span className="settings-label">Help</span>
                <kbd className="settings-kbd">?</kbd>
              </div>
              <div style={{ padding: '12px 0', fontSize: 13, color: 'var(--sf-text-muted)' }}>
                Active Speaking: <kbd className="settings-kbd">R</kbd> Record, <kbd className="settings-kbd">Space</kbd> Next
              </div>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">
              <span className="material-symbols-outlined" style={{ color: 'var(--sf-primary)' }}>backup</span>
              {' '}
              Backup &amp; Restore
            </h3>
            <div className="settings-card">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '12px 16px' }}>
                <button
                  type="button"
                  onClick={exportData}
                  className="settings-btn settings-btn-secondary"
                >
                  Export backup
                </button>
                <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                  <span className="settings-btn settings-btn-secondary" style={{ marginRight: 0 }}>
                    Import backup
                  </span>
                  <input
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      setImportError(null);
                      const err = await importData(file);
                      if (err) setImportError(err);
                    }}
                  />
                </label>
              </div>
              {importError && <p style={{ padding: '0 16px 12px', margin: 0, color: 'var(--sf-error)', fontSize: 13 }}>{importError}</p>}
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">
              <span className="material-symbols-outlined" style={{ color: 'var(--sf-error)' }}>warning</span>
              Data Management
            </h3>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--sf-primary)' }}>
              Your progress is saved in this browser.
            </p>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--sf-text-muted)' }}>
              {stats.sentenceCount} sentences, {stats.fileCount} files, ~{stats.uniqueWordsLearned} mastered.
            </p>
            <div className="settings-card" style={{ borderColor: 'var(--sf-error)', background: 'rgba(239,68,68,0.05)' }}>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setResetConfirm('progress')}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: '1px solid var(--sf-border)',
                    background: 'var(--sf-bg-elevated)',
                    color: 'var(--sf-text)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  Clear progress only
                </button>
                <button
                  type="button"
                  onClick={() => setResetConfirm('files')}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: '1px solid var(--sf-warning)',
                    background: 'rgba(245,158,11,0.1)',
                    color: 'var(--sf-warning)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  Delete all files
                </button>
                <button
                  type="button"
                  onClick={() => setResetConfirm('all')}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'var(--sf-error)',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  Reset all data
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {resetConfirm !== 'none' && (
        <dialog
          open
          aria-modal
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 110,
            padding: 24,
            border: 'none',
            width: '100%',
            maxWidth: 'none',
            height: '100%',
            maxHeight: 'none',
            margin: 0,
          }}
          onClick={() => { setResetConfirm('none'); setResetCheckbox(false); }}
          onKeyDown={(e) => e.key === 'Escape' && (setResetConfirm('none'), setResetCheckbox(false))}
        >
          <div
            role="document"
            style={{
              background: 'var(--sf-bg-card)',
              border: '1px solid var(--sf-border)',
              borderRadius: 16,
              padding: 24,
              maxWidth: 400,
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px' }}>
              {resetConfirm === 'all' && 'Reset all data?'}
              {resetConfirm === 'progress' && 'Clear progress only?'}
              {resetConfirm === 'files' && 'Delete all files?'}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--sf-text-muted)' }}>
              {resetConfirm === 'all' && 'All sentences, progress, files, and settings will be removed. This cannot be undone.'}
              {resetConfirm === 'progress' && 'SRS progress will be cleared. Sentences and files stay.'}
              {resetConfirm === 'files' && 'All imported files and sentences will be removed. Progress will be cleared.'}
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={resetCheckbox}
                onChange={(e) => setResetCheckbox(e.target.checked)}
                style={{ accentColor: 'var(--sf-primary)', width: 18, height: 18 }}
              />
              <span className="settings-label">I understand this cannot be undone</span>
            </label>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setResetConfirm('none'); setResetCheckbox(false); }}
                className="settings-btn settings-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!resetCheckbox}
                onClick={() => {
                  if (!resetCheckbox) return;
                  if (resetConfirm === 'all') resetAllData();
                  else if (resetConfirm === 'progress') resetProgressOnly();
                  else if (resetConfirm === 'files') deleteAllFiles();
                  setResetConfirm('none');
                  setResetCheckbox(false);
                }}
                className="settings-btn"
                style={{ background: 'var(--sf-error)', color: 'white' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </dialog>
      )}
    </dialog>
  );
}
