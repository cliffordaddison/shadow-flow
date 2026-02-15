/**
 * Left sidebar: Library / Recent / Favorites (working), track list, upload audio + optional transcript.
 */

import { useCallback, useState } from 'react';
import { useStore } from '@/store/useStore';
import {
  setTrack,
  getCachedTranscript,
  cacheTranscript,
  clearCachedTranscript,
  getTrackIdsForNav,
  getTrack,
} from '@/store/tracks';
import { decodeAudioFile, fileHash } from '@/engine/audioLoader';
import { buildPhrasesFromTranscript } from '@/engine/segmentation';
import { computePeaks } from '@/engine/waveform';
import type { TrackMetadata, Transcript, TranscriptSegment, WaveformPeaks } from '@/types';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Parse transcript JSON. Expects { segments: [{ text, translation?, startTime?, endTime? }] }. Uses proportional times when missing. */
function parseTranscriptJson(
  raw: string,
  trackId: string,
  durationSec: number
): Transcript | null {
  try {
    const data = JSON.parse(raw) as { segments?: Array<{ startTime?: number; endTime?: number; text: string; translation?: string }> };
    const arr = data?.segments;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const count = arr.length;
    const step = durationSec / count;
    const segments: TranscriptSegment[] = [];
    for (let i = 0; i < count; i++) {
      const s = arr[i];
      const startTime = s.startTime ?? i * step;
      const endTime = s.endTime ?? (i + 1) * step;
      segments.push({
        id: `seg-${trackId}-${i}`,
        startTime,
        endTime,
        text: String(s.text ?? ''),
        translation: s.translation == null ? undefined : String(s.translation),
      });
    }
    return { segments };
  } catch {
    return null;
  }
}

