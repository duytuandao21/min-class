import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import type { PublicLessonStatus } from "@/features/catalog/schemas";
import { getPublicChapters, getPublicCourseSections, getPublicLessons } from "@/features/catalog/server/queries";
import { LessonChapterDisclosure } from "@/features/lessons/components/lesson-chapter-disclosure";

const statusLabel: Record<PublicLessonStatus, string> = {
  UPCOMING: "Sắp diễn ra",
  LIVE: "LIVE",
  ENDED: "Đã kết thúc",
};

const statusClass: Record<PublicLessonStatus, string> = {
  UPCOMING: "bg-amber-100 text-amber-900",
  LIVE: "bg-emerald-100 text-emerald-900",
  ENDED: "bg-red-100 text-red-800",
};

export default async function PublicLessonsPage({ params }: { params: Promise<{ subjectId: string; courseSectionId: string }> }) {
  const { subjectId, courseSectionId } = await params;
  const [courseSections, chapters, lessons] = await Promise.all([
    getPublicCourseSections(subjectId),
    getPublicChapters(courseSectionId),
    getPublicLessons(courseSectionId),
  ]);
  const courseSection = courseSections.find((item) => item.course_section_id === courseSectionId);
  if (!courseSection) notFound();
  const lessonsByChapter = new Map(chapters.map((chapter) => [chapter.chapter_id, []] as [string, typeof lessons]));
  for (const lesson of lessons) lessonsByChapter.get(lesson.chapter_id)?.push(lesson);
  const liveChapterIndex = chapters.findIndex((chapter) =>
    lessonsByChapter.get(chapter.chapter_id)?.some((lesson) => lesson.lesson_status === "LIVE"),
  );
  const initiallyOpenChapterIndex = liveChapterIndex >= 0 ? liveChapterIndex : 0;

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10 sm:px-10">
      <BackLink href={`/learn/subjects/${subjectId}`} label="Lớp học phần" />
      <header className="my-10 max-w-3xl">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--muted)]">COURSE SECTION</p>
        <h1 className="mt-4 break-words text-4xl font-bold tracking-[-0.035em] text-[var(--accent)] sm:text-5xl">{courseSection.section_code}</h1>
        {courseSection.display_name ? <p className="mt-3 text-lg font-medium text-[var(--muted)]">{courseSection.display_name}</p> : null}
        <p className="mt-4 text-lg text-[var(--muted)]">Chọn Lesson bạn muốn truy cập.</p>
      </header>

      {chapters.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center text-[var(--muted)]">Lớp học phần này chưa có Lesson Plan.</p>
      ) : (
        <div className="space-y-4">
          {chapters.map((chapter, chapterIndex) => {
            const chapterLessons = lessonsByChapter.get(chapter.chapter_id) ?? [];
            return (
              <LessonChapterDisclosure defaultOpen={chapterIndex === initiallyOpenChapterIndex} key={chapter.chapter_id} lessonCount={chapterLessons.length} title={chapter.chapter_name}>
                <div className="border-t border-black/10 bg-black/[0.015] p-3 sm:p-4">
                  {chapterLessons.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-black/15 bg-white p-5 text-center text-sm text-[var(--muted)]">Chưa có Lesson trong chương này.</p>
                  ) : (
                    <ul className="space-y-3">
                      {chapterLessons.map((lesson) => (
                        <li key={lesson.lesson_id}>
                          <Link className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 shadow-sm transition hover:border-[var(--accent)] hover:shadow-md sm:flex-row sm:items-center sm:justify-between" href={`/learn/lessons/${lesson.lesson_id}`}>
                            <span className="min-w-0 break-words font-semibold">{lesson.lesson_title}</span>
                            <span className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusClass[lesson.lesson_status]}`}>{statusLabel[lesson.lesson_status]}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </LessonChapterDisclosure>
            );
          })}
        </div>
      )}
    </main>
  );
}
