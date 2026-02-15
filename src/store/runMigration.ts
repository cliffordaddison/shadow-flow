/**
 * Run migration on app load. Call from main.tsx before render.
 */

import { migrateOldSentencesToNewModel } from './migration';

const VERSION_KEY = 'shadowflow-data-version';
const CURRENT_VERSION = 2;

export function runMigration(): void {
  try {
    const version = localStorage.getItem(VERSION_KEY);
    if (version === String(CURRENT_VERSION)) return;
    migrateOldSentencesToNewModel();
  } catch {
    // Ignore migration errors (e.g. localStorage unavailable)
  }
}
