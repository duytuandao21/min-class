import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { LessonAccessForm } from "@/features/catalog/components/lesson-access-form";
import { getPublicChapterStatus, type PublicChapterStatus } from "@/features/catalog/chapter-preview";
import { ChapterPreviewView } from "@/features/catalog/components/chapter-preview-view";
import {
  getPublicChapters,
  getPublicCourseSections,
  getPublicLessons,
} from "@/features/catalog/server/queries";

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
  const chapterStatus = getPublicChapterStatus(chapterLessons, chapter.preview_enabled);
  const isPreview = chapterStatus === "PREVIEW";
  const pageHeader = (
    <>
      <BackLink href={`/learn/subjects/${subjectId}/sections/${courseSectionId}`} label={isPreview ? "Lessons" : "Lớp học phần"} />
      <header className="mt-10">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">{courseSection.display_name ?? courseSection.section_code}</p>
        {isPreview ? (
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <h1 className="text-4xl font-semibold tracking-tight">{chapter.chapter_name}</h1>
            <span className={`w-fit shrink-0 rounded-full px-4 py-2 text-sm font-bold ${statusClass.PREVIEW}`}>Bản xem trước</span>
          </div>
        ) : (
          <>
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
          </>
        )}
      </header>
    </>
  );

  return (
    <main className={`mx-auto flex min-h-screen w-full ${isPreview ? "max-w-5xl" : "max-w-2xl justify-center"} flex-col px-6 py-12 ${isPreview ? "" : "sm:px-10"}`}>

      {chapterStatus === "PREVIEW" ? (
        <ChapterPreviewView chapterId={chapterId} header={pageHeader} key={chapterId} />
      ) : (
        <>
          <div>{pageHeader}</div>
          {accessLesson ? <LessonAccessForm lessonId={accessLesson.lesson_id} scope="chapter" status={chapterStatus} /> : null}
        </>
      )}
    </main>
  );
}
