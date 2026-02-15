/**
 * Practice session analytics: duration, sentences completed, accuracy, velocity, heatmap data.
 */

const ANALYTICS_KEY = 'shadowflow-analytics';

export interface SessionRecord {
  startedAt: number;
  endedAt: number;
  phase: 'phase1' | 'phase2' | 'phase3' | 'phase4';
  sentencesCompleted: number;
  accuracy?: number;
}

export interface AnalyticsSnapshot {
  sessions: SessionRecord[];
  lastUpdated: number;
}

function load(): AnalyticsSnapshot {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    if (!raw) return { sessions: [], lastUpdated: 0 };
    const parsed = JSON.parse(raw) as AnalyticsSnapshot;
    if (!parsed.sessions) parsed.sessions = [];
    return parsed;
  } catch {
    return { sessions: [], lastUpdated: 0 };
  }
}

function save(data: AnalyticsSnapshot): void {
  try {
    data.lastUpdated = Date.now();
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota/IO errors when saving analytics
  }
}

let cache = load();

export function recordSession(record: SessionRecord): void {
  cache.sessions.push(record);
  if (cache.sessions.length > 500) cache.sessions = cache.sessions.slice(-500);
  save(cache);
}

export function getSessions(limit?: number): SessionRecord[] {
  const list = [...cache.sessions].reverse();
  return limit ? list.slice(0, limit) : list;
}

export function getPracticeTimeHeatmap(): Record<number, number> {
  const byHour: Record<number, number> = {};
  for (let h = 0; h < 24; h++) byHour[h] = 0;
  for (const s of cache.sessions) {
    const start = new Date(s.startedAt);
    const hour = start.getHours();
    const mins = (s.endedAt - s.startedAt) / 60000;
    byHour[hour] = (byHour[hour] ?? 0) + mins;
  }
  return byHour;
}

export function getLearningVelocity(): number {
  const lastWeek = Date.now() - 7 * 864e5;
  const recent = cache.sessions.filter((s) => s.endedAt >= lastWeek);
  const completed = recent.reduce((a, s) => a + s.sentencesCompleted, 0);
  return completed;
}

export function getRetentionRate(): number {
  if (cache.sessions.length < 10) return 100;
  const withAccuracy = cache.sessions.filter((s) => s.accuracy != null);
  if (withAccuracy.length === 0) return 100;
  const avg = withAccuracy.reduce((a, s) => a + (s.accuracy ?? 0), 0) / withAccuracy.length;
  return Math.round(avg);
}
