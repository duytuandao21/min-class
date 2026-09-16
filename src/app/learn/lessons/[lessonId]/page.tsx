import { notFound } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { LessonAccessForm } from "@/features/catalog/components/lesson-access-form";
import type { PublicLessonStatus } from "@/features/catalog/schemas";
import { getPublicLessonGateContext } from "@/features/catalog/server/queries";

const statusLabel: Record<PublicLessonStatus, string> = {
  UPCOMING: "Sắp diễn ra",
  LIVE: "LIVE",
  ENDED: "Đã kết thúc",
};

export default async function PublicLessonAccessPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const lesson = await getPublicLessonGateContext(lessonId);
  if (!lesson) notFound();
  const displayTitle = lesson.chapter_name ?? lesson.lesson_title;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-12 sm:px-10">
      <BackLink href={`/learn/subjects/${lesson.subject_id}/sections/${lesson.course_section_id}`} label="Lessons" />
      <header className="mt-10">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--accent)]">{lesson.section_display_name ?? lesson.section_code}</p>
        <h1 className="mt-4 line-clamp-3 break-words text-3xl font-semibold tracking-tight sm:line-clamp-2 sm:text-4xl" title={displayTitle}>{displayTitle}</h1>
        <p className="mt-3 leading-7 text-[var(--muted)]">{statusLabel[lesson.lesson_status]}</p>
        {lesson.lesson_status === "LIVE" ? <p className="mt-3 leading-7 text-[var(--muted)]">Nhập MSSV để tham gia chương đang LIVE.</p> : null}
        {lesson.lesson_status === "ENDED" ? <p className="mt-3 leading-7 text-[var(--muted)]">Nhập MSSV để xác minh bạn thuộc lớp học phần này.</p> : null}
      </header>
      <LessonAccessForm lessonId={lesson.lesson_id} scope={lesson.lesson_status === "LIVE" ? "chapter" : "lesson"} status={lesson.lesson_status} />
    </main>
  );
}
