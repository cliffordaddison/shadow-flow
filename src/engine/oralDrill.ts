/**
 * Oral Drill engine: English TTS → French STT → comparison → streak tracking.
 * No SRS integration — pure fluency drill, random phrase from full sentence pool.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getAllSentences } from '@/store/sentences';
import type { Sentence } from '@/types';
import { recognizeSpeech } from './stt';
import { compareTexts } from './comparison';
import { useStore } from '@/store/useStore';
import { cancelTTS } from './tts';

// Speak English via Web Speech TTS. Returns a Promise that resolves when done.
function speakEnglish(text: string, rate: number = 1, volume: number = 1): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel(); // stop any previous utterance

    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = rate;
    u.volume = volume;

    // Pick the best English voice if available
    const voices = synth.getVoices();
    const enVoice =
      voices.find((v) => v.lang === 'en-US' && /google|premium|enhanced|natural/i.test(v.name)) ??
      voices.find((v) => v.lang.startsWith('en-US')) ??
      voices.find((v) => v.lang.startsWith('en')) ??
      null;
    if (enVoice) u.voice = enVoice;

    u.onend = () => resolve();
    u.onerror = (e) => reject(new Error(String(e.error ?? 'TTS error')));
    synth.speak(u);
  });
}

export type DrillPhase = 'listening' | 'speaking' | 'result';

export interface OralDrillSession {
  /** Currently active phrase */
  currentPhrase: { english: string; french: string } | null;
  /** Current drill phase */
  phase: DrillPhase;
  /** TTS is playing */
  isPlayingTTS: boolean;
  /** STT is recording */
  isListening: boolean;
  /** Transcription from STT */
  userText: string;
  /** Comparison result after submission */
  compareResult: { passed: boolean; score: number } | null;
  /** Consecutive correct answers */
  streak: number;
  /** Total attempts this session */
  totalAttempts: number;
  /** Whether the French phrase has been revealed */
  revealed: boolean;
  /** Error string if any */
  error: string | null;
  /** True if there are no sentences in the database */
  isEmpty: boolean;

  // Actions
  replayEnglish: () => void;
  captureSpeech: () => void;
  stopListening: () => void;
  reveal: () => void;
  nextPhrase: () => void;
}

/** Pick a random sentence different from the current one (if possible). */
function pickRandom(sentences: Sentence[], excludeId?: string): Sentence | null {
  if (sentences.length === 0) return null;
  const candidates = sentences.length > 1 ? sentences.filter((s) => s.id !== excludeId) : sentences;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function useOralDrillSession(): OralDrillSession {
  const settings = useStore((s) => s.settings);
  const [currentPhrase, setCurrentPhrase] = useState<Sentence | null>(null);
  const [phase, setPhase] = useState<DrillPhase>('listening');
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [userText, setUserText] = useState('');
  const [compareResult, setCompareResult] = useState<{ passed: boolean; score: number } | null>(null);
  const [streak, setStreak] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listenAbortRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelTTS();
      listenAbortRef.current?.();
    };
  }, []);

  const playEnglishTTS = useCallback(
    async (sentence: Sentence) => {
      if (!mountedRef.current) return;
      setIsPlayingTTS(true);
      setError(null);
      try {
        await speakEnglish(sentence.english, settings.learning.ttsSpeed ?? 1);
      } catch (e) {
        if (mountedRef.current) {
          setError(e instanceof Error ? e.message : 'TTS failed');
        }
      } finally {
        if (mountedRef.current) setIsPlayingTTS(false);
      }
    },
    [settings.learning.ttsSpeed]
  );

  const loadNextPhrase = useCallback(
    (excludeId?: string) => {
      const all = getAllSentences();
      const next = pickRandom(all, excludeId);
      if (!next) {
        setCurrentPhrase(null);
        return;
      }
      setCurrentPhrase(next);
      setPhase('listening');
      setUserText('');
      setCompareResult(null);
      setRevealed(false);
      setError(null);
      // Auto-play English TTS
      playEnglishTTS(next);
    },
    [playEnglishTTS]
  );

  // Load first phrase on mount
  useEffect(() => {
    loadNextPhrase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const replayEnglish = useCallback(() => {
    if (!currentPhrase || isPlayingTTS) return;
    playEnglishTTS(currentPhrase);
  }, [currentPhrase, isPlayingTTS, playEnglishTTS]);

  const captureSpeech = useCallback(async () => {
    if (!currentPhrase || isListening) return;
    setPhase('speaking');
    setIsListening(true);
    setUserText('');
    setError(null);

    const controller = new AbortController();
    listenAbortRef.current = () => controller.abort();

    try {
      const text = await recognizeSpeech({
        lang: 'fr-FR',
        signal: controller.signal,
        timeoutMs: 12000,
      });

      if (!mountedRef.current) return;
      setUserText(text);

      const accentInsensitive = settings.learning.accentInsensitive ?? false;
      const result = compareTexts(
        text,
        currentPhrase.french,
        settings.learning.similarityThreshold ?? 85,
        { accentInsensitive }
      );

      setCompareResult({ passed: result.passed, score: result.score });
      setTotalAttempts((n) => n + 1);

      if (result.passed) {
        setStreak((s) => s + 1);
      } else {
        setStreak(0);
      }
      setPhase('result');
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Speech recognition failed');
        setPhase('listening');
      }
    } finally {
      if (mountedRef.current) {
        setIsListening(false);
        listenAbortRef.current = null;
      }
    }
  }, [currentPhrase, isListening, settings.learning.similarityThreshold, settings.learning.accentInsensitive]);

  const stopListening = useCallback(() => {
    listenAbortRef.current?.();
  }, []);

  const reveal = useCallback(() => {
    setRevealed(true);
  }, []);

  const nextPhrase = useCallback(() => {
    loadNextPhrase(currentPhrase?.id);
  }, [loadNextPhrase, currentPhrase?.id]);

  const isEmpty = getAllSentences().length === 0;

  return {
    currentPhrase: currentPhrase
      ? { english: currentPhrase.english, french: currentPhrase.french }
      : null,
    phase,
    isPlayingTTS,
    isListening,
    userText,
    compareResult,
    streak,
    totalAttempts,
    revealed,
    error,
    isEmpty,
    replayEnglish,
    captureSpeech,
    stopListening,
    reveal,
    nextPhrase,
  };
}
