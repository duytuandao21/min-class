const lessonTitleCollator = new Intl.Collator("vi", {
  numeric: true,
  sensitivity: "base",
});

export function sortLessonsByTitle<T extends { id: string; title: string }>(lessons: readonly T[]): T[] {
  return [...lessons].sort((left, right) => (
    lessonTitleCollator.compare(left.title, right.title)
    || left.id.localeCompare(right.id)
  ));
}

export function sortSessionLessons<T extends { lesson_id: string; lesson_title: string }>(lessons: readonly T[]): T[] {
  return [...lessons].sort((left, right) => (
    lessonTitleCollator.compare(left.lesson_title, right.lesson_title)
    || left.lesson_id.localeCompare(right.lesson_id)
  ));
}
