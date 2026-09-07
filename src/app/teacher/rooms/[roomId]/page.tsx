import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { BackLink } from "@/components/back-link";
import { EndSessionButton } from "@/features/rooms/components/end-session-button";
import { ReleaseChapterButton } from "@/features/rooms/components/release-chapter-button";
import { TeacherQuizAnalytics } from "@/features/rooms/components/teacher-quiz-analytics";
import { TeacherRoomOverview } from "@/features/rooms/components/teacher-room-overview";
import { TeacherSectionPlayer } from "@/features/rooms/components/teacher-section-player";
import {
  getTeacherFeedbackSnapshot,
  getTeacherLessonQuizAnalytics,
  getTeacherRoom,
} from "@/features/rooms/server/queries";

async function TeacherLessonContent({
  feedbackPromise,
  lessonId,
  lessonTitle,
  releasedThrough,
  roomId,
  sections,
  teachingSection,
}: {
  feedbackPromise: ReturnType<typeof getTeacherFeedbackSnapshot>;
  lessonId: string;
  lessonTitle: string;
  releasedThrough: number;
  roomId: string;
  sections: Parameters<typeof TeacherSectionPlayer>[0]["sections"];
  teachingSection: number;
}) {
  const feedback = await feedbackPromise;
  if (!feedback) notFound();
  return (
    <TeacherSectionPlayer
      initialFeedback={feedback}
      initialReleasedThrough={releasedThrough}
      initialTeachingSection={teachingSection}
      lessonId={lessonId}
      lessonTitle={lessonTitle}
      roomId={roomId}
      sections={sections}
    />
  );
}

async function TeacherQuizContent({
  analyticsPromise,
  lessonId,
  lessonTitle,
  roomId,
  sectionIds,
}: {
  analyticsPromise: ReturnType<typeof getTeacherLessonQuizAnalytics>;
  lessonId: string;
  lessonTitle: string;
  roomId: string;
  sectionIds: string[];
}) {
  const analytics = await analyticsPromise;
  if (!analytics) notFound();
  return (
    <TeacherQuizAnalytics
      initialAnalytics={analytics}
      lessonId={lessonId}
      lessonTitle={lessonTitle}
      roomId={roomId}
      sectionIds={sectionIds}
    />
  );
}

function LivePanelFallback({ label }: { label: string }) {
  return (
    <section className="mt-8 rounded-3xl border border-black/10 bg-white p-7 shadow-sm" aria-busy="true">
      <div className="h-4 w-36 animate-pulse rounded bg-emerald-100 motion-reduce:animate-none" />
      <div className="mt-4 h-8 w-64 max-w-full animate-pulse rounded-xl bg-black/10 motion-reduce:animate-none" />
      <p className="sr-only">Đang tải {label}</p>
      <div className="mt-6 h-64 animate-pulse rounded-2xl bg-black/5 motion-reduce:animate-none" />
    </section>
  );
}

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

  const feedbackPromise = getTeacherFeedbackSnapshot(room.id, room.selectedLessonId);
  const quizAnalyticsPromise = getTeacherLessonQuizAnalytics(room.id, room.selectedLessonId);

  const selectedLessonTitle = room.lessons.find((lesson) => lesson.lesson_id === room.selectedLessonId)?.lesson_title
    ?? room.title;
  const selectedLessonSectionIds = room.sections.map((section) => section.id);
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

      <Suspense fallback={<LivePanelFallback label="nội dung Lesson" />} key={`lesson-${room.selectedLessonId}`}>
        <TeacherLessonContent
          feedbackPromise={feedbackPromise}
          lessonId={room.selectedLessonId}
          lessonTitle={selectedLessonTitle}
          releasedThrough={room.released_through}
          roomId={room.id}
          sections={room.sections}
          teachingSection={room.teaching_section}
        />
      </Suspense>
      <Suspense fallback={<LivePanelFallback label="kết quả Quiz" />} key={`quiz-${room.selectedLessonId}`}>
        <TeacherQuizContent
          analyticsPromise={quizAnalyticsPromise}
          lessonId={room.selectedLessonId}
          lessonTitle={selectedLessonTitle}
          roomId={room.id}
          sectionIds={selectedLessonSectionIds}
        />
      </Suspense>

      <section className="mt-8 border-t border-black/10 pt-8">
        <div className="flex flex-wrap items-start gap-3">
          <ReleaseChapterButton roomId={room.id} />
          <EndSessionButton roomId={room.id} />
        </div>
      </section>
    </main>
  );
}
