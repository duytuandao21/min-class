import { notFound } from "next/navigation";
import Link from "next/link";

import { getPublicChapterStatus, type PublicChapterStatus } from "@/features/catalog/chapter-preview";
import { CourseSectionStudentGate } from "@/features/catalog/components/course-section-student-gate";
import { getRememberedCourseSectionStudent } from "@/features/catalog/preview-actions";
import { getPublicCourseSectionCatalog } from "@/features/catalog/server/queries";
import { LessonChapterDisclosure } from "@/features/lessons/components/lesson-chapter-disclosure";

const statusLabel: Record<PublicChapterStatus, string> = {
  PREVIEW: "Xem trước",
  UPCOMING: "Sắp diễn ra",
  LIVE: "LIVE",
  ENDED: "Đã kết thúc",
};

const statusClass: Record<PublicChapterStatus, string> = {
  PREVIEW: "bg-sky-100 text-sky-900",
  UPCOMING: "bg-amber-100 text-amber-900",
  LIVE: "bg-emerald-100 text-emerald-900",
  ENDED: "bg-red-100 text-red-800",
};

export default async function PublicLessonsPage({ params }: { params: Promise<{ subjectId: string; courseSectionId: string }> }) {
  const { subjectId, courseSectionId } = await params;
  const [catalog, initialMssv] = await Promise.all([
    getPublicCourseSectionCatalog(subjectId, courseSectionId),
    getRememberedCourseSectionStudent(courseSectionId),
  ]);
  if (!catalog) notFound();
  const { chapters, courseSection, lessons } = catalog;
  const lessonsByChapter = new Map(chapters.map((chapter) => [chapter.chapter_id, []] as [string, typeof lessons]));
  for (const lesson of lessons) lessonsByChapter.get(lesson.chapter_id)?.push(lesson);
  return (
    <CourseSectionStudentGate
      backHref={`/learn/subjects/${subjectId}`}
      courseSectionCode={courseSection.section_code}
      courseSectionId={courseSectionId}
      displayName={courseSection.display_name}
      initialMssv={initialMssv}
      key={courseSectionId}
    >
        {chapters.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center text-[var(--muted)]">Lớp học phần này chưa có Lesson Plan.</p>
        ) : (
          <div className="space-y-4">
          {chapters.map((chapter) => {
            const chapterLessons = lessonsByChapter.get(chapter.chapter_id) ?? [];
            const chapterStatus = getPublicChapterStatus(chapterLessons, chapter.preview_enabled);
            const chapterHref = chapterStatus === "UPCOMING"
              ? undefined
              : `/learn/subjects/${subjectId}/sections/${courseSectionId}/chapters/${chapter.chapter_id}`;
            return (
              <LessonChapterDisclosure
                actions={chapterStatus === "LIVE" && chapterHref ? (
                  <Link
                    aria-label={`Tham gia ${chapter.chapter_name} đang LIVE`}
                    className="group inline-flex min-h-10 shrink-0 items-center gap-2.5 rounded-xl border border-emerald-500/60 bg-emerald-600 px-3.5 py-2 text-xs font-black tracking-[0.08em] text-white shadow-[0_5px_14px_rgba(5,150,105,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-[0_7px_18px_rgba(5,150,105,0.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 motion-reduce:transform-none motion-reduce:transition-none"
                    href={chapterHref}
                  >
                    <span aria-hidden className="flex size-5 items-center justify-center">
                      <svg className="size-5 animate-pulse transition-transform duration-200 group-hover:scale-110 motion-reduce:animate-none motion-reduce:transform-none" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" fill="currentColor" r="2.2" />
                        <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
                      </svg>
                    </span>
                    LIVE
                  </Link>
                ) : (
                  <span className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusClass[chapterStatus]}`}>{statusLabel[chapterStatus]}</span>
                )}
                key={chapter.chapter_id}
                lessonCount={chapterLessons.length}
                title={chapter.chapter_name}
                titleHref={chapterHref}
              >
                <div className="border-t border-black/10 bg-black/[0.015] p-3 sm:p-4">
                  {chapterLessons.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-black/15 bg-white p-5 text-center text-sm text-[var(--muted)]">Chưa có Lesson trong chương này.</p>
                  ) : (
                    <ul className="space-y-3">
                      {chapterLessons.map((lesson) => (
                        <li className="rounded-xl border border-black/10 bg-white px-4 py-3 shadow-sm" key={lesson.lesson_id}>
                          <span className="min-w-0 break-words font-semibold">{lesson.lesson_title}</span>
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
    </CourseSectionStudentGate>
  );
}
