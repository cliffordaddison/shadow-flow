/**
 * Speaking session: STT, comparison, grade, session-based SRS.
 * Time-based session queue: Again → +1 min, Good → +5 min; Easy (1 try) = mastered for session.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getNextSentence, updateReviewState, getOrCreateReviewState } from './srs';
import { getSentence, getSentencesByLessonId } from '@/store/sentences';
import type { Sentence, ReviewState, ReviewGrade } from '@/types';
import { recognizeSpeech } from './stt';
import { compareTexts } from './comparison';
import { updateWordStats, getWordIdsForSentence, recomputeWordMasteryForSentence } from '@/store/wordStats';
import { addSpeakWordsToday } from './metrics';
import { markSentenceMasteredInSession, updateSentenceMastery } from '@/store/sentenceMastery';
import { useStore } from '@/store/useStore';
import { updateStreak } from './streaks';
import { unlockNextLessonAfterComplete } from './progression';
import { speakSentence } from './tts';

const AGAIN_DELAY_MS = 60000;   // 1 min
const GOOD_DELAY_MS = 300000;   // 5 min

type ScheduledCard = { sentenceId: string; scheduledTime: number; attemptCount: number };

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
  const [sessionPosition, setSessionPosition] = useState(0);
  const [uniqueIndex, setUniqueIndex] = useState(0);
  const autoSubmitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listenAbortRef = useRef<(() => void) | null>(null);
  const scheduledQueue = useRef<ScheduledCard[]>([]);
  const attemptCounts = useRef<Record<string, number>>({});
  const seenSentenceIds = useRef<Set<string>>(new Set());

  const totalInLesson = lessonId ? getSentencesByLessonId(lessonId).length : 0;

  const loadNext = useCallback(() => {
    const now = Date.now();
    const queue = scheduledQueue.current;
    queue.sort((a, b) => a.scheduledTime - b.scheduledTime);
    while (queue.length > 0 && queue[0].scheduledTime <= now) {
      const card = queue.shift()!;
      setAgainQueueLength(queue.length);
      const sentence = getSentence(card.sentenceId);
      if (sentence && (!lessonId || sentence.lessonId === lessonId)) {
        const state = getOrCreateReviewState(card.sentenceId, 'speak');
        setCurrent({ sentence, state });
        setSessionPosition((p) => p + 1);
        setUserText('');
        setCompareResult(null);
        setSuggestedGrade(null);
        setError(null);
        setAutoSubmitted(false);
        return;
      }
    }
    setAgainQueueLength(queue.length);

    const next = getNextSentence('speak', lessonId);
    if (next) {
      const sentence = getSentence(next.sentenceId);
      if (sentence) {
        // Track unique sentence index
        if (!seenSentenceIds.current.has(sentence.id)) {
          seenSentenceIds.current.add(sentence.id);
          setUniqueIndex((i) => i + 1);
        }
        setCurrent({ sentence, state: next.state });
        setSessionPosition((p) => p + 1);
        setUserText('');
        setCompareResult(null);
        setSuggestedGrade(null);
        setError(null);
        setAutoSubmitted(false);
        return;
      }
    }
    if (queue.length > 0) {
      const earliest = queue[0];
      const sentence = getSentence(earliest.sentenceId);
      if (sentence && (!lessonId || sentence.lessonId === lessonId)) {
        queue.shift();
        setAgainQueueLength(queue.length);
        const state = getOrCreateReviewState(earliest.sentenceId, 'speak');
        setCurrent({ sentence, state });
        setSessionPosition((p) => p + 1);
        setUserText('');
        setCompareResult(null);
        setSuggestedGrade(null);
        setError(null);
        setAutoSubmitted(false);
        return;
      }
    }
    setCurrent(null);
  }, [lessonId]);

  const captureSpeech = useCallback(async () => {
    const controller = new AbortController();
    listenAbortRef.current = () => controller.abort();
    setIsListening(true);
    setError(null);
    try {
      const text = await recognizeSpeech({
        lang: 'fr-FR',
        signal: controller.signal,
        timeoutMs: 12000,
      });
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
      const attempts = (attemptCounts.current[sentenceId] ?? 0) + 1;
      attemptCounts.current[sentenceId] = attempts;

      if (grade === 2 && attempts === 1) {
        // Easy, 1 try: mastered immediately, no repeat in session
        markSentenceMasteredInSession(sentenceId, attempts);
      } else if (grade === 1) {
        scheduledQueue.current.push({
          sentenceId,
          scheduledTime: Date.now() + GOOD_DELAY_MS,
          attemptCount: attempts,
        });
        setAgainQueueLength(scheduledQueue.current.length);
        updateSentenceMastery(sentenceId, grade, attempts);
      } else if (grade === 0) {
        scheduledQueue.current.push({
          sentenceId,
          scheduledTime: Date.now() + AGAIN_DELAY_MS,
          attemptCount: attempts,
        });
        setAgainQueueLength(scheduledQueue.current.length);
        updateSentenceMastery(sentenceId, grade, attempts);
      }

      // If Easy but not first attempt, still mark mastered
      if (grade === 2 && attempts > 1) {
        markSentenceMasteredInSession(sentenceId, attempts);
      }

      updateReviewState(sentenceId, 'speak', grade);
      useStore.getState().incrementSentenceVersion();
      updateWordStats(sentenceId, 'speak');
      if (grade >= 1) addSpeakWordsToday(getWordIdsForSentence(sentenceId));
      recomputeWordMasteryForSentence(sentenceId);
      updateStreak('speak');
      if (lessonIdForUnlock) unlockNextLessonAfterComplete(lessonIdForUnlock);
      if (grade === 0) {
        speakSentence(current.sentence.french, {
          rate: settings.learning.ttsSpeed,
          voice: settings.learning.ttsVoice,
        }).catch(() => { });
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
    sessionPosition,
    sessionTotal: totalInLesson,
    uniqueIndex,
  };
}
