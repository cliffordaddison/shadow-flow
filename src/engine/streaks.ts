/**
 * Streak tracking: consecutive days per mode.
 */

const STORAGE_KEY = 'shadowflow-streaks';

interface StreakData {
  mode: string;
  lastDate: string;
  count: number;
}

function load(): Record<string, StreakData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StreakData>;
  } catch {
    return {};
  }
}

function save(data: Record<string, StreakData>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota/IO errors when saving streaks
  }
}

export function updateStreak(mode: 'listen' | 'speak' | 'write'): void {
  const data = load();
  const today = new Date().toISOString().slice(0, 10);
  const prev = data[mode];
  if (!prev) {
    data[mode] = { mode, lastDate: today, count: 1 };
    save(data);
    return;
  }
  const todayStart = new Date(today).setHours(0, 0, 0, 0);
  const prevStart = new Date(prev.lastDate).setHours(0, 0, 0, 0);
  const diffDays = Math.round((todayStart - prevStart) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return;
  if (diffDays > 1) {
    data[mode] = { mode, lastDate: today, count: 1 };
  } else {
    data[mode] = { mode, lastDate: today, count: prev.count + 1 };
  }
  save(data);
}

export function getStreak(mode: 'listen' | 'speak' | 'write'): number {
  const data = load();
  const today = new Date().toISOString().slice(0, 10);
  const prev = data[mode];
  if (!prev) return 0;
  const prevStart = new Date(prev.lastDate).setHours(0, 0, 0, 0);
  const todayStart = new Date(today).setHours(0, 0, 0, 0);
  const diffDays = Math.round((todayStart - prevStart) / (24 * 60 * 60 * 1000));
  if (diffDays > 1) return 0;
  if (diffDays === 0) return prev.count;
  return prev.count;
}
