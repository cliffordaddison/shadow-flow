/**
 * Writing session: strict accent comparison, character diff, session-based SRS.
 * Time-based session queue: Again → +1 min, Good → +5 min; Easy (1 try) = mastered for session.
 * Score >= 95% counts as successful attempt for tracking.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getNextSentence, updateReviewState, getOrCreateReviewState } from './srs';
import { getSentence, getSentencesByLessonId } from '@/store/sentences';
import type { Sentence, ReviewGrade, ReviewState } from '@/types';
import { compareTexts, generateDiff } from './comparison';
import { updateWordStats, getWordIdsForSentence, recomputeWordMasteryForSentence } from '@/store/wordStats';
import { addWriteWordsToday } from './metrics';
import { markSentenceMasteredInSession, updateSentenceMastery } from '@/store/sentenceMastery';
import { updateStreak } from './streaks';
import { unlockNextLessonAfterComplete } from './progression';
import { useStore } from '@/store/useStore';

const AGAIN_DELAY_MS = 60000;   // 1 min
const GOOD_DELAY_MS = 300000;   // 5 min

type ScheduledCard = { sentenceId: string; scheduledTime: number; attemptCount: number };

export function useWritingSession(lessonId?: string) {
  const [current, setCurrent] = useState<{ sentence: Sentence; state: ReviewState } | null>(null);
  const [userInput, setUserInput] = useState('');
  const [checked, setChecked] = useState(false);
  const [compareResult, setCompareResult] = useState<ReturnType<typeof compareTexts> | null>(null);
  const [suggestedGrade, setSuggestedGrade] = useState<ReviewGrade | null>(null);
  const [againQueueLength, setAgainQueueLength] = useState(0);
  const [sessionPosition, setSessionPosition] = useState(0);
  const [uniqueIndex, setUniqueIndex] = useState(0);
  const scheduledQueue = useRef<ScheduledCard[]>([]);
  const attemptCounts = useRef<Record<string, number>>({});
  const autoApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        const state = getOrCreateReviewState(card.sentenceId, 'write');
        setCurrent({ sentence, state });
        setSessionPosition((p) => p + 1);
        setUserInput('');
        setChecked(false);
        setCompareResult(null);
        setSuggestedGrade(null);
        return;
      }
    }
    setAgainQueueLength(queue.length);

    const next = getNextSentence('write', lessonId);
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
        setUserInput('');
        setChecked(false);
        setCompareResult(null);
        setSuggestedGrade(null);
        return;
      }
    }
    if (queue.length > 0) {
      const earliest = queue[0];
      const sentence = getSentence(earliest.sentenceId);
      if (sentence && (!lessonId || sentence.lessonId === lessonId)) {
        queue.shift();
        setAgainQueueLength(queue.length);
        const state = getOrCreateReviewState(earliest.sentenceId, 'write');
        setCurrent({ sentence, state });
        setSessionPosition((p) => p + 1);
        setUserInput('');
        setChecked(false);
        setCompareResult(null);
        setSuggestedGrade(null);
        return;
      }
    }
    setCurrent(null);
  }, [lessonId]);

  const checkAnswer = useCallback(() => {
    if (!current?.sentence) return;
    const strict = compareTexts(userInput, current.sentence.french, 100, { accentInsensitive: false });
    setCompareResult(strict);
    let grade: ReviewGrade = 0;
    if (strict.passed && userInput.trim() === current.sentence.french.trim()) grade = 2;
    else if (strict.passed) grade = 1;
    setSuggestedGrade(grade);
    setChecked(true);
  }, [current, userInput]);

  const submitGrade = useCallback((grade: ReviewGrade) => {
    if (!current?.sentence) return;
    if (autoApplyTimerRef.current) {
      clearTimeout(autoApplyTimerRef.current);
      autoApplyTimerRef.current = null;
    }
    const sentenceId = current.sentence.id;
    const lessonId = current.sentence.lessonId;
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

    updateReviewState(sentenceId, 'write', grade);
    useStore.getState().incrementSentenceVersion();
    updateWordStats(sentenceId, 'write');
    if (grade >= 1) addWriteWordsToday(getWordIdsForSentence(sentenceId));
    recomputeWordMasteryForSentence(sentenceId);
    updateStreak('write');
    if (lessonId) unlockNextLessonAfterComplete(lessonId);
    loadNext();
  }, [current, loadNext]);

  const skipSentence = useCallback(() => {
    if (!current?.sentence) return;
    if (autoApplyTimerRef.current) {
      clearTimeout(autoApplyTimerRef.current);
      autoApplyTimerRef.current = null;
    }
    submitGrade(1);
  }, [current, submitGrade]);

  useEffect(() => {
    if (!current) loadNext();
  }, [current, loadNext]);

  // Auto-apply suggested grade after 5s so user has time to read corrections and learn from mistakes; user can override by clicking a button
  useEffect(() => {
    if (!checked || suggestedGrade === null || !current?.sentence) return;
    autoApplyTimerRef.current = setTimeout(() => {
      autoApplyTimerRef.current = null;
      submitGrade(suggestedGrade);
    }, 5000);
    return () => {
      if (autoApplyTimerRef.current) clearTimeout(autoApplyTimerRef.current);
    };
  }, [checked, suggestedGrade, current?.sentence?.id, submitGrade]);

  const diff = current && userInput ? generateDiff(userInput, current.sentence.french) : undefined;

  return {
    current: current?.sentence ?? null,
    userInput,
    setUserInput,
    checked,
    compareResult,
    suggestedGrade,
    checkAnswer,
    submitGrade,
    skipSentence,
    loadNext,
    diff,
    againQueueLength,
    sessionPosition,
    sessionTotal: totalInLesson,
    uniqueIndex,
  };
}
