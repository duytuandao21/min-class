import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { LessonAccessForm } from "@/features/catalog/components/lesson-access-form";
import type { PublicLessonStatus } from "@/features/catalog/schemas";
import {
  getPublicChapters,
  getPublicCourseSections,
  getPublicLessons,
} from "@/features/catalog/server/queries";

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

export default async function PublicChapterAccessPage({
  params,
}: {
  params: Promise<{ subjectId: string; courseSectionId: string; chapterId: string }>;
}) {
  const { subjectId, courseSectionId, chapterId } = await params;
  const [courseSections, chapters, lessons] = await Promise.all([
    getPublicCourseSections(subjectId),
    getPublicChapters(courseSectionId),
    getPublicLessons(courseSectionId),
  ]);
  const courseSection = courseSections.find((item) => item.course_section_id === courseSectionId);
  const chapter = chapters.find((item) => item.chapter_id === chapterId);
  if (!courseSection || !chapter) notFound();

  const chapterLessons = lessons.filter((lesson) => lesson.chapter_id === chapterId);
  const liveLesson = chapterLessons.find((lesson) => lesson.lesson_status === "LIVE");
  const endedLesson = chapterLessons.find((lesson) => lesson.lesson_status === "ENDED");
  const accessLesson = liveLesson ?? endedLesson ?? chapterLessons[0] ?? null;
  const chapterStatus: PublicLessonStatus = liveLesson ? "LIVE" : endedLesson ? "ENDED" : "UPCOMING";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-12 sm:px-10">
      <BackLink href={`/learn/subjects/${subjectId}/sections/${courseSectionId}`} label="Lớp học phần" />

      <header className="mt-10">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">{courseSection.display_name ?? courseSection.section_code}</p>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{chapter.chapter_name}</h1>
          <span className={`w-fit shrink-0 rounded-full px-4 py-2 text-sm font-bold ${statusClass[chapterStatus]}`}>{statusLabel[chapterStatus]}</span>
        </div>
        <p className="mt-4 text-lg leading-8 text-[var(--muted)]">
          {chapterStatus === "LIVE"
            ? "Nhập MSSV một lần để tham gia toàn bộ Lesson trong chương đang LIVE."
            : chapterStatus === "ENDED"
              ? "Nhập MSSV để xem lại toàn bộ Lesson trong Session gần nhất của chương."
              : "Chương này chưa có buổi học để truy cập."}
        </p>
      </header>

      <section className="mt-7 rounded-3xl border border-black/10 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="chapter-lessons-title">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold" id="chapter-lessons-title">Nội dung chương</h2>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900">{chapterLessons.length} Lesson</span>
        </div>
        {chapterLessons.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {chapterLessons.map((lesson) => (
              <li className="rounded-xl bg-black/[0.025] px-4 py-3" key={lesson.lesson_id}>
                <span className="font-semibold">{lesson.lesson_title}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-4 text-sm text-[var(--muted)]">Chương này chưa có Lesson.</p>}
      </section>

      {accessLesson ? <LessonAccessForm lessonId={accessLesson.lesson_id} scope="chapter" status={chapterStatus} /> : null}
    </main>
  );
}
