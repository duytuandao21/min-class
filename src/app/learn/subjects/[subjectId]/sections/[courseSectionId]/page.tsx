import { notFound } from "next/navigation";
import Link from "next/link";

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

function getChapterStatus(lessons: { lesson_status: PublicLessonStatus }[]): PublicLessonStatus {
  if (lessons.some((lesson) => lesson.lesson_status === "LIVE")) return "LIVE";
  if (lessons.some((lesson) => lesson.lesson_status === "ENDED")) return "ENDED";
  return "UPCOMING";
}

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
        <p className="mt-4 text-lg text-[var(--muted)]">Chọn chương để tham gia buổi học đang LIVE hoặc xem lại buổi học đã kết thúc.</p>
      </header>

      {chapters.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-black/15 bg-white p-8 text-center text-[var(--muted)]">Lớp học phần này chưa có Lesson Plan.</p>
      ) : (
        <div className="space-y-4">
          {chapters.map((chapter, chapterIndex) => {
            const chapterLessons = lessonsByChapter.get(chapter.chapter_id) ?? [];
            const chapterStatus = getChapterStatus(chapterLessons);
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
                defaultOpen={chapterIndex === initiallyOpenChapterIndex}
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
    </main>
  );
}
