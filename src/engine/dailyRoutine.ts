/**
 * Daily routine generator: quick / standard / deep sessions, 80/20 review vs new, break reminders.
 */

import type { DailySessionPlan } from '@/types';
import {
  getDueSentences,
  getUnexposedSentences,
  getMasteredSpeakingCount,
  getDueWritingSentences,
} from '@/store/sentences';

const MORNING_DURATION = 35;
const AFTERNOON_DURATION = 35;
const EVENING_DURATION = 35;

export type SessionSize = 'quick' | 'standard' | 'deep';

export function getSessionPlan(availableMins: number): { reviewCount: number; newCount: number; writingCount: number } {
  const due = getDueSentences();
  const unexposed = getUnexposedSentences();
  const dueWriting = getDueWritingSentences();
  const reviewTarget = Math.min(Math.floor(availableMins * 0.8 / 2), due.length);
  const newTarget = Math.min(Math.floor(availableMins * 0.2 / 2), unexposed.length);
  const writingTarget = Math.min(Math.floor(availableMins / 6), dueWriting.length);
  return {
    reviewCount: Math.max(0, reviewTarget),
    newCount: Math.max(0, newTarget),
    writingCount: Math.max(0, writingTarget),
  };
}

export function getDailyRoutine(): DailySessionPlan[] {
  const due = getDueSentences();
  const unexposed = getUnexposedSentences();
  const mastered = getMasteredSpeakingCount();
  const dueWriting = getDueWritingSentences();

  const morning: DailySessionPlan = {
    session: 'morning',
    durationMins: MORNING_DURATION,
    reviewCount: Math.min(20, due.length),
    newSentencesCount: 0,
    shadowingReps: 200 * 5,
    drillDue: due.length >= 20,
    writingCount: 0,
    fluencyBursts: 0,
  };

  const afternoon: DailySessionPlan = {
    session: 'afternoon',
    durationMins: AFTERNOON_DURATION,
    reviewCount: 0,
    newSentencesCount: Math.min(25, unexposed.length),
    shadowingReps: 0,
    drillDue: false,
    writingCount: 0,
    fluencyBursts: 10,
  };

  const evening: DailySessionPlan = {
    session: 'evening',
    durationMins: EVENING_DURATION,
    reviewCount: due.length > 20 ? due.length - 20 : 0,
    newSentencesCount: 0,
    shadowingReps: 0,
    drillDue: mastered >= 50 && due.length >= 20,
    writingCount: Math.min(10, dueWriting.length),
    fluencyBursts: 10,
  };

  return [morning, afternoon, evening];
}

const STREAK_KEY = 'shadowflow-daily-streak';

export function getDailyStreak(): number {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return 0;
    const data = JSON.parse(raw) as { lastDate: string; streak: number };
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    if (data.lastDate === today) return data.streak;
    if (data.lastDate === yesterday) return data.streak + 1;
    return 0;
  } catch {
    return 0;
  }
}

export function recordDailyActivity(): void {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(STREAK_KEY);
    let streak = 1;
    let lastDate = today;
    if (raw) {
      const data = JSON.parse(raw) as { lastDate: string; streak: number };
      const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      if (data.lastDate === today) { streak = data.streak; }
      else if (data.lastDate === yesterday) { streak = data.streak + 1; }
      lastDate = today;
    }
    localStorage.setItem(STREAK_KEY, JSON.stringify({ lastDate, streak }));
  } catch {
    // Ignore quota/IO errors when saving daily routine
  }
}
