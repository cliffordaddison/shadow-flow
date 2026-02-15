/**
 * Speaking session: STT, comparison, grade, SRS update.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getNextSentence, updateReviewState, getOrCreateReviewState } from './srs';
import { getSentence } from '@/store/sentences';
import type { Sentence, ReviewState } from '@/types';
import { recognizeSpeech } from './stt';
import { compareTexts } from './comparison';
import { updateWordStats, recomputeWordMasteryForSentence } from '@/store/wordStats';
import { updateSentenceMastery } from '@/store/sentenceMastery';
import type { ReviewGrade } from '@/types';
import { useStore } from '@/store/useStore';
import { updateStreak } from './streaks';
import { unlockNextLessonAfterComplete } from './progression';
import { speakSentence } from './tts';

export function useSpeakingSession(lessonId?: string) {
  const settings = useStore((s) => s.settings);
  const [current, setCurrent] = useState<{ sentence: Sentence; state: ReviewState } | null>(null);
  const [userText, setUserText] = useState('');
  const [compareResult, setCompareResult] = useState<ReturnType<typeof compareTexts> | null>(null);
  const [suggestedGrade, setSuggestedGrade] = useState<ReviewGrade | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [againQueueLength, setAgainQueueLength] = useState(0);
  const autoSubmitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenAbortRef = useRef<(() => void) | null>(null);
  /** Session "again" queue: when user grades Again, sentence is re-queued to reappear in this session. */
  const againQueue = useRef<string[]>([]);

  const loadNext = useCallback(() => {
    // Serve from session "again" queue first so "Again" cards come back in this session
    const queue = againQueue.current;
    while (queue.length > 0) {
      const sentenceId = queue.shift()!;
      setAgainQueueLength(queue.length);
      const sentence = getSentence(sentenceId);
      if (sentence && (!lessonId || sentence.lessonId === lessonId)) {
        const state = getOrCreateReviewState(sentenceId, 'speak');
        setCurrent({ sentence, state });
        setUserText('');
        setCompareResult(null);
        setSuggestedGrade(null);
        setError(null);
        setAutoSubmitted(false);
        return;
      }
    }
    setAgainQueueLength(0);

    const next = getNextSentence('speak', lessonId);
    if (!next) {
      setCurrent(null);
      return;
    }
    const sentence = getSentence(next.sentenceId);
    if (!sentence) {
      setCurrent(null);
      return;
    }
    setCurrent({ sentence, state: next.state });
    setUserText('');
    setCompareResult(null);
    setSuggestedGrade(null);
    setError(null);
    setAutoSubmitted(false);
  }, [lessonId]);

  const captureSpeech = useCallback(async () => {
    const controller = new AbortController();
    listenAbortRef.current = () => controller.abort();
    setIsListening(true);
    setError(null);
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a4b9625e-8fba-4712-99a8-d06cb0dd72da',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'speaking.ts:captureSpeech',message:'STT start',data:{timeoutMs:12000,hasCurrent:!!current?.sentence},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    try {
      const text = await recognizeSpeech({
        lang: 'fr-FR',
        signal: controller.signal,
        timeoutMs: 12000,
      });
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a4b9625e-8fba-4712-99a8-d06cb0dd72da',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'speaking.ts:captureSpeech',message:'STT result',data:{textLength:text?.length??0,textPreview:(text||'').slice(0,80),empty:!(text||'').trim()},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      setUserText(text);
      if (!current?.sentence) return;
      const accentInsensitive = settings.learning.accentInsensitive ?? false;
      const result = compareTexts(
        text,
        current.sentence.french,
        settings.learning.similarityThreshold,
        { accentInsensitive }
      );
      setCompareResult(result);
      let grade: ReviewGrade = 0;
      if (result.score >= 95) grade = 2;
      else if (result.score >= settings.learning.similarityThreshold) grade = 1;
      setSuggestedGrade(grade);
    } catch (e) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/a4b9625e-8fba-4712-99a8-d06cb0dd72da',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'speaking.ts:captureSpeech',message:'STT error',data:{error:String(e),message:e instanceof Error ? e.message : ''},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      setError(e instanceof Error ? e.message : 'Speech recognition failed');
    } finally {
      setIsListening(false);
      listenAbortRef.current = null;
    }
  }, [current, settings.learning.similarityThreshold, settings.learning.accentInsensitive]);

  const submitGrade = useCallback(
    (grade: ReviewGrade) => {
      if (!current?.sentence) return;
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
        autoSubmitTimeoutRef.current = null;
      }
      const sentenceId = current.sentence.id;
      const lessonIdForUnlock = current.sentence.lessonId;
      if (grade === 0) againQueue.current.push(sentenceId);
      updateReviewState(sentenceId, 'speak', grade);
      useStore.getState().incrementSentenceVersion();
      updateWordStats(sentenceId, 'speak');
      updateSentenceMastery(sentenceId);
      recomputeWordMasteryForSentence(sentenceId);
      updateStreak('speak');
      if (lessonIdForUnlock) unlockNextLessonAfterComplete(lessonIdForUnlock);
      if (grade === 0) {
        speakSentence(current.sentence.french, {
          rate: settings.learning.ttsSpeed,
          voice: settings.learning.ttsVoice,
        }).catch(() => {});
      }
      loadNext();
    },
    [current, loadNext, settings.learning.ttsSpeed, settings.learning.ttsVoice]
  );

  useEffect(() => {
    if (!current) loadNext();
  }, [current, loadNext]);

  // Auto-submit suggested grade after a short delay so user can override with buttons
  useEffect(() => {
    if (compareResult == null || suggestedGrade == null || !current?.sentence) return;
    autoSubmitTimeoutRef.current = setTimeout(() => {
      autoSubmitTimeoutRef.current = null;
      setAutoSubmitted(true);
      submitGrade(suggestedGrade);
    }, 5000);
    return () => {
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
        autoSubmitTimeoutRef.current = null;
      }
    };
  }, [compareResult, suggestedGrade, current?.sentence?.id, submitGrade]);

  const cancelAutoSubmit = useCallback(() => {
    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current);
      autoSubmitTimeoutRef.current = null;
    }
  }, []);

  const skipSentence = useCallback(() => {
    if (!current?.sentence) return;
    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current);
      autoSubmitTimeoutRef.current = null;
    }
    // Record completion as Good (without STT) and advance
    submitGrade(1);
  }, [current, submitGrade]);

  const stopListening = useCallback(() => {
    listenAbortRef.current?.();
  }, []);

  return {
    current: current?.sentence ?? null,
    userText,
    compareResult,
    suggestedGrade,
    isListening,
    error,
    captureSpeech,
    stopListening,
    submitGrade,
    skipSentence,
    loadNext,
    autoSubmitted,
    cancelAutoSubmit,
    againQueueLength,
  };
}
