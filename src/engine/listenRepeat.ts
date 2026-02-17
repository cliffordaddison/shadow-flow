/**
 * Listen & Repeat session: TTS playback, repeat count, auto-advance.
 * Does not update ReviewState (exposure only).
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getLesson } from '@/store/courses';
import { getSentencesByLessonId } from '@/store/sentences';
import { speakSentence, cancelTTS } from './tts';
import { useStore } from '@/store/useStore';
import { unlockNextLessonAfterComplete } from './progression';
import { addListenSentenceToday } from './metrics';

const LISTEN_COMPLETED_KEY = 'shadowflow-listen-completed';

function loadListenCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(LISTEN_COMPLETED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveListenCompleted(ids: Set<string>): void {
  try {
    localStorage.setItem(LISTEN_COMPLETED_KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore quota/IO errors when saving listen completed
  }
}

export function useListenRepeatSession(lessonId: string | null) {
  const settings = useStore((s) => s.settings);
  const repeatCount = settings.learning.exposureRepeatCount;
  const listenRepeatState = useStore((s) => s.listenRepeatState);
  const setListenRepeatState = useStore((s) => s.setListenRepeatState);
  const autoAdvance = useStore((s) => s.listenRepeatAutoAdvance);
  const setListenRepeatAutoAdvance = useStore((s) => s.setListenRepeatAutoAdvance);

  const saved = lessonId ? listenRepeatState[lessonId] : undefined;
  const [currentIndex, setCurrentIndex] = useState(saved?.currentIndex ?? 0);
  const [repeatIndex, setRepeatIndex] = useState(saved?.repeatIndex ?? 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [listenCompleted, setListenCompleted] = useState<Set<string>>(loadListenCompleted);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLessonIdRef = useRef<string | null>(null);
  const shouldPlayAfterAdvanceRef = useRef(false);
  const abortPlayRef = useRef(false);
  const autoAdvanceRef = useRef(autoAdvance);

  const lesson = lessonId ? getLesson(lessonId) : null;
  const sentences = lessonId ? getSentencesByLessonId(lessonId) : [];
  const totalSentences = sentences.length;

  // Restore persisted position when lessonId matches; only reset when lessonId changes
  useEffect(() => {
    if (!lessonId) return;
    if (prevLessonIdRef.current !== lessonId) {
      // Stop playback from previous lesson immediately
      abortPlayRef.current = true;
      cancelTTS();
      setIsPlaying(false);

      prevLessonIdRef.current = lessonId;
      const s = listenRepeatState[lessonId];
      if (s !== undefined && s !== null) {
        setCurrentIndex(s.currentIndex);
        setRepeatIndex(s.repeatIndex);
      } else {
        setCurrentIndex(0);
        setRepeatIndex(0);
      }
    }
  }, [lessonId, listenRepeatState]);

  // Persist position whenever it changes
  useEffect(() => {
    if (lessonId != null) {
      setListenRepeatState(lessonId, currentIndex, repeatIndex);
    }
  }, [lessonId, currentIndex, repeatIndex, setListenRepeatState]);

  // Keep ref in sync so playCurrent always reads current value when it finishes
  autoAdvanceRef.current = autoAdvance;

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const markListenCompleted = useCallback((sentenceId: string) => {
    setListenCompleted((prev) => {
      const next = new Set(prev);
      next.add(sentenceId);
      saveListenCompleted(next);
      if (lessonId) {
        const lessonSentenceIds = getSentencesByLessonId(lessonId).map((s) => s.id);
        const lessonComplete = lessonSentenceIds.length > 0 && lessonSentenceIds.every((id) => next.has(id));
        if (lessonComplete) unlockNextLessonAfterComplete(lessonId);
      }
      return next;
    });
  }, [lessonId]);

  const currentSentence = sentences[currentIndex] ?? null;
  const progress = totalSentences > 0 ? (currentIndex / totalSentences) * 100 : 0;

  const playCurrent = useCallback(async () => {
    if (!currentSentence) return;
    abortPlayRef.current = false;
    setIsPlaying(true);
    try {
      for (let r = 0; r < repeatCount; r++) {
        if (abortPlayRef.current) break;
        await speakSentence(currentSentence.french, {
          rate: settings.learning.ttsSpeed,
          voice: settings.learning.ttsVoice,
        });
        if (abortPlayRef.current) break;
        const durationMs = 500;
        let multiplier: number;
        if (settings.learning.timingProfile === 'beginner') multiplier = 2;
        else if (settings.learning.timingProfile === 'advanced') multiplier = 1;
        else multiplier = 1.5;
        const windowMs = durationMs * multiplier;
        if (r < repeatCount - 1) {
          await new Promise((res) => setTimeout(res, windowMs));
        }
        setRepeatIndex(r + 1); // store repeats completed (1..n); 0 = none. Display as-is so 0/3, 1/3, 2/3, 3/3
      }
      if (!abortPlayRef.current) {
        markListenCompleted(currentSentence.id);
        addListenSentenceToday(currentSentence.id);
        setRepeatIndex(0);
        // When autoAdvance is off, stay on current sentence; only advance when it's on
        if (autoAdvanceRef.current) {
          const nextIndex = currentIndex + 1 >= totalSentences ? 0 : currentIndex + 1;
          shouldPlayAfterAdvanceRef.current = nextIndex < totalSentences && nextIndex !== currentIndex;
          setCurrentIndex(nextIndex);
          if (lessonId) setListenRepeatState(lessonId, nextIndex, 0);
        }
      }
    } finally {
      setIsPlaying(false);
    }
  }, [currentSentence, currentIndex, totalSentences, repeatCount, lessonId, autoAdvance, settings.learning.ttsSpeed, settings.learning.ttsVoice, settings.learning.timingProfile ?? 'intermediate', markListenCompleted, setListenRepeatState]);

  const stopPlayback = useCallback(() => {
    abortPlayRef.current = true;
    cancelTTS();
  }, []);

  // After advancing, trigger play for the next sentence when autoAdvance is on
  useEffect(() => {
    if (!shouldPlayAfterAdvanceRef.current || !currentSentence || isPlaying) return;
    shouldPlayAfterAdvanceRef.current = false;
    const t = setTimeout(() => {
      playCurrent();
    }, 400);
    return () => clearTimeout(t);
  }, [currentIndex, currentSentence?.id, isPlaying, playCurrent]);

  const nextSentence = useCallback(() => {
    stopPlayback();
    setRepeatIndex(0);
    if (currentIndex + 1 >= totalSentences) return;
    const next = currentIndex + 1;
    setCurrentIndex(next);
    if (lessonId) setListenRepeatState(lessonId, next, 0);
  }, [currentIndex, totalSentences, lessonId, setListenRepeatState, stopPlayback]);

  const prevSentence = useCallback(() => {
    stopPlayback();
    setRepeatIndex(0);
    if (currentIndex <= 0) return;
    const prev = currentIndex - 1;
    setCurrentIndex(prev);
    if (lessonId) setListenRepeatState(lessonId, prev, 0);
  }, [currentIndex, lessonId, setListenRepeatState, stopPlayback]);

  const restartSession = useCallback(() => {
    stopPlayback();
    setCurrentIndex(0);
    setRepeatIndex(0);
    if (lessonId) setListenRepeatState(lessonId, 0, 0);
  }, [lessonId, setListenRepeatState, stopPlayback]);

  return {
    lesson,
    sentences,
    currentSentence,
    currentIndex: currentIndex + 1,
    totalSentences,
    repeatIndex, // zero-based in state; add +1 only at render (ListenRepeat.tsx)
    repeatCount,
    isPlaying,
    progress,
    playCurrent,
    stopPlayback,
    nextSentence,
    prevSentence,
    restartSession,
    listenCompleted,
    autoAdvance,
    setAutoAdvance: setListenRepeatAutoAdvance,
  };
}
