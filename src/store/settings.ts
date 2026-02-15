/**
 * Default settings and persistence (localStorage).
 */

import type { AppSettings, KeyboardShortcuts } from '@/types';
import { defaultLearningSettings } from '@/types';

const STORAGE_KEY = 'shadowflow-settings';

export const defaultShortcuts: KeyboardShortcuts = {
  playPause: ' ',
  nextPhrase: 'n',
  prevPhrase: 'p',
  repeatCurrent: 'r',
  rewind2s: 'ArrowLeft',
  fastForward2s: 'ArrowRight',
  nonStop: 'Control+ ',
  home: 'Home',
  end: 'End',
  showHelp: '?',
};

export const defaultSettings: AppSettings = {
  shortcuts: defaultShortcuts,
  targetLanguage: 'fr-FR',
  learning: defaultLearningSettings,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      shortcuts: { ...defaultShortcuts, ...parsed.shortcuts },
      targetLanguage: parsed.targetLanguage ?? defaultSettings.targetLanguage,
      learning: { ...defaultLearningSettings, ...parsed.learning },
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota/IO errors when saving settings
  }
}
