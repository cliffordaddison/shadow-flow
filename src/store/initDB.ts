/**
 * Initialize storage: open IndexedDB, migrate from localStorage, load stores.
 * Call from main.tsx before render.
 */

import * as db from './db';
import * as courses from './courses';
import * as sentences from './sentences';
import * as reviewStates from './reviewStates';
import * as wordStats from './wordStats';

export async function initStores(): Promise<void> {
  const database = await db.openDB();
  if (database && db.getUseIndexedDB()) {
    try {
      await db.migrateFromLocalStorage();
      await courses.initFromDB();
      await sentences.initFromDB();
      await reviewStates.initFromDB();
      await wordStats.initFromDB();
    } catch (err) {
      console.error('IndexedDB init failed, falling back to localStorage:', err);
      db.setUseIndexedDB(false);
      db.closeDB();
      initFromLocalStorage();
    }
  } else {
    db.setUseIndexedDB(false);
    initFromLocalStorage();
  }
}

function initFromLocalStorage(): void {
  courses.initFromLocalStorage();
  sentences.initFromLocalStorage();
  reviewStates.initFromLocalStorage();
  wordStats.initFromLocalStorage();
}
