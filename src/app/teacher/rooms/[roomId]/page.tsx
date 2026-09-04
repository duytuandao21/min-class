import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BackLink } from "@/components/back-link";
import { MarkdownContent } from "@/features/lessons/components/markdown-preview";
import { EndSessionButton } from "@/features/rooms/components/end-session-button";
import { NextSectionButton } from "@/features/rooms/components/next-section-button";
import { ReleaseChapterButton } from "@/features/rooms/components/release-chapter-button";
import { TeacherLiveFeedback } from "@/features/rooms/components/teacher-live-feedback";
import { TeacherQuizAnalytics } from "@/features/rooms/components/teacher-quiz-analytics";
import { TeacherRoomOverview } from "@/features/rooms/components/teacher-room-overview";
import {
  getTeacherFeedbackSnapshot,
  getTeacherQuizAnalytics,
  getTeacherRoom,
} from "@/features/rooms/server/queries";

export default async function TeacherRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ lessonId?: string }>;
}) {
  const { roomId } = await params;
  const { lessonId } = await searchParams;
  const room = await getTeacherRoom(roomId, lessonId);
  if (!room) notFound();
  if (room.status === "ENDED") redirect(`/teacher/rooms/${room.id}/summary`);

  const [feedback, quizAnalytics] = await Promise.all([
    getTeacherFeedbackSnapshot(room.id, room.selectedLessonId),
    getTeacherQuizAnalytics(room.id),
  ]);
  if (!feedback || !quizAnalytics) notFound();

  const currentSection = room.sections.find((section) => section.position === room.teaching_section) ?? null;
  const selectedLessonTitle = room.lessons.find((lesson) => lesson.lesson_id === room.selectedLessonId)?.lesson_title
    ?? room.title;
  const selectedLessonSectionIds = room.sections.map((section) => section.id);
  const currentSectionIndex = currentSection
    ? room.sections.findIndex((section) => section.id === currentSection.id)
    : -1;
  const hasNextSection = currentSectionIndex >= 0 && currentSectionIndex < room.sections.length - 1;
  const courseSectionHref = room.lessonContext
    ? `/teacher/subjects/${room.lessonContext.subjectId}/sections/${room.lessonContext.courseSectionId}`
    : "/teacher/subjects";

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 sm:px-10 lg:px-12">
      <BackLink href={courseSectionHref} label="Course Section" />

      <header className="mt-8 flex flex-col justify-between gap-5 border-b border-black/10 pb-7 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold tracking-[0.18em] text-[var(--accent)]">TEACHER LIVE DASHBOARD</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">{room.title}</h1>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${room.status === "ACTIVE" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{room.status}</span>
      </header>

      <TeacherRoomOverview initialAttendance={room.attendance} roomId={room.id} />

      <nav aria-label="Các Lesson đang dạy" className="mt-7 flex gap-2 overflow-x-auto pb-2">
        {room.lessons.map((lesson) => (
          <Link
            aria-current={lesson.lesson_id === room.selectedLessonId ? "page" : undefined}
            className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${lesson.lesson_id === room.selectedLessonId ? "border-sky-700 bg-sky-700 text-white" : "border-black/10 bg-white hover:border-sky-400 hover:text-sky-800"}`}
            href={`/teacher/rooms/${room.id}?lessonId=${lesson.lesson_id}`}
            key={lesson.lesson_id}
          >
            {lesson.lesson_title}
          </Link>
        ))}
      </nav>

      <section className="mt-7">
        {!currentSection ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-7 text-red-900">Không tìm thấy teaching section hiện tại.</div>
        ) : (
          <article className="rounded-3xl border border-blue-300 bg-blue-100/75 p-7 shadow-sm sm:p-10">
            <header className="mb-7 flex flex-col justify-between gap-5 border-b border-black/10 pb-6 sm:flex-row sm:items-start">
              <div>
                <p className="font-mono text-xs font-semibold text-[var(--accent)]">SECTION ĐANG DẠY · {currentSectionIndex + 1} / {room.sections.length}</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">{currentSection.title}</h2>
              </div>
              <span className="w-fit rounded-full bg-black/5 px-3 py-1 text-xs font-medium">{currentSection.type}</span>
            </header>

            {currentSection.type === "QUIZ" ? (
              <p className="rounded-2xl bg-sky-50 p-5 leading-7 text-sky-950">Student đang làm Quiz trên thiết bị của mình. Theo dõi tiến độ ở Quiz Analytics bên dưới.</p>
            ) : (
              <MarkdownContent source={currentSection.contentMd} />
            )}

            <div className="mt-8 border-t border-black/10 pt-6">
              {hasNextSection ? (
                <>
                  <p className="mb-4 text-sm leading-6 text-[var(--muted)]">Bấm Done Section để chuyển cả lớp sang section kế tiếp.</p>
                  <NextSectionButton lessonId={room.selectedLessonId} roomId={room.id} />
                </>
              ) : (
                <div className="rounded-2xl bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-900">Đây là section cuối. Khi hoàn tất, hãy kết thúc buổi học.</div>
              )}
            </div>
          </article>
        )}
      </section>

      <TeacherLiveFeedback
        currentSectionId={currentSection?.id ?? null}
        initialSnapshot={feedback}
        key={`feedback-${room.selectedLessonId}`}
        lessonId={room.selectedLessonId}
        lessonTitle={selectedLessonTitle}
        roomId={room.id}
        sectionIds={selectedLessonSectionIds}
      />
      <TeacherQuizAnalytics
        initialAnalytics={quizAnalytics}
        key={`quiz-${room.selectedLessonId}`}
        lessonTitle={selectedLessonTitle}
        roomId={room.id}
        sectionIds={selectedLessonSectionIds}
      />

      <section className="mt-8 border-t border-black/10 pt-8">
        <div className="flex flex-wrap items-start gap-3">
          <ReleaseChapterButton roomId={room.id} />
          <EndSessionButton roomId={room.id} />
        </div>
      </section>
    </main>
  );
}
