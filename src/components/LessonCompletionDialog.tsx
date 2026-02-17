/**
 * Lesson completion dialog: "Lesson Complete!" with Stay Here / Next Lesson.
 * Uses existing <dialog> pattern from Settings.
 *
 * Next Lesson action unlocks the target lesson before switching so that
 * Speaking/Writing queues can load sentences immediately.
 */

import { getLesson, getLessonsForCourse, updateLesson } from '@/store/courses';
import { useStore } from '@/store/useStore';

type Props = Readonly<{
  open: boolean;
  currentLessonId: string | null;
  currentCourseId: string | null;
  onClose: () => void;
}>;

export function LessonCompletionDialog({ open, currentLessonId, currentCourseId, onClose }: Props) {
  const setCurrentLessonId = useStore((s) => s.setCurrentLessonId);

  const handleNextLesson = () => {
    if (!currentLessonId || !currentCourseId) {
      onClose();
      return;
    }
    const lesson = getLesson(currentLessonId);
    if (!lesson) {
      onClose();
      return;
    }
    const courseLessons = getLessonsForCourse(lesson.courseId);
    const nextLesson = courseLessons.find((l) => l.order === lesson.order + 1);
    if (nextLesson) {
      // Unlock the target lesson before switching so Speaking/Writing can load it
      if (!nextLesson.isUnlocked) {
        const unlocked = { ...nextLesson, isUnlocked: true };
        updateLesson(unlocked);
      }
      setCurrentLessonId(nextLesson.id);
      useStore.getState().incrementSentenceVersion();
    }
    onClose();
  };

  if (!open) return null;

  const lesson = currentLessonId ? getLesson(currentLessonId) : null;
  const courseLessons = lesson ? getLessonsForCourse(lesson.courseId) : [];
  const hasNext = lesson ? courseLessons.some((l) => l.order === lesson.order + 1) : false;

  return (
    <dialog
      open
      aria-labelledby="lesson-complete-title"
      aria-modal
      className="settings-backdrop"
      style={{ border: 'none', margin: 0, padding: 0, width: '100%', maxWidth: 'none', height: '100%', maxHeight: 'none' }}
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        className="settings-modal max-w-md"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <header className="settings-header">
          <h2
            id="lesson-complete-title"
            style={{ margin: 0, fontSize: 'clamp(1.125rem, 4vw, 1.25rem)', fontWeight: 700, color: 'var(--sf-text)' }}
          >
            Lesson Complete!
          </h2>
        </header>
        <div className="p-6 pt-0 space-y-6">
          <p className="text-[var(--sf-text)] opacity-90">
            You&apos;ve completed all cards for this lesson. Proceed to the next lesson? It will be loaded for Speaking and Writing.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="settings-btn settings-btn-secondary"
            >
              Stay Here
            </button>
            <button
              type="button"
              onClick={handleNextLesson}
              disabled={!hasNext}
              className="settings-btn settings-btn-primary disabled:opacity-50 disabled:pointer-events-none"
            >
              Next Lesson
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
