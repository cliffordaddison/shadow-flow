/**
 * Lesson picker: select which lesson to practice (Listen & Repeat, Speaking, Writing).
 * Enforces "must finish current lesson before switching": other lessons are disabled until the current one is complete.
 */

import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { getAllCourses, getLessonsForCourse, getLesson } from '@/store/courses';
import { getSentencesByLessonId } from '@/store/sentences';
import { getSentenceMasteryStatus } from '@/store/sentenceMastery';
import { isLessonComplete } from '@/engine/progression';

export function LessonPicker() {
  const currentLessonId = useStore((s) => s.currentLessonId);
  const setCurrentLessonId = useStore((s) => s.setCurrentLessonId);
  const setCurrentCourseId = useStore((s) => s.setCurrentCourseId);
  const sentenceVersion = useStore((s) => s.sentenceVersion);

  const options = useMemo(() => {
    const courses = getAllCourses();
    const list: { lessonId: string; label: string; courseName: string; mastered: number; total: number }[] = [];
    for (const course of courses) {
      const lessons = getLessonsForCourse(course.id);
      for (const lesson of lessons) {
        const sentences = getSentencesByLessonId(lesson.id);
        const total = sentences.length;
        const mastered = total > 0 ? sentences.filter((s) => getSentenceMasteryStatus(s.id)).length : 0;
        list.push({
          lessonId: lesson.id,
          label: lesson.name,
          courseName: course.name,
          mastered,
          total,
        });
      }
    }
    return list;
  }, [sentenceVersion]);

  const currentComplete = currentLessonId ? isLessonComplete(currentLessonId) : true;
  const blockSwitch = !!currentLessonId && !currentComplete;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '' || value === currentLessonId) return;
    if (blockSwitch) return;
    const lessonId = value === '' ? null : value;
    setCurrentLessonId(lessonId);
    if (lessonId) {
      const lesson = getLesson(lessonId);
      if (lesson) setCurrentCourseId(lesson.courseId);
    } else {
      setCurrentCourseId(null);
    }
  };

  if (options.length === 0) {
    return (
      <div className="text-sm text-slate-500 dark:text-slate-400">
        No lessons yet. Upload an Excel file from Upload File.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 min-w-0 w-full">
      <select
        id="lesson-picker"
        value={currentLessonId ?? ''}
        onChange={handleChange}
        className="w-full min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-medium px-4 py-3 sm:py-2.5 focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none cursor-pointer"
        aria-label="Select lesson to practice"
      >
        <option value="">Select a lesson…</option>
        {options.map(({ lessonId, label, courseName, mastered, total }) => {
          const isCurrent = lessonId === currentLessonId;
          const complete = isLessonComplete(lessonId);
          const disabled = blockSwitch && !isCurrent;
          const progress = total > 0 ? `${mastered}/${total}` : '—';
          const optionLabel = `${courseName}: ${label} — ${progress} mastered${complete ? ' ✓' : ''}`;
          return (
            <option key={lessonId} value={lessonId} disabled={disabled} title={disabled ? 'Finish the current lesson first' : undefined}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </div>
  );
}
