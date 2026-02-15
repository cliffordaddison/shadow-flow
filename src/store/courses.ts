/**
 * Course and Lesson store: persistence via IndexedDB or localStorage fallback.
 */

import type { Course, Lesson } from '@/types';
import * as db from './db';

const COURSES_KEY = 'shadowflow-courses';
const LESSONS_KEY = 'shadowflow-lessons';

const courses: Course[] = [];
const lessons: Lesson[] = [];

function loadCourses(): void {
  try {
    const raw = localStorage.getItem(COURSES_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Course[];
    if (Array.isArray(parsed)) {
      courses.length = 0;
      courses.push(...parsed);
    }
  } catch (_) {}
}

function saveCourses(): void {
  try {
    localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
  } catch (_) {}
}

function loadLessons(): void {
  try {
    const raw = localStorage.getItem(LESSONS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Lesson[];
    if (Array.isArray(parsed)) {
      lessons.length = 0;
      lessons.push(...parsed);
    }
  } catch (_) {}
}

function saveLessons(): void {
  try {
    localStorage.setItem(LESSONS_KEY, JSON.stringify(lessons));
  } catch (_) {}
}

export async function initFromDB(): Promise<void> {
  try {
    const [coursesData, lessonsData] = await Promise.all([
      db.getAll<Course>('courses'),
      db.getAll<Lesson>('lessons'),
    ]);
    courses.length = 0;
    lessons.length = 0;
    if (Array.isArray(coursesData)) courses.push(...coursesData);
    if (Array.isArray(lessonsData)) lessons.push(...lessonsData);
  } catch (_) {}
}

export function initFromLocalStorage(): void {
  loadCourses();
  loadLessons();
}

/** Append course and lessons to in-memory arrays only (after transaction put). */
export function appendCourseAndLessonsToMemory(course: Course, lessonList: Lesson[]): void {
  if (courses.some((c) => c.id === course.id)) return;
  courses.push({ ...course, lessons: [...(course.lessons || [])] });
  for (const l of lessonList) {
    if (lessons.some((x) => x.id === l.id)) continue;
    lessons.push({ ...l, sentenceIds: [...(l.sentenceIds || [])] });
  }
}

export function getAllCourses(): Course[] {
  return [...courses];
}

export function getCourse(id: string): Course | undefined {
  return courses.find((c) => c.id === id);
}

export function addCourse(course: Course): void {
  if (courses.some((c) => c.id === course.id)) return;
  const copy = { ...course, lessons: [...(course.lessons || [])] };
  courses.push(copy);
  if (db.getUseIndexedDB()) {
    db.put('courses', course.id, copy).catch(() => {});
  } else {
    saveCourses();
  }
}

export async function removeCourse(id: string): Promise<void> {
  const i = courses.findIndex((c) => c.id === id);
  if (i >= 0) {
    courses.splice(i, 1);
    if (db.getUseIndexedDB()) {
      await db.deleteKey('courses', id);
    } else {
      saveCourses();
    }
  }
  const toRemove = lessons.filter((l) => l.courseId === id);
  for (const l of toRemove) {
    const idx = lessons.findIndex((x) => x.id === l.id);
    if (idx >= 0) lessons.splice(idx, 1);
  }
  if (db.getUseIndexedDB() && toRemove.length > 0) {
    await Promise.all(toRemove.map((l) => db.deleteKey('lessons', l.id)));
  } else if (toRemove.length > 0) {
    saveLessons();
  }
}

export function getLessonsForCourse(courseId: string): Lesson[] {
  return lessons.filter((l) => l.courseId === courseId).sort((a, b) => a.order - b.order);
}

export function getLesson(id: string): Lesson | undefined {
  return lessons.find((l) => l.id === id);
}

export function addLesson(lesson: Lesson): void {
  if (lessons.some((l) => l.id === lesson.id)) return;
  const copy = { ...lesson, sentenceIds: [...(lesson.sentenceIds || [])] };
  lessons.push(copy);
  if (db.getUseIndexedDB()) {
    db.put('lessons', lesson.id, copy).catch(() => {});
  } else {
    saveLessons();
  }
  const course = courses.find((c) => c.id === lesson.courseId);
  if (course) {
    const ref = { id: lesson.id, name: lesson.name, order: lesson.order, isUnlocked: lesson.isUnlocked };
    const idx = course.lessons.findIndex((r) => r.id === lesson.id);
    if (idx < 0) {
      course.lessons = [...(course.lessons || []), ref].sort((a, b) => a.order - b.order);
      if (db.getUseIndexedDB()) {
        db.put('courses', course.id, { ...course }).catch(() => {});
      } else {
        saveCourses();
      }
    }
  }
}

export function updateLesson(lesson: Lesson): void {
  const i = lessons.findIndex((l) => l.id === lesson.id);
  if (i >= 0) {
    lessons[i] = { ...lesson, sentenceIds: [...(lesson.sentenceIds || [])] };
    if (db.getUseIndexedDB()) {
      db.put('lessons', lesson.id, lessons[i]).catch(() => {});
    } else {
      saveLessons();
    }
  }
  const course = courses.find((c) => c.id === lesson.courseId);
  if (course) {
    const ref = course.lessons.find((r) => r.id === lesson.id);
    if (ref) {
      ref.name = lesson.name;
      ref.order = lesson.order;
      ref.isUnlocked = lesson.isUnlocked;
      if (db.getUseIndexedDB()) {
        db.put('courses', course.id, { ...course }).catch(() => {});
      } else {
        saveCourses();
      }
    }
  }
}

/** Clear in-memory courses and lessons (used by reset/delete before reload). */
export function clearCoursesAndLessonsInMemory(): void {
  courses.length = 0;
  lessons.length = 0;
}

export function unlockNextLesson(completedLessonId: string): void {
  const lesson = lessons.find((l) => l.id === completedLessonId);
  if (!lesson) return;
  const today = new Date().toISOString().slice(0, 10);
  lesson.completedAt = today;
  const idx = lessons.findIndex((l) => l.id === completedLessonId);
  if (idx >= 0) {
    lessons[idx] = { ...lesson };
    if (db.getUseIndexedDB()) {
      db.put('lessons', lesson.id, lessons[idx]).catch(() => {});
    } else {
      saveLessons();
    }
  }
  const courseLessons = getLessonsForCourse(lesson.courseId);
  const nextOrder = lesson.order + 1;
  const nextLesson = courseLessons.find((l) => l.order === nextOrder);
  if (nextLesson) {
    nextLesson.isUnlocked = true;
    const j = lessons.findIndex((l) => l.id === nextLesson.id);
    if (j >= 0) {
      lessons[j] = { ...nextLesson };
      if (db.getUseIndexedDB()) {
        db.put('lessons', nextLesson.id, lessons[j]).catch(() => {});
      } else {
        saveLessons();
      }
    }
    const course = courses.find((c) => c.id === lesson.courseId);
    if (course) {
      const ref = course.lessons.find((r) => r.id === nextLesson.id);
      if (ref) {
        ref.isUnlocked = true;
        if (db.getUseIndexedDB()) {
          db.put('courses', course.id, { ...course }).catch(() => {});
        } else {
          saveCourses();
        }
      }
    }
  }
}
