/**
 * Writing session: strict accent comparison, character diff, SRS update.
 * Session-level "again" queue: cards marked Again reappear in the same session.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getNextSentence, updateReviewState, getOrCreateReviewState } from './srs';
import { getSentence } from '@/store/sentences';
import type { Sentence, ReviewGrade, ReviewState } from '@/types';
import { compareTexts, generateDiff } from './comparison';
import { updateWordStats, recomputeWordMasteryForSentence } from '@/store/wordStats';
import { updateSentenceMastery } from '@/store/sentenceMastery';
import { updateStreak } from './streaks';
import { unlockNextLessonAfterComplete } from './progression';
import { useStore } from '@/store/useStore';

export function useWritingSession(lessonId?: string) {
  const [current, setCurrent] = useState<{ sentence: Sentence; state: ReviewState } | null>(null);
  const [userInput, setUserInput] = useState('');
  const [checked, setChecked] = useState(false);
  const [compareResult, setCompareResult] = useState<ReturnType<typeof compareTexts> | null>(null);
  const [suggestedGrade, setSuggestedGrade] = useState<ReviewGrade | null>(null);
  /** Session "again" queue: when user clicks Again, card is re-queued to reappear in this session. */
  const againQueue = useRef<string[]>([]);
  const autoApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadNext = useCallback(() => {
    // Serve from session "again" queue first so "Again" cards come back in this session
    const queue = againQueue.current;
    while (queue.length > 0) {
      const sentenceId = queue.shift()!;
      const sentence = getSentence(sentenceId);
      if (sentence && (!lessonId || sentence.lessonId === lessonId)) {
        const state = getOrCreateReviewState(sentenceId, 'write');
        setCurrent({ sentence, state });
        setUserInput('');
        setChecked(false);
        setCompareResult(null);
        setSuggestedGrade(null);
        return;
      }
    }

    const next = getNextSentence('write', lessonId);
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
    setUserInput('');
    setChecked(false);
    setCompareResult(null);
    setSuggestedGrade(null);
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
    if (grade === 0) againQueue.current.push(sentenceId);
    updateReviewState(sentenceId, 'write', grade);
    useStore.getState().incrementSentenceVersion();
    updateWordStats(sentenceId, 'write');
    updateSentenceMastery(sentenceId);
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
  };
}
