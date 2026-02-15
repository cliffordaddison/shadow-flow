/**
 * CEFR level from mastered word count.
 */

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

const THRESHOLDS: { level: CEFRLevel; min: number; max: number }[] = [
  { level: 'A1', min: 0, max: 500 },
  { level: 'A2', min: 501, max: 1000 },
  { level: 'B1', min: 1001, max: 2000 },
  { level: 'B2', min: 2001, max: 4000 },
  { level: 'C1', min: 4001, max: 8000 },
  { level: 'C2', min: 8001, max: Infinity },
];

export function calculateCEFRLevel(wordsMasteredCount: number): string {
  for (const { level, min, max } of THRESHOLDS) {
    if (wordsMasteredCount >= min && wordsMasteredCount <= max) return level;
  }
  return 'A1';
}

export function getCEFRProgress(wordsMasteredCount: number): {
  level: string;
  progress: number;
  nextLevel: string;
  wordsToNext: number;
} {
  let current = THRESHOLDS[0];
  let next = THRESHOLDS[1];
  for (let i = 0; i < THRESHOLDS.length; i++) {
    if (wordsMasteredCount <= THRESHOLDS[i].max) {
      current = THRESHOLDS[i];
      next = THRESHOLDS[i + 1] ?? THRESHOLDS[i];
      break;
    }
  }
  const range = next.max === Infinity ? 1 : next.max - next.min;
  const progress = next.max === Infinity ? 100 : Math.min(100, Math.max(0, ((wordsMasteredCount - current.min) / range) * 100));
  const wordsToNext = next.max === Infinity ? 0 : Math.max(0, next.min - wordsMasteredCount);
  return {
    level: current.level,
    progress,
    nextLevel: next.level,
    wordsToNext,
  };
}