export function Library() {
  const {
    currentTrackId,
    setCurrentTrack,
    nav,
    setNav,
    settings,
    recentTrackIds,
    favoriteTrackIds,
    toggleFavorite,
    learningView,
    setLearningView,
  } = useStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcribePrompt, setTranscribePrompt] = useState<{
    file: File;
    buffer: AudioBuffer;
    hash: string;
    id: string;
    metadata: TrackMetadata;
    peaks: WaveformPeaks[];
    transcriptFile?: File;
  } | null>(null);

  const loadFile = useCallback(
    async (file: File, transcriptFile?: File) => {
      setError(null);
      setLoading(file.name);
      try {
        const { buffer, duration, sampleRate } = await decodeAudioFile(file);
        const hash = fileHash(file);
        const id = `track-${Date.now()}-${hash.slice(0, 8)}`;
        const peaks = computePeaks(buffer, settings.waveform.peakStrategy);
        const metadata: TrackMetadata = {
          id,
          fileName: file.name,
          duration,
          sampleRate,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          fileHash: hash,
        };

        let transcript: Transcript | null = getCachedTranscript(hash);
        const hasContent = (t: Transcript) =>
          t.segments.some(
            (s) => (s.text?.trim().length ?? 0) > 0 || (s.translation?.trim().length ?? 0) > 0
          );
        if (transcript?.segments.length && !hasContent(transcript)) {
          clearCachedTranscript(hash);
          transcript = null;
        }
        if (!transcript && transcriptFile) {
          const raw = await transcriptFile.text();
          const parsed = parseTranscriptJson(raw, id, duration);
          if (parsed) {
            transcript = parsed;
            cacheTranscript(hash, parsed);
          }
        }

        if (!transcript) {
          setLoading(null);
          setTranscribePrompt({
            file,
            buffer,
            hash,
            id,
            metadata,
            peaks,
            transcriptFile,
          });
          return;
        }

        const phrases = buildPhrasesFromTranscript(transcript, id);
        setTrack(id, metadata, phrases, buffer, peaks, transcript);
        setCurrentTrack(id);
        if (settings.playback.autoPlayOnSelect) {
          useStore.getState().setPlaying(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load file');
      } finally {
        setLoading(null);
      }
    },
    [setCurrentTrack, settings]
  );

  const handleTranscribeChoice = useCallback(
    (doLoadWithoutTranscript: boolean) => {
      const pending = transcribePrompt;
      if (!pending) return;
      setTranscribePrompt(null);

      const { id, metadata, peaks, hash } = pending;
      const transcript: Transcript = { segments: [] };

      if (doLoadWithoutTranscript) {
        const buffer = pending.buffer;
        const phrases = buildPhrasesFromTranscript(transcript, id, metadata.duration);
        setTrack(id, metadata, phrases, buffer, peaks, transcript);
        setCurrentTrack(id);
        if (settings.playback.autoPlayOnSelect) {
          useStore.getState().setPlaying(true);
        }
      }
    },
    [transcribePrompt, settings, setCurrentTrack]
  );

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const audioFiles = files.filter((f) => /\.(mp3|m4a|wav|ogg|webm)$/i.test(f.name));
    const jsonFiles = files.filter((f) => /\.json$/i.test(f.name));
    const byBase = (name: string) => name.replace(/\.[^.]+$/, '');
    audioFiles.forEach((audio) => {
      const base = byBase(audio.name);
      const paired = jsonFiles.find((j) => byBase(j.name) === base);
      loadFile(audio, paired);
    });
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const audioFiles = files.filter((f) => /\.(mp3|m4a|wav|ogg|webm)$/i.test(f.name));
    const jsonFiles = files.filter((f) => /\.json$/i.test(f.name));
    const byBase = (name: string) => name.replace(/\.[^.]+$/, '');
    audioFiles.forEach((audio) => {
      const base = byBase(audio.name);
      const paired = jsonFiles.find((j) => byBase(j.name) === base);
      loadFile(audio, paired);
    });
  };

  const onDragOver = (e: React.DragEvent) => e.preventDefault();

  const trackIds = getTrackIdsForNav(nav, recentTrackIds, favoriteTrackIds);
  const displayList = trackIds
    .map((id) => getTrack(id)?.metadata)
    .filter(Boolean) as TrackMetadata[];

  return (
    <>
    {transcribePrompt && (
      <div
        role="dialog"
        aria-label="No transcript"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
        }}
        onClick={() => setTranscribePrompt(null)}
        onKeyDown={(e) => e.key === 'Escape' && setTranscribePrompt(null)}
      >
        <div
          role="document"
          style={{
            background: 'var(--sf-bg-card)',
            border: '1px solid var(--sf-border)',
            borderRadius: 16,
            padding: 24,
            maxWidth: 400,
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--sf-text)' }}>
            No transcript
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--sf-text-muted)' }}>
            <strong>{transcribePrompt.file.name}</strong> has no transcript. Load without transcript, or provide a .json transcript file (same base name).
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => handleTranscribeChoice(false)}
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                border: '1px solid var(--sf-border)',
                background: 'transparent',
                color: 'var(--sf-text-muted)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleTranscribeChoice(true)}
              style={{
                padding: '10px 20px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--sf-primary)',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Load without transcript
            </button>
          </div>
        </div>
      </div>
    )}
    <aside
      style={{
        width: 280,
        background: 'var(--sf-bg-sidebar)',
        borderRight: '1px solid var(--sf-border)',
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
      }}
    >
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setLearningView('dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 12,
            border: 'none',
            background: learningView === 'dashboard' ? 'var(--sf-primary)' : 'transparent',
            color: learningView === 'dashboard' ? 'white' : 'var(--sf-text-muted)',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: learningView === 'dashboard' ? 600 : 500,
            textAlign: 'left',
            width: '100%',
          }}
        >
          <span className="material-symbols-outlined">dashboard</span>
          Practice
        </button>
        <button
          type="button"
          onClick={() => setLearningView('library')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px',
            borderRadius: 12,
            border: 'none',
            background: learningView === 'library' ? 'var(--sf-primary)' : 'transparent',
            color: learningView === 'library' ? 'white' : 'var(--sf-text-muted)',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: learningView === 'library' ? 600 : 500,
            textAlign: 'left',
            width: '100%',
          }}
        >
            <span className="material-symbols-outlined">menu_book</span>
            {' '}
          Sentences
        </button>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--sf-text-muted)', margin: '12px 0 4px' }}>
          AUDIO TRACKS
        </p>
        {(['library', 'recent', 'favorites'] as const).map((n) => {
          const iconName = n === 'library' ? 'library_music' : n === 'recent' ? 'schedule' : 'star';
          return (
            <button
              key={n}
              type="button"
              onClick={() => setNav(n)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 12,
                border: 'none',
                background: nav === n ? 'var(--sf-primary)' : 'transparent',
                color: nav === n ? 'white' : 'var(--sf-text-muted)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: nav === n ? 600 : 500,
                textAlign: 'left',
                width: '100%',
              }}
            >
              <span className="material-symbols-outlined">{iconName}</span>
              {' '}
              {n.charAt(0).toUpperCase() + n.slice(1)}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--sf-text-muted)', marginBottom: 8 }}>
          TRACK LIST
        </p>
        {error && (
          <p style={{ fontSize: 12, color: 'var(--sf-error)', marginBottom: 8 }}>{error}</p>
        )}
        {loading && (
          <p style={{ fontSize: 12, color: 'var(--sf-text-muted)', marginBottom: 8 }}>
            Loading {loading}…
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {displayList.map((meta) => {
            const active = currentTrackId === meta.id;
            const isFavorite = favoriteTrackIds.includes(meta.id);
            return (
              <div
                key={meta.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: 12,
                  borderRadius: 8,
                  borderLeft: active ? '4px solid var(--sf-primary)' : '4px solid transparent',
                  background: active ? 'var(--sf-bg-elevated)' : 'transparent',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setCurrentTrack(meta.id);
                    setLearningView('track');
                    if (settings.playback.autoPlayOnSelect) {
                      useStore.getState().setPlaying(true);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: active ? 'var(--sf-text)' : 'var(--sf-text-muted)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 14,
                    fontWeight: active ? 700 : 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {meta.fileName}
                  </span>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--sf-text-muted)' }}>
                    {formatDuration(meta.duration)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(meta.id);
                  }}
                  style={{
                    padding: 4,
                    border: 'none',
                    background: 'transparent',
                    color: isFavorite ? 'var(--sf-warning)' : 'var(--sf-text-muted)',
                    cursor: 'pointer',
                  }}
                  aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    {isFavorite ? 'star' : 'star_border'}
                  </span>
                </button>
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'var(--sf-primary-muted)',
                    color: 'var(--sf-primary)',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  Ready
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ paddingTop: 16, borderTop: '1px solid var(--sf-border)' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '12px 16px',
            background: 'var(--sf-primary)',
            color: 'white',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          <span className="material-symbols-outlined">upload_file</span>
          {' '}
          Upload Audio
          <input
            type="file"
            accept=".mp3,.m4a,.wav,.ogg,.webm,audio/*,.json"
            multiple
            onChange={onFileSelect}
            style={{ display: 'none' }}
          />
        </label>
        <p
          style={{
            marginTop: 8,
            fontSize: 11,
            color: 'var(--sf-text-muted)',
            textAlign: 'center',
            lineHeight: 1.4,
          }}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          Drag & drop audio + optional .json transcript (same base name).
        </p>
      </div>
    </aside>
    </>
  );
}
