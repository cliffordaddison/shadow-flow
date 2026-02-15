/**
 * Phase 2 – Active Speaking: English prompt, play French, STT, compare, feedback, retry.
 * UI matches provided Active Speaking design; logic unchanged.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { getDueSentences, updateSpeakingResult, getUniqueWordsStats } from '@/store/sentences';
import { speakFrench, cancelTTS } from '@/engine/tts';
import { listenForSpeech, isSpeechRecognitionSupported } from '@/engine/stt';
import { compareTexts } from '@/engine/comparison';
import { recordSession } from '@/engine/analytics';

const BATCH_SIZE = 20;

const cardStyle: React.CSSProperties = {
  background: 'var(--sf-bg-card)',
  border: '1px solid var(--sf-border)',
  borderRadius: 16,
  padding: 24,
};
const labelStyle: React.CSSProperties = { margin: '0 0 8px', fontSize: 12, color: 'var(--sf-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' };

export function Phase2Speaking() {
  const { setLearningView, settings } = useStore();
  const learning = settings.learning ?? {} as { similarityThreshold?: number; maxSpeakingAttempts?: number; ttsSpeed?: number; exposureRepeatCount?: number; dailyShadowingRepsGoal?: number };
  const threshold = learning.similarityThreshold ?? 85;
  const maxAttempts = Math.min(10, Math.max(1, learning.maxSpeakingAttempts ?? 5));
  const ttsSpeed = learning.ttsSpeed ?? 1;
  const dailyGoal = learning.dailyShadowingRepsGoal ?? 1000;

  const [queue, setQueue] = useState<ReturnType<typeof getDueSentences>>([]);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'idle' | 'playing' | 'listening' | 'comparing'>('idle');
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastResult, setLastResult] = useState<ReturnType<typeof compareTexts> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoPlayTimes, setAutoPlayTimes] = useState<5 | 1>(5);
  const [continuousMode, setContinuousMode] = useState(false);
  const [autoContinueTrigger, setAutoContinueTrigger] = useState(false);
  const [echoMode, setEchoMode] = useState(false);
  const [slowPlayback, setSlowPlayback] = useState(false);
  const sttSupported = isSpeechRecognitionSupported();
  const sessionStartRef = useRef(Date.now());
  const sessionCorrectRef = useRef(0);
  const sessionTotalRef = useRef(0);
  const listenAbortRef = useRef<(() => void) | null>(null);

  const stats = getUniqueWordsStats(true);
  const todayReps = 0;

  const refresh = useCallback(() => {
    const due = getDueSentences(BATCH_SIZE);
    setQueue(due);
    setIndex(0);
    setAttempt(0);
    setLastResult(null);
    setLastTranscript('');
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleListenRef.current?.();
      }
      if (e.key === ' ') {
        e.preventDefault();
        handleNextRef.current?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sentence = queue[index];

  const handlePlayFrench = useCallback(async () => {
    if (!sentence) return;
    setStatus('playing');
    cancelTTS();
    setError(null);
    setLastResult(null);
    setLastTranscript('');
    const rate = slowPlayback ? ttsSpeed * 0.75 : ttsSpeed;
    const times = echoMode ? 3 : (autoPlayTimes === 5 ? 5 : 1);
    try {
      for (let i = 0; i < times; i++) {
        await speakFrench(sentence.french, { rate });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'TTS failed');
    } finally {
      setStatus('idle');
    }
  }, [sentence, ttsSpeed, autoPlayTimes, echoMode, slowPlayback]);

  const handleListenRef = { current: null as (() => void) | null };
  const handleListen = useCallback(async () => {
    if (!sentence || !sttSupported) return;
    const controller = new AbortController();
    listenAbortRef.current = () => controller.abort();
    setStatus('listening');
    setError(null);
    setLastResult(null);
    try {
      const transcript = await listenForSpeech({
        signal: controller.signal,
        timeoutMs: 12000,
      });
      setLastTranscript(transcript);
      setStatus('comparing');
      const result = compareTexts(transcript, sentence.french, threshold, { accentInsensitive: learning.accentInsensitive ?? false });
      setLastResult(result);
      if (result.passed) {
        updateSpeakingResult(sentence.id, result.score);
        if (continuousMode) setAutoContinueTrigger(true);
        if (index + 1 >= queue.length) {
          setQueue(getDueSentences(BATCH_SIZE));
          setIndex(0);
          setAttempt(0);
        } else {
          setIndex((i) => i + 1);
          setAttempt(0);
        }
        setLastResult(null);
        setLastTranscript('');
      } else {
        setAttempt((a) => a + 1);
        if (attempt + 1 >= maxAttempts) {
          sessionTotalRef.current += 1;
          updateSpeakingResult(sentence.id, result.score);
          if (index + 1 >= queue.length) {
            setQueue(getDueSentences(BATCH_SIZE));
            setIndex(0);
          } else {
            setIndex((i) => i + 1);
          }
          setAttempt(0);
          setLastResult(null);
          setLastTranscript('');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speech recognition failed');
    } finally {
      setStatus('idle');
      listenAbortRef.current = null;
    }
  }, [sentence, sttSupported, threshold, index, queue.length, attempt, maxAttempts, continuousMode]);
  handleListenRef.current = handleListen;

  useEffect(() => {
    if (!continuousMode || !sentence || status !== 'idle' || !autoContinueTrigger) return;
    setAutoContinueTrigger(false);
    (async () => {
      await handlePlayFrench();
      handleListen();
    })();
  }, [continuousMode, sentence?.id, status, autoContinueTrigger, handlePlayFrench, handleListen]);

  const handleNextRef = { current: null as (() => void) | null };
  const handleNext = useCallback(() => {
    setLastResult(null);
    setLastTranscript('');
    setAttempt(0);
    if (index + 1 >= queue.length) {
      setQueue(getDueSentences(BATCH_SIZE));
      setIndex(0);
    } else {
      setIndex((i) => i + 1);
    }
  }, [index, queue.length]);
  handleNextRef.current = handleNext;

  const handleBack = useCallback(() => {
    const total = sessionTotalRef.current;
    const correct = sessionCorrectRef.current;
    recordSession({
      startedAt: sessionStartRef.current,
      endedAt: Date.now(),
      phase: 'phase2',
      sentencesCompleted: correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : undefined,
    });
    setLearningView('dashboard');
  }, [setLearningView]);

  if (!sttSupported) {
    return (
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--sf-bg)', padding: 24, display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ color: 'var(--sf-text-muted)', marginBottom: 24 }}>
            Speech recognition is not supported in this browser. Use Chrome or Edge for best support.
          </p>
          <button type="button" onClick={handleBack} style={btnSecondary}>Back to Dashboard</button>
        </div>
      </main>
    );
  }

  if (queue.length === 0 && !sentence) {
    return (
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--sf-bg)', padding: 24, display: 'flex', flexDirection: 'column' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ color: 'var(--sf-text-muted)', marginBottom: 24 }}>
            No sentences due for review. Do Phase 1 first or come back later.
          </p>
          <button type="button" onClick={handleBack} style={btnPrimary}>Back to Dashboard</button>
        </div>
      </main>
    );
  }

  if (!sentence) {
    return (
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--sf-bg)', padding: 24 }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}><p>Loading…</p></div>
      </main>
    );
  }

  const progressPct = dailyGoal > 0 ? Math.min(100, (todayReps / dailyGoal) * 100) : 0;

  return (
    <>
      <main style={{ flex: 1, overflow: 'auto', background: 'var(--sf-bg)', padding: '24px 24px 0', display: 'flex', flexDirection: 'column', gap: 32 }}>
        <div className="phase2-keyboard-hint-mobile" style={{ alignItems: 'center', gap: 16, padding: '8px 16px', background: 'var(--sf-bg-elevated)', borderRadius: 8, marginBottom: 8 }}>
          <kbd style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--sf-bg-card)', border: '1px solid var(--sf-border)', fontSize: 10, fontWeight: 700 }}>R</kbd>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sf-text-dim)' }}>Record</span>
          <kbd style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--sf-bg-card)', border: '1px solid var(--sf-border)', fontSize: 10, fontWeight: 700 }}>SPACE</kbd>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sf-text-dim)' }}>Next</span>
        </div>
        <section className="phase2-cards swipe-container" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 24, alignItems: 'stretch' }}>
          <div style={{ ...cardStyle, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, fontWeight: 800, color: 'var(--sf-text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Target Meaning</div>
            <p style={labelStyle}>Prompt</p>
            <h2 style={{ margin: '0 0 24px', fontSize: '1.875rem', fontWeight: 700, color: 'var(--sf-text)', lineHeight: 1.25 }}>{sentence.english}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 24 }}>
              <span style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--sf-bg-elevated)', fontSize: 10, fontWeight: 700, color: 'var(--sf-text-muted)' }}>CONTEXT: FORMAL</span>
            </div>
          </div>

          <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={labelStyle}>Reference</p>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 500, color: 'var(--sf-text-muted)', fontStyle: 'italic' }}>&quot;{sentence.french}&quot;</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sf-text-dim)', textTransform: 'uppercase' }}>Auto-Play</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
                  <input type="checkbox" checked={echoMode} onChange={(e) => setEchoMode(e.target.checked)} style={{ accentColor: 'var(--sf-primary)' }} />
                  Echo 3×
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11 }}>
                  <input type="checkbox" checked={continuousMode} onChange={(e) => setContinuousMode(e.target.checked)} style={{ accentColor: 'var(--sf-primary)' }} />
                  Continuous
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--sf-bg-elevated)', padding: 4, borderRadius: 9999, border: '1px solid var(--sf-border)' }}>
                  <button
                    type="button"
                    onClick={() => setAutoPlayTimes(5)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 9999,
                      fontSize: 11,
                      fontWeight: 800,
                      border: 'none',
                      background: autoPlayTimes === 5 ? 'var(--sf-primary)' : 'transparent',
                      color: autoPlayTimes === 5 ? '#fff' : 'var(--sf-text-muted)',
                      cursor: 'pointer',
                    }}
                  >5x</button>
                  <button
                    type="button"
                    onClick={() => setAutoPlayTimes(1)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 9999,
                      fontSize: 11,
                      fontWeight: 800,
                      border: 'none',
                      background: autoPlayTimes === 1 ? 'var(--sf-primary)' : 'transparent',
                      color: autoPlayTimes === 1 ? '#fff' : 'var(--sf-text-muted)',
                      cursor: 'pointer',
                    }}
                  >Off</button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 24 }}>
              <button
                type="button"
                onClick={handlePlayFrench}
                disabled={status === 'playing' || status === 'listening'}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid var(--sf-border)',
                  background: 'var(--sf-bg-elevated)',
                  color: 'var(--sf-text)',
                  fontWeight: 700,
                  cursor: status === 'playing' || status === 'listening' ? 'wait' : 'pointer',
                }}
              >
                <span className="material-symbols-outlined fill-icon">volume_up</span>
                Listen to Native
              </button>
              <button
                type="button"
                className="icon-btn"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  border: '1px solid var(--sf-border)',
                  background: slowPlayback ? 'var(--sf-primary-muted)' : 'var(--sf-bg-elevated)',
                }}
                onClick={() => setSlowPlayback((v) => !v)}
                title="Slow playback (0.75×)"
              >
                <span className="material-symbols-outlined">slow_motion_video</span>
              </button>
            </div>
          </div>
        </section>

        <section style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, minHeight: 400 }}>
          <div style={{
            background: 'rgba(15,23,42,0.4)',
            border: '2px dashed var(--sf-border)',
            borderRadius: 24,
            padding: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 400,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.1 }}>
              <div style={{ width: 300, height: 300, borderRadius: '50%', background: 'var(--sf-primary)', filter: 'blur(100px)' }} />
            </div>
            <div style={{ width: '100%', maxWidth: 672, textAlign: 'center', position: 'relative', zIndex: 1 }}>
              {lastResult ? (
                <>
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 9999, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: 'var(--sf-success)', fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>verified</span>
                      Analysis Complete
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
                      <span style={{ fontSize: '4rem', fontWeight: 800, color: 'var(--sf-text)' }}>{lastResult.score}</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--sf-text-dim)' }}>%</span>
                    </div>
                    <p style={{ color: 'var(--sf-text-muted)', fontWeight: 500, marginTop: 8 }}>Similarity Score</p>
                  </div>
                  <div style={{ background: 'var(--sf-bg-elevated)', border: '1px solid var(--sf-border)', borderRadius: 16, padding: 32, marginBottom: 40, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--sf-text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Transcription Comparison</p>
                    <div style={{ fontSize: '1.875rem', fontWeight: 500, letterSpacing: '0.025em', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 12px' }}>
                      {lastResult.diff?.map((d, i) => (
                        <span key={i} className={d.status === 'correct' ? 'text-diff-match' : d.status === 'missing' ? 'text-diff-miss' : 'text-diff-extra'}>
                          {d.word}
                        </span>
                      ))}
                      {(!lastResult.diff || lastResult.diff.length === 0) && (
                        <span style={{ color: 'var(--sf-text-muted)' }}>{lastTranscript || '—'}</span>
                      )}
                    </div>
                    <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--sf-border)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                      <div>
                        <p style={{ fontSize: 10, color: 'var(--sf-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Intonation</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--sf-success)' }}>{lastResult.score >= 90 ? 'Excellent' : lastResult.score >= 80 ? 'Good' : 'Noticeable'}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: 'var(--sf-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Rhythm</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--sf-success)' }}>{lastResult.score >= 85 ? 'Good' : 'Noticeable'}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: 'var(--sf-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Vowels</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: lastResult.score >= 90 ? 'var(--sf-success)' : '#eab308' }}>{lastResult.score >= 90 ? 'Excellent' : 'Noticeable'}</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ marginBottom: 40 }}>
                  <p style={{ color: 'var(--sf-text-muted)', fontSize: 14 }}>Speak the sentence after listening to the reference. Press Record or R to start.</p>
                </div>
              )}
              {status === 'listening' && (
                <p style={{ marginBottom: 12, fontSize: 14, color: 'var(--sf-text-muted)' }}>
                  Speaking… Click <strong>Done speaking</strong> when finished.
                </p>
              )}
              {status === 'listening' && (
                <button
                  type="button"
                  onClick={() => listenAbortRef.current?.()}
                  style={{
                    marginBottom: 16,
                    padding: '10px 24px',
                    borderRadius: 12,
                    border: '1px solid var(--sf-primary)',
                    background: 'var(--sf-primary)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Done speaking
                </button>
              )}
              {error && <p style={{ color: 'var(--sf-error)', marginBottom: 16 }}>{error}</p>}
              <div className="phase2-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
                <button
                  type="button"
                  onClick={handleListen}
                  disabled={status !== 'idle'}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: status !== 'idle' ? 'wait' : 'pointer',
                  }}
                >
                  <div
                    className="phase2-record-btn-mobile"
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: 'var(--sf-error)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      boxShadow: '0 10px 25px rgba(239,68,68,0.2)',
                    }}
                  >
                    <span className="material-symbols-outlined fill-icon" style={{ fontSize: 40 }}>mic</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--sf-text-muted)' }}>Retry (R)</span>
                </button>
                <button
                  type="button"
                  onClick={handlePlayFrench}
                  disabled={status === 'playing' || status === 'listening'}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: status === 'playing' || status === 'listening' ? 'wait' : 'pointer',
                  }}
                >
                  <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'var(--sf-bg-elevated)',
                    border: '1px solid var(--sf-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--sf-text-muted)',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 32 }}>play_arrow</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--sf-text-muted)' }}>My Audio</span>
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: 'var(--sf-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    boxShadow: '0 10px 25px rgba(59,130,246,0.2)',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 40 }}>keyboard_double_arrow_right</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--sf-text-muted)' }}>Next (Space)</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section style={{ marginTop: 'auto', borderTop: '1px solid var(--sf-border)', paddingTop: 32, paddingBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,3fr) minmax(0,1fr)', gap: 32, alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--sf-primary)', fontSize: 20 }}>task_alt</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sf-text-muted)' }}>Daily Shadowing Goal</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--sf-text)' }}>{todayReps} <span style={{ color: 'var(--sf-text-dim)' }}>/ {dailyGoal} reps</span></span>
              </div>
              <div style={{ height: 12, background: 'var(--sf-bg-elevated)', borderRadius: 9999, overflow: 'hidden', padding: 2, border: '1px solid var(--sf-border)' }}>
                <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(to right, var(--sf-primary), var(--sf-success))', borderRadius: 9999, boxShadow: '0 0 10px rgba(59,130,246,0.5)' }} />
              </div>
            </div>
            <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined fill-icon" style={{ color: '#eab308' }}>menu_book</span>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--sf-text-dim)', textTransform: 'uppercase' }}>Unique Words</p>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--sf-text)', lineHeight: 1 }}>{stats.totalUniqueWords}</p>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: 'var(--sf-success)' }}>+0 today</div>
            </div>
          </div>
        </section>
      </main>

      <div className="phase2-keyboard-hint" style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(12px)', border: '1px solid var(--sf-border)', padding: '8px 16px', borderRadius: 9999, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <kbd style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--sf-bg-elevated)', border: '1px solid var(--sf-border)', fontSize: 10, fontWeight: 700, color: 'var(--sf-text-muted)' }}>R</kbd>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sf-text-dim)', textTransform: 'uppercase' }}>Record</span>
        </div>
        <div style={{ width: 1, height: 12, background: 'var(--sf-border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <kbd style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--sf-bg-elevated)', border: '1px solid var(--sf-border)', fontSize: 10, fontWeight: 700, color: 'var(--sf-text-muted)' }}>SPACE</kbd>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sf-text-dim)', textTransform: 'uppercase' }}>Next</span>
        </div>
      </div>
    </>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '12px 24px',
  borderRadius: 12,
  border: 'none',
  background: 'var(--sf-primary)',
  color: 'white',
  cursor: 'pointer',
  fontWeight: 700,
};
const btnSecondary: React.CSSProperties = {
  padding: '12px 24px',
  borderRadius: 12,
  border: '1px solid var(--sf-border)',
  background: 'var(--sf-bg-elevated)',
  color: 'var(--sf-text)',
  cursor: 'pointer',
  fontWeight: 700,
};
