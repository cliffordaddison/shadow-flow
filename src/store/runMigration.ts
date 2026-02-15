/**
 * Run migration on app load. Call from main.tsx before render.
 */

import { migrateOldSentencesToNewModel } from './migration';
import { getAllCourses, getLessonsForCourse, updateLesson } from './courses';

const VERSION_KEY = 'shadowflow-data-version';
const CURRENT_VERSION = 3;

/** Unlock all lessons so user can choose any lesson (v2 → v3). */
function unlockAllLessons(): void {
  try {
    const courses = getAllCourses();
    for (const course of courses) {
      const lessonList = getLessonsForCourse(course.id);
      for (const lesson of lessonList) {
        if (!lesson.isUnlocked) {
          updateLesson({ ...lesson, isUnlocked: true });
        }
      }
    }
  } catch {
    // Ignore
  }
}

export function runMigration(): void {
  try {
    const version = localStorage.getItem(VERSION_KEY);
    if (version === String(CURRENT_VERSION)) return;
    if (version !== '2') {
      migrateOldSentencesToNewModel();
    }
    unlockAllLessons();
    localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
  } catch {
    // Ignore migration errors (e.g. localStorage unavailable)
  }
}
