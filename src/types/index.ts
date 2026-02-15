/**
 * ShadowFlow – core data types (refactored for Course/Lesson/SRS spec)
 */

// ─── Course & Lesson ───────────────────────────────────────────────────────

export interface LessonRef {
  id: string;
  name: string;
  order: number;
  isUnlocked: boolean;
}

export interface Course {
  id: string;
  name: string;
  createdAt: string;
  lessons: LessonRef[];
}

export interface Lesson {
  id: string;
  courseId: string;
  name: string;
  order: number;
  sentenceIds: string[];
  isUnlocked: boolean;
  completedAt?: string;
}

// ─── Sentence (new: french / english) ──────────────────────────────────────

export interface Sentence {
  id: string;
  lessonId: string;
  index: number;
  french: string;
  english: string;
  /** Source file id for cascade delete. */
  sourceFileId?: string;
  createdAt: number;
}

// ─── SRS: ReviewState & ReviewGrade ────────────────────────────────────────

export type ReviewMode = 'listen' | 'speak' | 'write';
export type ReviewGrade = 0 | 1 | 2; // Again / Good / Easy

export interface ReviewState {
  sentenceId: string;
  mode: ReviewMode;
  interval: number;
  due: string;
  ease: number;
  repetitions: number;
  lapses: number;
  lastResult?: ReviewGrade;
  lastReviewedAt?: string;
}

// ─── Word & Sentence Mastery ──────────────────────────────────────────────

export interface WordStats {
  id: string;
  text: string;
  sentenceIds: string[];
  totalSeenCount: number;
  lastSeenAt?: string;
  isMastered: boolean;
}

export interface SentenceMastery {
  sentenceId: string;
  isMastered: boolean;
  masteredAt?: string;
}

// ─── Metrics ───────────────────────────────────────────────────────────────

export interface GlobalStats {
  uniqueWords: number;
  wordsSeenToday: number;
  wordsMastered: number;
  sentencesMastered: number;
}

// ─── Transcript (for track transcription / STT) ─────────────────────────────

export interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  translation?: string;
}

export interface Transcript {
  segments: TranscriptSegment[];
}

// ─── Compare result (unchanged) ─────────────────────────────────────────────

export interface CompareResult {
  score: number;
  passed: boolean;
  errors: { missingWords: string[]; wrongWords: string[]; wordOrder: string[] };
  suggestion: string;
  diff?: Array<{ word: string; status: 'correct' | 'missing' | 'wrong' }>;
}

// ─── Settings ──────────────────────────────────────────────────────────────

export interface LearningSettings {
  ttsSpeed: number;
  ttsVoice?: string;
  similarityThreshold: number;
  exposureRepeatCount: number;
  maxSpeakingAttempts: number;
  dailyReviewGoal: number;
  dailyNewGoal: number;
  dailyShadowingRepsGoal: number;
  passivePlaylistEnabled: boolean;
  accentInsensitive?: boolean;
  timingProfile?: 'beginner' | 'intermediate' | 'advanced';
  srsMultiplier?: 'balanced' | 'aggressive' | 'relaxed';
}

export const defaultLearningSettings: LearningSettings = {
  ttsSpeed: 1,
  similarityThreshold: 85,
  exposureRepeatCount: 5,
  maxSpeakingAttempts: 5,
  dailyReviewGoal: 20,
  dailyNewGoal: 20,
  dailyShadowingRepsGoal: 1000,
  passivePlaylistEnabled: true,
  timingProfile: 'intermediate',
  srsMultiplier: 'balanced',
};

export interface KeyboardShortcuts {
  playPause: string;
  nextPhrase: string;
  prevPhrase: string;
  repeatCurrent: string;
  rewind2s: string;
  fastForward2s: string;
  nonStop: string;
  home: string;
  end: string;
  showHelp: string;
}

export interface AppSettings {
  targetLanguage: string;
  learning: LearningSettings;
  shortcuts: KeyboardShortcuts;
}

export interface AppState {
  currentTrackId: string | null;
  currentPhraseIndex: number;
  playbackMode: 'stopped' | 'phrase' | 'nonstop';
  isPlaying: boolean;
  currentTime: number;
  abLoop: { a: number; b: number } | null;
  zoom: number;
  scrollOffset: number;
}

// ─── Daily session plan ─────────────────────────────────────────────────────

export interface DailySessionPlan {
  session: string;
  durationMins: number;
  reviewCount: number;
  newSentencesCount: number;
  shadowingReps: number;
  drillDue: boolean;
  writingCount: number;
  fluencyBursts: number;
}

// ─── Unique word tracker (legacy shape for compatibility) ───────────────────

/** Display names for SRS speaking level (0–6). */
export const MASTERY_LEVEL_NAMES: Record<number, string> = {
  0: 'New',
  1: 'Learning',
  2: 'Familiar',
  3: 'Review',
  4: 'Strong',
  5: 'Confident',
  6: 'Mastered',
};

export interface UniqueWordsStats {
  totalUniqueWords: number;
  byCategory?: Record<string, number>;
  milestoneReached: number | null;
  nextMilestone: number;
  wordsThisWeek?: number;
  recentWords?: string[];
  growthData?: Array<{ date: string; count: number }>;
}
